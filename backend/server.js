require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { OAuth2Client } = require('google-auth-library');

const { pool, init } = require('./db');
const { makeToken, requireAuth, requireAdmin } = require('./auth');

const app = express();
const PORT = process.env.PORT || 4000;
const ADMIN_SIGNUP_CODE = process.env.ADMIN_SIGNUP_CODE || 'reel2026';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

app.use(cors());
app.use(express.json());

function h(fn) {
  return (req, res) => fn(req, res).catch(err => {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on the server.' });
  });
}

// =====================================================================
// AUTH — Google sign-in only
// =====================================================================

app.post('/api/auth/google', h(async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: 'Missing Google credential.' });
  if (!GOOGLE_CLIENT_ID) return res.status(500).json({ error: 'Server is not configured with a Google Client ID yet.' });

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch (e) {
    return res.status(401).json({ error: 'Could not verify that Google sign-in. Please try again.' });
  }

  const email = payload.email ? payload.email.trim().toLowerCase() : null;
  const name = payload.name || (email ? email.split('@')[0] : 'User');
  if (!email) return res.status(400).json({ error: 'Your Google account has no email on file.' });

  const existing = await pool.query('SELECT * FROM users WHERE reg_no = $1', [email]);
  let user;
  if (existing.rows.length) {
    if (Number(existing.rows[0].is_banned) === 1) {
      return res.status(403).json({ error: 'This account has been banned.', banned: true });
    }
    await pool.query('UPDATE users SET name = $1 WHERE reg_no = $2', [name, email]);
    user = { ...existing.rows[0], name };
  } else {
    await pool.query(
      'INSERT INTO users (reg_no, name, is_admin, suggestion_allowance, created_at) VALUES ($1, $2, 0, 1, $3)',
      [email, name, Date.now()]
    );
    user = { reg_no: email, name, is_admin: 0 };
  }

  res.json({ token: makeToken(user), name: user.name, isAdmin: !!user.is_admin, email });
}));

app.post('/api/auth/claim-admin', requireAuth, h(async (req, res) => {
  const { code } = req.body;
  if (!code || code !== ADMIN_SIGNUP_CODE) return res.status(401).json({ error: 'That code is not correct.' });
  await pool.query('UPDATE users SET is_admin = 1 WHERE reg_no = $1', [req.user.regNo]);
  const result = await pool.query('SELECT * FROM users WHERE reg_no = $1', [req.user.regNo]);
  const user = result.rows[0];
  res.json({ token: makeToken(user), name: user.name, isAdmin: true });
}));

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ regNo: req.user.regNo, name: req.user.name, isAdmin: req.user.isAdmin });
});

// =====================================================================
// MOVIES (library) — admin manages, everyone can read
// =====================================================================

function serializeMovie(m) {
  return {
    id: m.id,
    title: m.title,
    poster: m.poster_url || null,
    genre: m.genre,
    duration: m.duration,
    language: m.language,
    year: m.year,
    rating: m.imdb_rating,
    pgTag: m.pg_tag,
    pgDetail: m.pg_detail,
    storyline: m.storyline
  };
}

app.get('/api/movies', h(async (req, res) => {
  const result = await pool.query('SELECT * FROM movies ORDER BY created_at DESC');
  res.json(result.rows.map(serializeMovie));
}));

app.post('/api/movies', requireAdmin, h(async (req, res) => {
  const { title, posterUrl, genre, duration, language, year, rating, pgTag, pgDetail, storyline } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required.' });

  const result = await pool.query(`
    INSERT INTO movies (title, poster_url, genre, duration, language, year, imdb_rating, pg_tag, pg_detail, storyline, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *
  `, [
    title, posterUrl || null, genre || null,
    duration ? Number(duration) : null,
    language || null,
    year ? Number(year) : null,
    rating ? Number(rating) : null,
    pgTag || 'mild',
    pgDetail || null,
    storyline || null,
    Date.now()
  ]);
  res.json(serializeMovie(result.rows[0]));
}));

