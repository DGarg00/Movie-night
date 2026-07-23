const { Pool } = require('pg');

// Supabase (and most managed Postgres providers) require SSL.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost')
    ? false
    : { rejectUnauthorized: false }
});

async function init() {
  // Base tables (fresh installs get the full shape immediately)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      reg_no TEXT PRIMARY KEY, -- holds the person's Google email now (kept the old column name to avoid a risky rename)
      name TEXT NOT NULL,
      password_hash TEXT,
      is_admin INTEGER NOT NULL DEFAULT 0,
      suggestion_allowance INTEGER NOT NULL DEFAULT 1,
      created_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS movies (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      poster_url TEXT,
      genre TEXT,
      duration INTEGER,
      language TEXT,
      year INTEGER,
      imdb_rating REAL,
      pg_tag TEXT DEFAULT 'mild',
      pg_detail TEXT,
      storyline TEXT,
      created_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS polls (
      id SERIAL PRIMARY KEY,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS poll_nominees (
      poll_id INTEGER NOT NULL,
      movie_id INTEGER NOT NULL,
      PRIMARY KEY (poll_id, movie_id)
    );

    CREATE TABLE IF NOT EXISTS votes (
      poll_id INTEGER NOT NULL,
      reg_no TEXT NOT NULL,
      movie_id INTEGER NOT NULL,
      created_at BIGINT NOT NULL,
      PRIMARY KEY (poll_id, reg_no)
    );

    CREATE TABLE IF NOT EXISTS suggestions (
      id SERIAL PRIMARY KEY,
      reg_no TEXT NOT NULL,
      name TEXT NOT NULL,
      link TEXT,
      note TEXT,
      created_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS suggestion_upvotes (
      suggestion_id INTEGER NOT NULL,
      reg_no TEXT NOT NULL,
      PRIMARY KEY (suggestion_id, reg_no)
    );

    CREATE TABLE IF NOT EXISTS suggestion_downvotes (
      suggestion_id INTEGER NOT NULL,
      reg_no TEXT NOT NULL,
      PRIMARY KEY (suggestion_id, reg_no)
    );

    -- One row per "movie night" that actually happened, so history can be kept forever.
    CREATE TABLE IF NOT EXISTS screenings (
      id SERIAL PRIMARY KEY,
      movie_id INTEGER NOT NULL,
      shown_date TEXT NOT NULL, -- 'YYYY-MM-DD'
      created_at BIGINT NOT NULL
    );

    -- Pointer to whichever screening is "current" (the one the Feedback tab shows).
    CREATE TABLE IF NOT EXISTS last_movie (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      screening_id INTEGER,
      set_at BIGINT
    );

    CREATE TABLE IF NOT EXISTS feedback (
      id SERIAL PRIMARY KEY,
      screening_id INTEGER NOT NULL,
      movie_id INTEGER NOT NULL,
      reg_no TEXT NOT NULL,
      rating INTEGER NOT NULL,
      comment TEXT,
      experience TEXT[] NOT NULL DEFAULT '{}',
      created_at BIGINT NOT NULL,
      UNIQUE(screening_id, reg_no)
    );
  `);

  // Migrations for databases created before this schema existed. Safe to re-run every boot.
  await pool.query(`ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS suggestion_allowance INTEGER NOT NULL DEFAULT 1;`);
  await pool.query(`ALTER TABLE last_movie ADD COLUMN IF NOT EXISTS screening_id INTEGER;`);
  await pool.query(`ALTER TABLE feedback ADD COLUMN IF NOT EXISTS screening_id INTEGER;`);
  await pool.query(`ALTER TABLE feedback ADD COLUMN IF NOT EXISTS experience TEXT[] NOT NULL DEFAULT '{}';`);

  // If an old deployment still has the legacy unique(movie_id, reg_no) constraint, replace it
  // with the new unique(screening_id, reg_no) one so re-showing the same movie works.
  await pool.query(`ALTER TABLE feedback DROP CONSTRAINT IF EXISTS feedback_movie_id_reg_no_key;`).catch(() => {});
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'feedback_screening_id_reg_no_key'
      ) THEN
        ALTER TABLE feedback ADD CONSTRAINT feedback_screening_id_reg_no_key UNIQUE (screening_id, reg_no);
      END IF;
    END $$;
  `).catch(() => {});

  const pollCount = await pool.query('SELECT COUNT(*) c FROM polls');
  if (Number(pollCount.rows[0].c) === 0) {
    await pool.query('INSERT INTO polls (is_active, created_at) VALUES (1, $1)', [Date.now()]);
  }
  const lastMovieRow = await pool.query('SELECT * FROM last_movie WHERE id = 1');
  if (lastMovieRow.rows.length === 0) {
    await pool.query('INSERT INTO last_movie (id, screening_id, set_at) VALUES (1, NULL, NULL)');
  }
}

module.exports = { pool, init };
