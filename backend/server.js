require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const { pool, init } = require('./db');
const { makeToken, requireAuth, requireAdmin } = require('./auth');

const app = express();
const PORT = process.env.PORT || 4000;
const ADMIN_SIGNUP_CODE = process.env.ADMIN_SIGNUP_CODE || 'reel2026';

app.use(cors());
app.use(express.json());

// Simple wrapper so every route can just `await` and let this catch errors
function h(fn) {
  return (req, res) => fn(req, res).catch(err => {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on the server.' });
  });
}

// =====================================================================
// AUTH
// =====================================================================

app.post('/api/auth/register', h(async (req, res) => {
  const { regNo, name, password, adminCode } = req.body;
  if (!regNo || !name || !password) {
    return res.status(400).json({ error: 'Reg no, name, and password are required.' });
  }
  const existing = await pool.query('SELECT * FROM users WHERE reg_no = $1', [regNo.trim()]);
  if (existing.rows.length) return res.status(409).json({ error: 'This reg no is already registered. Try logging in.' });

  const isAdmin = adminCode && adminCode === ADMIN_SIGNUP_CODE ? 1 : 0;
  const hash = bcrypt.hashSync(password, 10);
  await pool.query(
    'INSERT INTO users (reg_no, name, password_hash, is_admin, created_at) VALUES ($1, $2, $3, $4, $5)',
    [regNo.trim(), name.trim(), hash, isAdmin, Date.now()]
  );

  const result = await pool.query('SELECT * FROM users WHERE reg_no = $1', [regNo.trim()]);
  const user = result.rows[0];
  res.json({ token: makeToken(user), name: user.name, isAdmin: !!user.is_admin });
}));