app.put('/api/movies/:id', requireAdmin, h(async (req, res) => {
  const { title, posterUrl, genre, duration, language, year, rating, pgTag, pgDetail, storyline } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required.' });

  const result = await pool.query(`
    UPDATE movies SET
      title = $1, poster_url = $2, genre = $3, duration = $4, language = $5,
      year = $6, imdb_rating = $7, pg_tag = $8, pg_detail = $9, storyline = $10
    WHERE id = $11
    RETURNING *
  `, [
    title, posterUrl || null, genre || null,
    duration ? Number(duration) : null,
    language || null,
    year ? Number(year) : null,
    rating ? Number(rating) : null,
    pgTag || 'mild',
    pgDetail || null,
    storyline || null,
    req.params.id
  ]);
  if (!result.rows[0]) return res.status(404).json({ error: 'Movie not found.' });
  res.json(serializeMovie(result.rows[0]));
}));

app.delete('/api/movies/:id', requireAdmin, h(async (req, res) => {
  const movieId = req.params.id;
  // Screenings now keep their own permanent snapshot (see ensureExtraColumns),
  // so deleting a movie no longer touches any past history.
  await pool.query('DELETE FROM poll_nominees WHERE movie_id = $1', [movieId]);
  await pool.query('DELETE FROM votes WHERE movie_id = $1', [movieId]);
  await pool.query('DELETE FROM movies WHERE id = $1', [movieId]);
  res.json({ ok: true });
}));

// =====================================================================
// NEXT SATURDAY POLL
// =====================================================================

async function getActivePoll() {
  const result = await pool.query('SELECT * FROM polls WHERE is_active = 1 ORDER BY id DESC LIMIT 1');
  return result.rows[0];
}

app.get('/api/poll', requireAuth, h(async (req, res) => {
  const poll = await getActivePoll();
  const nomineeRows = await pool.query(`
    SELECT m.* FROM poll_nominees pn JOIN movies m ON m.id = pn.movie_id WHERE pn.poll_id = $1
  `, [poll.id]);

  const voteCounts = await pool.query(`
    SELECT v.movie_id, COUNT(*) c FROM votes v
    JOIN poll_nominees pn ON pn.poll_id = v.poll_id AND pn.movie_id = v.movie_id
    WHERE v.poll_id = $1 GROUP BY v.movie_id
  `, [poll.id]);
  const realVotes = {};
  voteCounts.rows.forEach(v => { realVotes[v.movie_id] = Number(v.c); });

  // Who voted for what — real voters only, manual admin bumps are excluded.
  const voterRows = await pool.query(`
    SELECT v.movie_id, u.name FROM votes v
    JOIN poll_nominees pn ON pn.poll_id = v.poll_id AND pn.movie_id = v.movie_id
    LEFT JOIN users u ON u.reg_no = v.reg_no
    WHERE v.poll_id = $1
    ORDER BY u.name ASC
  `, [poll.id]);
  const voterNames = {};
  voterRows.rows.forEach(r => {
    if (!voterNames[r.movie_id]) voterNames[r.movie_id] = [];
    voterNames[r.movie_id].push(r.name || 'Unknown');
  });

  const manualRows = await pool.query('SELECT movie_id, amount FROM manual_votes WHERE poll_id = $1', [poll.id]);
  const manualVotes = {};
  manualRows.rows.forEach(r => { manualVotes[r.movie_id] = Number(r.amount); });

  const votes = {};
  nomineeRows.rows.forEach(m => {
    votes[m.id] = (realVotes[m.id] || 0) + (manualVotes[m.id] || 0);
  });

  const myVoteRow = await pool.query(`
    SELECT v.movie_id FROM votes v
    JOIN poll_nominees pn ON pn.poll_id = v.poll_id AND pn.movie_id = v.movie_id
    WHERE v.poll_id = $1 AND v.reg_no = $2
  `, [poll.id, req.user.regNo]);

  res.json({
    nominees: nomineeRows.rows.map(serializeMovie),
    votes,
    voterNames,
    myVote: myVoteRow.rows[0] ? myVoteRow.rows[0].movie_id : null
  });
}));

app.delete('/api/poll/vote', requireAuth, h(async (req, res) => {
  const poll = await getActivePoll();
  await pool.query('DELETE FROM votes WHERE poll_id = $1 AND reg_no = $2', [poll.id, req.user.regNo]);
  res.json({ ok: true });
}));

