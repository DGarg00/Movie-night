const { Pool } = require('pg');

// Supabase (and most managed Postgres providers) require SSL.
// rejectUnauthorized:false keeps this simple for a class project setup.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost')
    ? false
    : { rejectUnauthorized: false }
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      reg_no TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      is_admin INTEGER NOT NULL DEFAULT 0,
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

    CREATE TABLE IF NOT EXISTS last_movie (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      movie_id INTEGER,
      set_at BIGINT
    );

    CREATE TABLE IF NOT EXISTS feedback (
      id SERIAL PRIMARY KEY,
      movie_id INTEGER NOT NULL,
      reg_no TEXT NOT NULL,
      rating INTEGER NOT NULL,
      comment TEXT,
      created_at BIGINT NOT NULL,
      UNIQUE(movie_id, reg_no)
    );
  `);

  const pollCount = await pool.query('SELECT COUNT(*) c FROM polls');
  if (Number(pollCount.rows[0].c) === 0) {
    await pool.query('INSERT INTO polls (is_active, created_at) VALUES (1, $1)', [Date.now()]);
  }
  const lastMovieRow = await pool.query('SELECT * FROM last_movie WHERE id = 1');
  if (lastMovieRow.rows.length === 0) {
    await pool.query('INSERT INTO last_movie (id, movie_id, set_at) VALUES (1, NULL, NULL)');
  }
}

module.exports = { pool, init };