app.post('/api/auth/login', h(async (req, res) => {
  const { regNo, password } = req.body;
  const result = await pool.query('SELECT * FROM users WHERE reg_no = $1', [(regNo || '').trim()]);
  const user = result.rows[0];
  if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
    return res.status(401).json({ error: 'Reg no or password is incorrect.' });
  }
  res.json({ token: makeToken(user), name: user.name, isAdmin: !!user.is_admin });
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

app.delete('/api/movies/:id', requireAdmin, h(async (req, res) => {
  await pool.query('DELETE FROM movies WHERE id = $1', [req.params.id]);
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
    SELECT movie_id, COUNT(*) c FROM votes WHERE poll_id = $1 GROUP BY movie_id
  `, [poll.id]);
  const votes = {};
  voteCounts.rows.forEach(v => { votes[v.movie_id] = Number(v.c); });

  const myVoteRow = await pool.query('SELECT movie_id FROM votes WHERE poll_id = $1 AND reg_no = $2', [poll.id, req.user.regNo]);

  res.json({
    nominees: nomineeRows.rows.map(serializeMovie),
    votes,
    myVote: myVoteRow.rows[0] ? myVoteRow.rows[0].movie_id : null
  });
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

// Admin sets this week's nominees -> starts a fresh poll (old votes stay archived under the old poll id)
app.post('/api/poll/nominees', requireAdmin, h(async (req, res) => {
  const { movieIds } = req.body;
  if (!Array.isArray(movieIds) || movieIds.length < 2) {
    return res.status(400).json({ error: 'Pick at least 2 movies.' });
  }
  await pool.query('UPDATE polls SET is_active = 0 WHERE is_active = 1');
  const info = await pool.query('INSERT INTO polls (is_active, created_at) VALUES (1, $1) RETURNING id', [Date.now()]);
  const pollId = info.rows[0].id;
  for (const id of movieIds) {
    await pool.query('INSERT INTO poll_nominees (poll_id, movie_id) VALUES ($1, $2)', [pollId, id]);
  }
  res.json({ ok: true });
}));

// =====================================================================
// SUGGESTIONS
// =====================================================================

app.get('/api/suggestions', requireAuth, h(async (req, res) => {
  const result = await pool.query(`
    SELECT s.*, COUNT(su.reg_no) as upvotes,
      MAX(CASE WHEN su.reg_no = $1 THEN 1 ELSE 0 END) as my_upvote
    FROM suggestions s
    LEFT JOIN suggestion_upvotes su ON su.suggestion_id = s.id
    GROUP BY s.id
    ORDER BY upvotes DESC, s.created_at DESC
  `, [req.user.regNo]);

  res.json(result.rows.map(r => ({
    id: r.id, name: r.name, link: r.link, note: r.note,
    upvotes: Number(r.upvotes), upvotedByMe: !!Number(r.my_upvote), submittedBy: r.reg_no
  })));
}));

app.post('/api/suggestions', requireAuth, h(async (req, res) => {
  const { name, link, note } = req.body;
  if (!name) return res.status(400).json({ error: 'Movie name is required.' });
  await pool.query('INSERT INTO suggestions (reg_no, name, link, note, created_at) VALUES ($1, $2, $3, $4, $5)',
    [req.user.regNo, name, link || null, note || null, Date.now()]);
  res.json({ ok: true });
}));

app.post('/api/suggestions/:id/upvote', requireAuth, h(async (req, res) => {
  const id = req.params.id;
  const existing = await pool.query('SELECT 1 FROM suggestion_upvotes WHERE suggestion_id = $1 AND reg_no = $2', [id, req.user.regNo]);
  if (existing.rows.length) {
    await pool.query('DELETE FROM suggestion_upvotes WHERE suggestion_id = $1 AND reg_no = $2', [id, req.user.regNo]);
  } else {
    await pool.query('INSERT INTO suggestion_upvotes (suggestion_id, reg_no) VALUES ($1, $2)', [id, req.user.regNo]);
  }
  res.json({ ok: true });
}));

app.delete('/api/suggestions/:id', requireAdmin, h(async (req, res) => {
  await pool.query('DELETE FROM suggestions WHERE id = $1', [req.params.id]);
  await pool.query('DELETE FROM suggestion_upvotes WHERE suggestion_id = $1', [req.params.id]);
  res.json({ ok: true });
}));

// =====================================================================
// LAST SHOWN MOVIE + FEEDBACK
// =====================================================================

app.get('/api/last-movie', requireAuth, h(async (req, res) => {
  const rowResult = await pool.query('SELECT * FROM last_movie WHERE id = 1');
  const row = rowResult.rows[0];
  if (!row.movie_id) return res.json({ movie: null });

  const movieResult = await pool.query('SELECT * FROM movies WHERE id = $1', [row.movie_id]);
  const feedbackResult = await pool.query('SELECT * FROM feedback WHERE movie_id = $1 ORDER BY created_at DESC', [row.movie_id]);
  const feedback = feedbackResult.rows;
  const avg = feedback.length ? feedback.reduce((a, f) => a + f.rating, 0) / feedback.length : 0;
  const mine = feedback.find(f => f.reg_no === req.user.regNo);

  res.json({
    movie: serializeMovie(movieResult.rows[0]),
    feedback: feedback.map(f => ({ rating: f.rating, comment: f.comment, createdAt: Number(f.created_at) })),
    average: avg,
    myFeedback: mine ? { rating: mine.rating, comment: mine.comment } : null
  });
}));

app.post('/api/last-movie', requireAdmin, h(async (req, res) => {
  const { movieId } = req.body;
  await pool.query('UPDATE last_movie SET movie_id = $1, set_at = $2 WHERE id = 1', [movieId, Date.now()]);
  await pool.query('DELETE FROM feedback WHERE movie_id != $1', [movieId]); // keep it simple: only current movie's feedback matters
  res.json({ ok: true });
}));

app.post('/api/feedback', requireAuth, h(async (req, res) => {
  const { rating, comment } = req.body;
  const rowResult = await pool.query('SELECT * FROM last_movie WHERE id = 1');
  const row = rowResult.rows[0];
  if (!row.movie_id) return res.status(400).json({ error: 'No movie has been marked as shown yet.' });
  if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be 1-5.' });

  try {
    await pool.query('INSERT INTO feedback (movie_id, reg_no, rating, comment, created_at) VALUES ($1, $2, $3, $4, $5)',
      [row.movie_id, req.user.regNo, rating, comment || null, Date.now()]);
  } catch (e) {
    return res.status(409).json({ error: 'You already rated this movie.' });
  }
  res.json({ ok: true });
}));

init()
  .then(() => {
    app.listen(PORT, () => console.log(`Movie Night API running on http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