app.post('/api/poll/vote', requireAuth, h(async (req, res) => {
  const { movieId } = req.body;
  const poll = await getActivePoll();
  const isNominee = await pool.query('SELECT 1 FROM poll_nominees WHERE poll_id = $1 AND movie_id = $2', [poll.id, movieId]);
  if (!isNominee.rows.length) return res.status(400).json({ error: 'That movie is not nominated this week.' });

  await pool.query(`
    INSERT INTO votes (poll_id, reg_no, movie_id, created_at) VALUES ($1, $2, $3, $4)
    ON CONFLICT (poll_id, reg_no) DO UPDATE SET movie_id = excluded.movie_id, created_at = excluded.created_at
  `, [poll.id, req.user.regNo, movieId, Date.now()]);

  res.json({ ok: true });
}));

app.post('/api/poll/nominees', requireAdmin, h(async (req, res) => {
  const { movieIds, resetVotes } = req.body;
  if (!Array.isArray(movieIds) || movieIds.length < 1) {
    return res.status(400).json({ error: 'Pick at least 1 movie.' });
  }

  if (resetVotes) {
    // Starts a brand new poll — old votes stay archived under the old poll id.
    await pool.query('UPDATE polls SET is_active = 0 WHERE is_active = 1');
    const info = await pool.query('INSERT INTO polls (is_active, created_at) VALUES (1, $1) RETURNING id', [Date.now()]);
    const pollId = info.rows[0].id;
    for (const id of movieIds) {
      await pool.query('INSERT INTO poll_nominees (poll_id, movie_id) VALUES ($1, $2)', [pollId, id]);
    }
  } else {
    // Same poll id — existing votes for movies that are still nominated survive.
    const poll = await getActivePoll();
    await pool.query('DELETE FROM poll_nominees WHERE poll_id = $1', [poll.id]);
    for (const id of movieIds) {
      await pool.query('INSERT INTO poll_nominees (poll_id, movie_id) VALUES ($1, $2)', [poll.id, id]);
    }
  }

  res.json({ ok: true });
}));

app.post('/api/poll/adjust-votes', requireAdmin, h(async (req, res) => {
  const { movieId, amount } = req.body;
  const n = Number(amount);
  if (!Number.isInteger(n) || n <= 0) return res.status(400).json({ error: 'Enter a positive whole number.' });
  const poll = await getActivePoll();
  await pool.query(`
    INSERT INTO manual_votes (poll_id, movie_id, amount) VALUES ($1, $2, $3)
    ON CONFLICT (poll_id, movie_id) DO UPDATE SET amount = manual_votes.amount + $3
  `, [poll.id, movieId, n]);
  res.json({ ok: true });
}));

// =====================================================================
// SUGGESTIONS — upvote/downvote, 1-per-person limit, admin can reset
// =====================================================================

app.get('/api/suggestions', requireAuth, h(async (req, res) => {
  const result = await pool.query(`
    SELECT s.*, u.name as submitter_name,
      COUNT(DISTINCT su.reg_no) as upvotes,
      COUNT(DISTINCT sd.reg_no) as downvotes,
      MAX(CASE WHEN su.reg_no = $1 THEN 1 ELSE 0 END) as my_upvote,
      MAX(CASE WHEN sd.reg_no = $1 THEN 1 ELSE 0 END) as my_downvote
    FROM suggestions s
    LEFT JOIN users u ON LOWER(TRIM(u.reg_no)) = LOWER(TRIM(s.reg_no))
    LEFT JOIN suggestion_upvotes su ON su.suggestion_id = s.id
    LEFT JOIN suggestion_downvotes sd ON sd.suggestion_id = s.id
    GROUP BY s.id, u.name
    ORDER BY (COUNT(DISTINCT su.reg_no) - COUNT(DISTINCT sd.reg_no)) DESC, s.created_at DESC
  `, [req.user.regNo]);

  const userRow = await pool.query('SELECT suggestion_allowance FROM users WHERE reg_no = $1', [req.user.regNo]);

  res.json({
    suggestions: result.rows.map(r => ({
      id: r.id, name: r.name, link: r.link, note: r.note,
      upvotes: Number(r.upvotes), downvotes: Number(r.downvotes),
      upvotedByMe: !!Number(r.my_upvote), downvotedByMe: !!Number(r.my_downvote),
      submittedBy: r.submitter_name || r.reg_no,
      submittedByName: r.submitter_name || r.reg_no
    })),
    remainingSuggestions: userRow.rows[0] ? userRow.rows[0].suggestion_allowance : 1
  });
}));

