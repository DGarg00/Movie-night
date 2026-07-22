import { useEffect, useState } from 'react';
import { api } from '../api';

const emptyForm = {
  title: '', genre: '', duration: '', language: '', year: '',
  rating: '', pgTag: 'mild', pgDetail: '', storyline: ''
};

export default function AdminView({ showToast }) {
  const [movies, setMovies] = useState([]);
  const [poll, setPoll] = useState(null);
  const [lastMovie, setLastMovie] = useState(null);
  const [suggestions, setSuggestions] = useState([]);

  const [form, setForm] = useState(emptyForm);
  const [posterUrl, setPosterUrl] = useState('');
  const [checkedNominees, setCheckedNominees] = useState([]);
  const [lastMovieSelect, setLastMovieSelect] = useState('');

  async function loadAll() {
    const [m, p, lm, s] = await Promise.all([
      api.getMovies(), api.getPoll(), api.getLastMovie(), api.getSuggestions()
    ]);
    setMovies(m);
    setPoll(p);
    setCheckedNominees(p.nominees.map(n => n.id));
    setLastMovie(lm);
    setLastMovieSelect(lm.movie ? lm.movie.id : '');
    setSuggestions(s);
  }
  useEffect(() => { loadAll(); }, []);

  function updateField(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function addMovie() {
    if (!form.title.trim()) { showToast('Title is required'); return; }
    await api.addMovie({ ...form, posterUrl: posterUrl.trim() });
    setForm(emptyForm);
    setPosterUrl('');
    showToast('Movie added to library');
    loadAll();
  }

  async function deleteMovie(id) {
    await api.deleteMovie(id);
    showToast('Removed');
    loadAll();
  }

  function toggleNominee(id) {
    setCheckedNominees(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function saveNominees() {
    if (checkedNominees.length < 2) { showToast('Pick at least 2 movies'); return; }
    await api.setNominees(checkedNominees);
    showToast('Nominees saved, votes reset');
    loadAll();
  }

  async function saveLastMovie() {
    if (!lastMovieSelect) { showToast('Select a movie'); return; }
    await api.setLastMovie(Number(lastMovieSelect));
    showToast('Last shown movie updated, feedback reset');
    loadAll();
  }

  async function removeSuggestion(id) {
    await api.deleteSuggestion(id);
    loadAll();
  }

  if (!poll) return null;

  return (
    <section>
      <div className="section-head"><div className="dot"></div><h2 style={{ fontSize: 22 }}>Add A Movie</h2></div>
      <div className="card">
        <label>Title</label>
        <input type="text" value={form.title} onChange={e => updateField('title', e.target.value)} placeholder="Inception" />

        <label>Poster / Logo Image URL</label>
        <input type="text" value={posterUrl} onChange={e => setPosterUrl(e.target.value)} placeholder="https://image.tmdb.org/t/p/w500/....jpg" />
        <small className="hint">Paste a link to the poster image. Tip: right-click a poster on Google Images or IMDb and choose "Copy image address".</small>

        <div className="grid2">
          <div><label>Genre</label><input type="text" value={form.genre} onChange={e => updateField('genre', e.target.value)} placeholder="Sci-fi, Thriller" /></div>
          <div><label>Duration (minutes)</label><input type="number" value={form.duration} onChange={e => updateField('duration', e.target.value)} placeholder="148" /></div>
        </div>
        <div className="grid2">
          <div><label>Original Language</label><input type="text" value={form.language} onChange={e => updateField('language', e.target.value)} placeholder="English" /></div>
          <div><label>Release Year</label><input type="number" value={form.year} onChange={e => updateField('year', e.target.value)} placeholder="2010" /></div>
        </div>
        <div className="grid2">
          <div><label>IMDb Rating</label><input type="number" step="0.1" min="0" max="10" value={form.rating} onChange={e => updateField('rating', e.target.value)} placeholder="8.8" /></div>
          <div>
            <label>Parent's Guide Tag</label>
            <select value={form.pgTag} onChange={e => updateField('pgTag', e.target.value)}>
              <option value="clean">Clean — safe for all</option>
              <option value="mild">Mild content</option>
              <option value="caution">Caution advised</option>
              <option value="strict">Strict screening needed</option>
            </select>
          </div>
        </div>
        <label>Parent's Guide Detail</label>
        <textarea value={form.pgDetail} onChange={e => updateField('pgDetail', e.target.value)} placeholder="e.g. One mild profanity, brief violence, no sexual content" />
        <label>Storyline</label>
        <textarea value={form.storyline} onChange={e => updateField('storyline', e.target.value)} placeholder="Short synopsis, like the one Google shows on the right" />
        <button className="btn btn-primary" onClick={addMovie}>Add To Library</button>
      </div>

      <div className="section-head" style={{ marginTop: 34 }}><div className="dot"></div><h2 style={{ fontSize: 22 }}>Movie Library</h2></div>
      <div className="card">
        {movies.length === 0 && <p style={{ color: 'var(--slate)', fontSize: 13 }}>No movies added yet.</p>}
        {movies.map(m => (
          <div className="movie-lib-row" key={m.id}>
            <div>
              <div className="name">{m.title}</div>
              <div className="tag">{m.year || '—'} · IMDb {m.rating ?? '—'} · {m.language || '—'}</div>
            </div>
            <button className="btn btn-ghost" onClick={() => deleteMovie(m.id)}>Remove</button>
          </div>
        ))}
      </div>

      <div className="section-head" style={{ marginTop: 34 }}><div className="dot"></div><h2 style={{ fontSize: 22 }}>Set Next Saturday's Nominees</h2></div>
      <div className="card">
        <small className="hint">Pick 2–3 movies. Saving resets the current vote count.</small>
        {movies.length === 0 && <p style={{ color: 'var(--slate)', fontSize: 13 }}>Add movies to the library first.</p>}
        {movies.map(m => (
          <div className="checkline" key={m.id}>
            <input
              type="checkbox"
              checked={checkedNominees.includes(m.id)}
              onChange={() => toggleNominee(m.id)}
            />
            <span>{m.title}</span>
          </div>
        ))}
        <div style={{ marginTop: 14 }}>
          <button className="btn btn-primary" onClick={saveNominees}>Save Nominees &amp; Reset Votes</button>
        </div>
      </div>

      <div className="section-head" style={{ marginTop: 34 }}><div className="dot"></div><h2 style={{ fontSize: 22 }}>Mark Last Shown Movie</h2></div>
      <div className="card">
        <small className="hint">Saving this resets the feedback list for the new pick.</small>
        <select value={lastMovieSelect} onChange={e => setLastMovieSelect(e.target.value)}>
          <option value="">— Select a movie —</option>
          {movies.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
        </select>
        <button className="btn btn-primary" onClick={saveLastMovie}>Save Last Shown Movie</button>
      </div>

      <div className="section-head" style={{ marginTop: 34 }}><div className="dot"></div><h2 style={{ fontSize: 22 }}>Suggestions From Everyone</h2></div>
      <div className="card">
        {suggestions.length === 0 && <p style={{ color: 'var(--slate)', fontSize: 13 }}>No suggestions yet.</p>}
        {suggestions.map(s => (
          <div className="movie-lib-row" key={s.id}>
            <div>
              <div className="name">{s.name} <span className="tag">({s.upvotes} upvotes, by {s.submittedBy})</span></div>
              {s.link && <div className="tag">{s.link}</div>}
              {s.note && <div className="tag">{s.note}</div>}
            </div>
            <button className="btn btn-ghost" onClick={() => removeSuggestion(s.id)}>Remove</button>
          </div>
        ))}
      </div>
    </section>
  );
}