app.post('/api/suggestions', requireAuth, h(async (req, res) => {
  const { name, link, note } = req.body;
  if (!name) return res.status(400).json({ error: 'Movie name is required.' });

  const userRow = await pool.query('SELECT suggestion_allowance FROM users WHERE reg_no = $1', [req.user.regNo]);
  const allowance = userRow.rows[0] ? userRow.rows[0].suggestion_allowance : 0;
  if (allowance < 1) {
    return res.status(403).json({ error: "You've already used your suggestion. An admin can reset it if you need another." });
  }

  await pool.query('INSERT INTO suggestions (reg_no, name, link, note, created_at) VALUES ($1, $2, $3, $4, $5)',
    [req.user.regNo, name, link || null, note || null, Date.now()]);
  await pool.query('UPDATE users SET suggestion_allowance = suggestion_allowance - 1 WHERE reg_no = $1', [req.user.regNo]);
  res.json({ ok: true });
}));

app.post('/api/suggestions/:id/upvote', requireAuth, h(async (req, res) => {
  const id = req.params.id;
  await pool.query('DELETE FROM suggestion_downvotes WHERE suggestion_id = $1 AND reg_no = $2', [id, req.user.regNo]);
  const existing = await pool.query('SELECT 1 FROM suggestion_upvotes WHERE suggestion_id = $1 AND reg_no = $2', [id, req.user.regNo]);
  if (existing.rows.length) {
    await pool.query('DELETE FROM suggestion_upvotes WHERE suggestion_id = $1 AND reg_no = $2', [id, req.user.regNo]);
  } else {
    await pool.query('INSERT INTO suggestion_upvotes (suggestion_id, reg_no) VALUES ($1, $2)', [id, req.user.regNo]);
  }
  res.json({ ok: true });
}));

app.post('/api/suggestions/:id/downvote', requireAuth, h(async (req, res) => {
  const id = req.params.id;
  await pool.query('DELETE FROM suggestion_upvotes WHERE suggestion_id = $1 AND reg_no = $2', [id, req.user.regNo]);
  const existing = await pool.query('SELECT 1 FROM suggestion_downvotes WHERE suggestion_id = $1 AND reg_no = $2', [id, req.user.regNo]);
  if (existing.rows.length) {
    await pool.query('DELETE FROM suggestion_downvotes WHERE suggestion_id = $1 AND reg_no = $2', [id, req.user.regNo]);
  } else {
    await pool.query('INSERT INTO suggestion_downvotes (suggestion_id, reg_no) VALUES ($1, $2)', [id, req.user.regNo]);
  }
  res.json({ ok: true });
}));

app.delete('/api/suggestions/:id', requireAdmin, h(async (req, res) => {
  await pool.query('DELETE FROM suggestions WHERE id = $1', [req.params.id]);
  await pool.query('DELETE FROM suggestion_upvotes WHERE suggestion_id = $1', [req.params.id]);
  await pool.query('DELETE FROM suggestion_downvotes WHERE suggestion_id = $1', [req.params.id]);
  res.json({ ok: true });
}));

// Admin resets a person's suggestion allowance (or everyone's) so they can suggest again.
app.post('/api/suggestions/reset-limit', requireAdmin, h(async (req, res) => {
  const { email } = req.body;
  if (email) {
    await pool.query('UPDATE users SET suggestion_allowance = 1 WHERE reg_no = $1', [email]);
  } else {
    await pool.query('UPDATE users SET suggestion_allowance = 1');
  }
  res.json({ ok: true });
}));

// =====================================================================
// SCREENINGS — "Rate Last Movie" (current) + "Old Movies" (history)
// =====================================================================

const EXPERIENCE_OPTIONS = [
  'Sitting arrangement should be improved',
  'People were talking/shouting too much',
  'Everything was perfect'
];

app.get('/api/last-movie', requireAuth, h(async (req, res) => {
  const rowResult = await pool.query('SELECT * FROM last_movie WHERE id = 1');
  const row = rowResult.rows[0];
  if (!row.screening_id) return res.json({ movie: null });

  const screeningResult = await pool.query('SELECT * FROM screenings WHERE id = $1', [row.screening_id]);
  const screening = screeningResult.rows[0];
  if (!screening) return res.json({ movie: null });

  const feedbackResult = await pool.query(`
    SELECT f.*, u.name as commenter_name,
      COUNT(DISTINCT CASE WHEN fr.reaction = 'up' THEN fr.reg_no END) as thumbs_up,
      COUNT(DISTINCT CASE WHEN fr.reaction = 'down' THEN fr.reg_no END) as thumbs_down,
      MAX(CASE WHEN fr.reg_no = $2 THEN fr.reaction END) as my_reaction,
      BOOL_OR(fr.reaction = 'up' AND ru.is_admin = 1) as liked_by_admin
    FROM feedback f
    LEFT JOIN users u ON u.reg_no = f.reg_no
    LEFT JOIN feedback_reactions fr ON fr.feedback_id = f.id
    LEFT JOIN users ru ON ru.reg_no = fr.reg_no
    WHERE f.screening_id = $1
    GROUP BY f.id, u.name
    ORDER BY f.created_at DESC
  `, [row.screening_id, req.user.regNo]);
  const feedback = feedbackResult.rows;
  const avg = feedback.length ? feedback.reduce((a, f) => a + f.rating, 0) / feedback.length : 0;
  const mine = feedback.find(f => f.reg_no === req.user.regNo);

  res.json({
    movie: serializeMovie(screening),
    shownDate: screening.shown_date,
    experienceOptions: EXPERIENCE_OPTIONS,
    feedback: feedback.map(f => ({
      id: f.id,
      rating: f.rating, comment: f.comment, experience: f.experience || [],
      name: f.commenter_name || f.reg_no,
      thumbsUp: Number(f.thumbs_up), thumbsDown: Number(f.thumbs_down), myReaction: f.my_reaction || null,
      likedByAdmin: !!f.liked_by_admin,
      createdAt: Number(f.created_at), isMine: f.reg_no === req.user.regNo
    })),
    average: avg,
    myFeedback: mine ? { rating: mine.rating, comment: mine.comment, experience: mine.experience || [] } : null
  });
}));

app.post('/api/last-movie', requireAdmin, h(async (req, res) => {
  const { movieId, shownDate } = req.body;
  if (!movieId) return res.status(400).json({ error: 'Pick a movie.' });
  const date = shownDate || new Date().toISOString().slice(0, 10);

  const movieResult = await pool.query('SELECT * FROM movies WHERE id = $1', [movieId]);
  const movie = movieResult.rows[0];
  if (!movie) return res.status(404).json({ error: 'Movie not found.' });

  const info = await pool.query(`
    INSERT INTO screenings (
      movie_id, shown_date, created_at,
      title, poster_url, genre, duration, language, year, imdb_rating, pg_tag, pg_detail, storyline
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING id
  `, [
    movieId, date, Date.now(),
    movie.title, movie.poster_url, movie.genre, movie.duration, movie.language,
    movie.year, movie.imdb_rating, movie.pg_tag, movie.pg_detail, movie.storyline
  ]);
  await pool.query('UPDATE last_movie SET screening_id = $1, set_at = $2 WHERE id = 1', [info.rows[0].id, Date.now()]);
  res.json({ ok: true });
}));

app.post('/api/feedback', requireAuth, h(async (req, res) => {
  const { rating, comment, experience } = req.body;
  const rowResult = await pool.query('SELECT * FROM last_movie WHERE id = 1');
  const row = rowResult.rows[0];
  if (!row.screening_id) return res.status(400).json({ error: 'No movie has been marked as shown yet.' });
  if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be 1-5.' });
  if (comment) {
    const trimmed = comment.trim();
    if (trimmed.length > 150) return res.status(400).json({ error: 'Comments can be at most 150 characters.' });
    if (trimmed.split(/[\s_]+/).filter(Boolean).length > 20) {
      return res.status(400).json({ error: 'Comments can be at most 20 words.' });
    }
  }

  const screeningResult = await pool.query('SELECT movie_id FROM screenings WHERE id = $1', [row.screening_id]);
  const expArray = Array.isArray(experience) ? experience.filter(e => EXPERIENCE_OPTIONS.includes(e)) : [];

  try {
    await pool.query(
      'INSERT INTO feedback (screening_id, movie_id, reg_no, rating, comment, experience, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [row.screening_id, screeningResult.rows[0].movie_id, req.user.regNo, rating, comment || null, expArray, Date.now()]
    );
  } catch (e) {
    return res.status(409).json({ error: 'You already rated this movie.' });
  }
  res.json({ ok: true });
}));

// Clear just the comment text on your own feedback — the star rating stays.
// Clear just the comment text on your own feedback — the star rating stays.
app.delete('/api/feedback/comment', requireAuth, h(async (req, res) => {
  const rowResult = await pool.query('SELECT * FROM last_movie WHERE id = 1');
  const row = rowResult.rows[0];
  if (!row.screening_id) return res.status(400).json({ error: 'No current movie.' });
  await pool.query('UPDATE feedback SET comment = NULL WHERE screening_id = $1 AND reg_no = $2', [row.screening_id, req.user.regNo]);
  res.json({ ok: true });
}));

// Admin removes someone else's feedback entry entirely (rating + comment).
app.delete('/api/feedback/:id', requireAdmin, h(async (req, res) => {
  await pool.query('DELETE FROM feedback_reactions WHERE feedback_id = $1', [req.params.id]);
  await pool.query('DELETE FROM feedback WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

// Thumbs up/down on someone else's feedback comment. Clicking the same
// reaction again removes it; clicking the other one switches it.
app.post('/api/feedback/:id/react', requireAuth, h(async (req, res) => {
  const { reaction } = req.body;
  if (!['up', 'down'].includes(reaction)) return res.status(400).json({ error: 'Invalid reaction.' });
  const feedbackId = req.params.id;
  const existing = await pool.query(
    'SELECT reaction FROM feedback_reactions WHERE feedback_id = $1 AND reg_no = $2',
    [feedbackId, req.user.regNo]
  );
  if (existing.rows[0] && existing.rows[0].reaction === reaction) {
    await pool.query('DELETE FROM feedback_reactions WHERE feedback_id = $1 AND reg_no = $2', [feedbackId, req.user.regNo]);
  } else {
    await pool.query(`
      INSERT INTO feedback_reactions (feedback_id, reg_no, reaction) VALUES ($1, $2, $3)
      ON CONFLICT (feedback_id, reg_no) DO UPDATE SET reaction = excluded.reaction
    `, [feedbackId, req.user.regNo, reaction]);
  }
  res.json({ ok: true });
}));

// "Old Movies" — every past screening, most recent first.
app.get('/api/screenings', requireAuth, h(async (req, res) => {
  const result = await pool.query(`
    SELECT s.*,
      COALESCE(AVG(f.rating), 0) as avg_rating,
      COUNT(f.id) as feedback_count
    FROM screenings s
    LEFT JOIN feedback f ON f.screening_id = s.id
    GROUP BY s.id
    ORDER BY s.shown_date DESC, s.id DESC
  `);
  res.json(result.rows.map(r => ({
    screeningId: r.id,
    shownDate: r.shown_date,
    movie: serializeMovie(r),
    average: Number(r.avg_rating),
    feedbackCount: Number(r.feedback_count)
  })));
}));

// =====================================================================
// ADMIN — RESET
// =====================================================================

app.post('/api/admin/reset', requireAdmin, h(async (req, res) => {
  const { scope } = req.body;
  const valid = ['movies', 'poll', 'suggestions', 'feedback', 'history', 'everything'];
  if (!valid.includes(scope)) return res.status(400).json({ error: 'Unknown reset scope.' });

  if (scope === 'movies' || scope === 'everything') {
    await pool.query('DELETE FROM poll_nominees');
    await pool.query('DELETE FROM votes');
    await pool.query('DELETE FROM movies');
  }
  if (scope === 'poll' || scope === 'everything') {
    await pool.query('UPDATE polls SET is_active = 0 WHERE is_active = 1');
    await pool.query('INSERT INTO polls (is_active, created_at) VALUES (1, $1)', [Date.now()]);
  }
  if (scope === 'suggestions' || scope === 'everything') {
    await pool.query('DELETE FROM suggestion_upvotes');
    await pool.query('DELETE FROM suggestion_downvotes');
    await pool.query('DELETE FROM suggestions');
    await pool.query('UPDATE users SET suggestion_allowance = 1');
  }
  if (scope === 'feedback') {
    await pool.query('DELETE FROM feedback_reactions');
    await pool.query('DELETE FROM feedback');
  }
  if (scope === 'history') {
    await pool.query('DELETE FROM feedback_reactions');
    await pool.query('DELETE FROM feedback');
    await pool.query('DELETE FROM screenings');
    await pool.query('UPDATE last_movie SET screening_id = NULL, set_at = NULL WHERE id = 1');
  }

  res.json({ ok: true });
}));

async function ensureMaintenanceTable() {
  await pool.query(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
  const existing = await pool.query("SELECT 1 FROM settings WHERE key = 'maintenance'");
  if (!existing.rows.length) {
    await pool.query("INSERT INTO settings (key, value) VALUES ('maintenance', 'off')");
  }
}

app.get('/api/maintenance', h(async (req, res) => {
  const result = await pool.query("SELECT value FROM settings WHERE key = 'maintenance'");
  res.json({ on: result.rows[0] ? result.rows[0].value === 'on' : false });
}));

app.post('/api/admin/maintenance', requireAdmin, h(async (req, res) => {
  const { on } = req.body;
  await pool.query(
    "INSERT INTO settings (key, value) VALUES ('maintenance', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
    [on ? 'on' : 'off']
  );
  res.json({ ok: true });
}));

async function ensureExtraColumns() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS manual_votes (
      poll_id INTEGER NOT NULL,
      movie_id INTEGER NOT NULL,
      amount INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (poll_id, movie_id)
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS daily_visits (
      visit_date TEXT NOT NULL,
      reg_no TEXT NOT NULL,
      PRIMARY KEY (visit_date, reg_no)
    );
  `);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned INTEGER NOT NULL DEFAULT 0;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at BIGINT;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen BIGINT;`);
  await pool.query(`ALTER TABLE screenings ADD COLUMN IF NOT EXISTS title TEXT;`);
  await pool.query(`ALTER TABLE screenings ADD COLUMN IF NOT EXISTS poster_url TEXT;`);
  await pool.query(`ALTER TABLE screenings ADD COLUMN IF NOT EXISTS genre TEXT;`);
  await pool.query(`ALTER TABLE screenings ADD COLUMN IF NOT EXISTS duration INTEGER;`);
  await pool.query(`ALTER TABLE screenings ADD COLUMN IF NOT EXISTS language TEXT;`);
  await pool.query(`ALTER TABLE screenings ADD COLUMN IF NOT EXISTS year INTEGER;`);
  await pool.query(`ALTER TABLE screenings ADD COLUMN IF NOT EXISTS imdb_rating REAL;`);
  await pool.query(`ALTER TABLE screenings ADD COLUMN IF NOT EXISTS pg_tag TEXT;`);
  await pool.query(`ALTER TABLE screenings ADD COLUMN IF NOT EXISTS pg_detail TEXT;`);
  await pool.query(`ALTER TABLE screenings ADD COLUMN IF NOT EXISTS storyline TEXT;`);
  await pool.query(`
    UPDATE screenings s SET
      title = m.title, poster_url = m.poster_url, genre = m.genre, duration = m.duration,
      language = m.language, year = m.year, imdb_rating = m.imdb_rating,
      pg_tag = m.pg_tag, pg_detail = m.pg_detail, storyline = m.storyline
    FROM movies m WHERE s.movie_id = m.id AND s.title IS NULL
  `).catch(() => {});
}

async function getSetting(key, fallback) {
  const r = await pool.query('SELECT value FROM settings WHERE key = $1', [key]);
  return r.rows[0] ? r.rows[0].value : fallback;
}
async function setSetting(key, value) {
  await pool.query(
    'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
    [key, value]
  );
}

app.get('/api/admin/users', requireAdmin, h(async (req, res) => {
  const result = await pool.query('SELECT reg_no, name, is_admin, is_banned FROM users ORDER BY name ASC');
  res.json(result.rows.map(u => ({ email: u.reg_no, name: u.name, isAdmin: !!u.is_admin, banned: !!u.is_banned })));
}));

app.post('/api/admin/users/ban', requireAdmin, h(async (req, res) => {
  const { email } = req.body;
  const target = await pool.query('SELECT * FROM users WHERE reg_no = $1', [email]);
  if (!target.rows[0]) return res.status(404).json({ error: 'No account with that email.' });
  if (target.rows[0].is_admin) return res.status(400).json({ error: "Admin accounts can't be banned." });
  await pool.query('UPDATE users SET is_banned = 1, banned_at = $1 WHERE reg_no = $2', [Date.now(), email]);
  res.json({ ok: true });
}));

app.post('/api/admin/users/unban', requireAdmin, h(async (req, res) => {
  await pool.query('UPDATE users SET is_banned = 0, banned_at = NULL WHERE reg_no = $1', [req.body.email]);
  res.json({ ok: true });
}));

app.get('/api/banned-notice', h(async (req, res) => {
  const on = (await getSetting('ban_popups', 'off')) === 'on';
  let names = [];
  if (on) {
    const r = await pool.query('SELECT name FROM users WHERE is_banned = 1 ORDER BY banned_at DESC');
    names = r.rows.map(u => u.name);
  }
  res.json({ on, names });
}));

app.post('/api/admin/ban-popups', requireAdmin, h(async (req, res) => {
  await setSetting('ban_popups', req.body.on ? 'on' : 'off');
  res.json({ ok: true });
}));

app.get('/api/notice', h(async (req, res) => {
  res.json({ on: (await getSetting('notice_on', 'off')) === 'on', message: await getSetting('notice_message', '') });
}));

app.post('/api/admin/notice', requireAdmin, h(async (req, res) => {
  const { on, message } = req.body;
  if (on !== undefined) await setSetting('notice_on', on ? 'on' : 'off');
  if (message !== undefined) await setSetting('notice_message', message);
  res.json({ ok: true });
}));

app.post('/api/presence/ping', requireAuth, h(async (req, res) => {
  await pool.query('UPDATE users SET last_seen = $1 WHERE reg_no = $2', [Date.now(), req.user.regNo]);
  const today = new Date().toISOString().slice(0, 10);
  await pool.query(
    'INSERT INTO daily_visits (visit_date, reg_no) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [today, req.user.regNo]
  );
  res.json({ ok: true });
}));

app.get('/api/admin/presence', requireAdmin, h(async (req, res) => {
  const cutoff = Date.now() - 90 * 1000;
  const onlineResult = await pool.query('SELECT name FROM users WHERE last_seen >= $1 ORDER BY name ASC', [cutoff]);

  const today = new Date().toISOString().slice(0, 10);
  const visitedResult = await pool.query(`
    SELECT u.name FROM daily_visits dv
    JOIN users u ON u.reg_no = dv.reg_no
    WHERE dv.visit_date = $1
    ORDER BY u.name ASC
  `, [today]);

  res.json({
    online: onlineResult.rows.length,
    onlineNames: onlineResult.rows.map(r => r.name),
    visited: visitedResult.rows.length,
    visitedNames: visitedResult.rows.map(r => r.name)
  });
}));

app.get('/api/notice', h(async (req, res) => {
  res.json({ on: (await getSetting('notice_on', 'off')) === 'on', message: await getSetting('notice_message', '') });
}));

app.post('/api/admin/notice', requireAdmin, h(async (req, res) => {
  const { on, message } = req.body;
  if (on !== undefined) await setSetting('notice_on', on ? 'on' : 'off');
  if (message !== undefined) await setSetting('notice_message', message);
  res.json({ ok: true });
}));

init()
  .then(ensureMaintenanceTable)
  .then(ensureExtraColumns)
  .then(() => {
    app.listen(PORT, () => console.log(`Movie Night API running on http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
