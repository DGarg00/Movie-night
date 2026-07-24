import { useEffect, useState } from 'react';
import { api } from '../api';

const emptyForm = {
  title: '', genre: '', duration: '', language: '', year: '',
  rating: '', pgTag: 'mild', pgDetail: '', storyline: ''
};

const RESET_SCOPES = [
  { id: 'poll', label: 'Reset Poll / Votes', desc: 'Clears this week\'s nominees and votes. Movie library stays.' },
  { id: 'suggestions', label: 'Reset Suggestions', desc: 'Deletes all suggestions & votes, and gives everyone their suggestion back.' },
  { id: 'history', label: 'Reset Old Movies & Ratings', desc: 'Wipes the Old Movies history and all feedback/ratings.' },
  { id: 'movies', label: 'Reset Movie Library', desc: 'Deletes every movie, plus anything that depends on them (poll, history, feedback).' },
  { id: 'everything', label: 'Reset Everything', desc: "Wipes all of the above. Doesn't delete anyone's login." }
];

export default function AdminView({ showToast }) {
  const [movies, setMovies] = useState([]);
  const [poll, setPoll] = useState(null);
  const [lastMovie, setLastMovie] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [loadError, setLoadError] = useState('');

  const [form, setForm] = useState(emptyForm);
  const [posterUrl, setPosterUrl] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [checkedNominees, setCheckedNominees] = useState([]);
  
  const [lastMovieSelect, setLastMovieSelect] = useState('');
  const [shownDate, setShownDate] = useState(new Date().toISOString().slice(0, 10));
  const [resetEmail, setResetEmail] = useState('');
  const [maintenanceOn, setMaintenanceOn] = useState(false);

  async function loadAll() {
    setLoadError('');
    try {
      const [mRes, pRes, lmRes, sRes, maintRes] = await Promise.allSettled([
        api.getMovies(), api.getPoll(), api.getLastMovie(), api.getSuggestions(), api.getMaintenance()
      ]);

      if (mRes.status === 'fulfilled') setMovies(mRes.value);
      if (pRes.status === 'fulfilled') {
        setPoll(pRes.value);
        setCheckedNominees(pRes.value.nominees.map(n => n.id));
      }
      if (lmRes.status === 'fulfilled') {
        setLastMovie(lmRes.value);
        setLastMovieSelect('');
      }
      if (sRes.status === 'fulfilled') setSuggestions(sRes.value.suggestions);
      if (maintRes.status === 'fulfilled') setMaintenanceOn(maintRes.value.on);

      const failed = [mRes, pRes, lmRes, sRes].find(r => r.status === 'rejected');
      if (failed) setLoadError(failed.reason?.message || 'Some data could not be loaded.');
      if (pRes.status !== 'fulfilled' && !poll) setPoll({ nominees: [] });
    } catch (err) {
      setLoadError(err.message || 'Could not load the admin panel.');
      setPoll(p => p || { nominees: [] });
    }
  }
  useEffect(() => { loadAll(); }, []);

  function updateField(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function saveMovie() {
    if (!form.title.trim()) { showToast('Title is required'); return; }
    if (editingId) {
      await api.updateMovie(editingId, { ...form, posterUrl: posterUrl.trim() });
      showToast('Movie updated');
    } else {
      await api.addMovie({ ...form, posterUrl: posterUrl.trim() });
      showToast('Movie added to library');
    }
    setForm(emptyForm);
    setPosterUrl('');
    setEditingId(null);
    loadAll();
  }

  function startEdit(m) {
    setForm({
      title: m.title || '',
      genre: m.genre || '',
      duration: m.duration ?? '',
      language: m.language || '',
      year: m.year ?? '',
      rating: m.rating ?? '',
      pgTag: m.pgTag || 'mild',
      pgDetail: m.pgDetail || '',
      storyline: m.storyline || ''
    });
    setPosterUrl(m.poster || '');
    setEditingId(m.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setForm(emptyForm);
    setPosterUrl('');
    setEditingId(null);
  }

  async function deleteMovie(id) {
    await api.deleteMovie(id);
    if (editingId === id) cancelEdit();
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
    await api.setLastMovie(Number(lastMovieSelect), shownDate);
    showToast('Saved — this movie is now open for ratings, and it will also appear in Old Movies');
    loadAll();
  }

  async function removeSuggestion(id) {
    await api.deleteSuggestion(id);
    loadAll();
  }

  async function resetOnePersonLimit() {
    if (!resetEmail.trim()) { showToast('Enter their email first'); return; }
    await api.resetSuggestionLimit(resetEmail.trim());
    showToast(`Suggestion limit reset for ${resetEmail.trim()}`);
    setResetEmail('');
    loadAll();
  }

  async function resetEveryoneLimit() {
    if (!window.confirm('Reset the suggestion limit for every user?')) return;
    await api.resetSuggestionLimit(null);
    showToast('Suggestion limit reset for everyone');
    loadAll();
  }

  async function runReset(scope, label) {
    if (!window.confirm(`Are you sure? "${label}" cannot be undone.`)) return;
    await api.adminReset(scope);
    showToast(`${label} — done`);
    loadAll();
  }

  async function toggleMaintenance() {
    const next = !maintenanceOn;
    await api.setMaintenance(next);
    setMaintenanceOn(next);
    showToast(next ? 'Site is now down for everyone except admins' : 'Site is back up for everyone');
  }

  if (!poll) return null;

  return (
    <section>
      {loadError && (
        <div className="empty" style={{ marginBottom: 20, textAlign: 'left', padding: '16px 20px' }}>
          <strong style={{ color: 'var(--red)' }}>Some data didn't load:</strong> {loadError}{' '}
          <button className="btn btn-ghost" style={{ marginLeft: 10 }} onClick={loadAll}>Retry</button>
        </div>
      )}
      <div className="section-head"><div className="dot"></div><h2 style={{ fontSize: 22 }}>{editingId ? 'Edit Movie' : 'Add A Movie'}</h2></div>
      <div className="card">
        <label>Title</label>
        <input type="text" value={form.title} onChange={e => updateField('title', e.target.value)} placeholder="Inception" />

        <label>Poster / Logo Image URL</label>
        <input type="text" value={posterUrl} onChange={e => setPosterUrl(e.target.value)} placeholder="https://image.tmdb.org/t/p/w500/....jpg" />
        <small className="hint">
          Use a <strong>direct image link</strong>, not a webpage link — it must end in something like .jpg/.png/.webp.
          Test it first: paste the link in a new browser tab; if you see just the picture (nothing else), it'll work here.
          Google Images and IMDb page links usually don't work directly — right-click the actual poster image and choose
          "Copy image address", or use a site built for this like image.tmdb.org.
        </small>

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
        <button className="btn btn-primary" onClick={saveMovie}>{editingId ? 'Update Movie' : 'Add To Library'}</button>
        {editingId && <button className="btn btn-ghost" style={{ marginLeft: 8 }} onClick={cancelEdit}>Cancel Edit</button>}
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
            <button className="btn btn-ghost" onClick={() => startEdit(m)}>Edit</button>
            <button className="btn btn-ghost" style={{ marginLeft: 8 }} onClick={() => deleteMovie(m.id)}>Remove</button>
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
        <small className="hint">
          This creates a new entry in "Old Movies" and opens ratings for it. Past screenings and their ratings stay in history.
        </small>
        {lastMovie && lastMovie.movie && (
          <p style={{ fontSize: 12.5, color: 'var(--slate)', marginBottom: 10 }}>
            Currently open for ratings: <strong style={{ color: 'var(--cream)' }}>{lastMovie.movie.title}</strong>
            {lastMovie.shownDate ? ` (shown ${lastMovie.shownDate})` : ''}
          </p>
        )}
        <div className="grid2">
          <div>
            <label>Movie</label>
            <select value={lastMovieSelect} onChange={e => setLastMovieSelect(e.target.value)}>
              <option value="">— Select a movie —</option>
              {movies.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
          </div>
          <div>
            <label>Date shown</label>
            <input type="date" value={shownDate} onChange={e => setShownDate(e.target.value)} />
          </div>
        </div>
        <button className="btn btn-primary" onClick={saveLastMovie}>Save &amp; Open For Ratings</button>
      </div>

      <div className="section-head" style={{ marginTop: 34 }}><div className="dot"></div><h2 style={{ fontSize: 22 }}>Suggestions From Everyone</h2></div>
      <div className="card">
        <div className="grid2" style={{ marginBottom: 16 }}>
          <div>
            <label>Reset one person's suggestion limit</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} placeholder="their-email@gmail.com" />
              <button className="btn btn-ghost" onClick={resetOnePersonLimit}>Reset</button>
            </div>
          </div>
          <div>
            <label>Or reset it for everyone at once</label>
            <button className="btn btn-ghost" style={{ width: '100%' }} onClick={resetEveryoneLimit}>Reset Everyone's Limit</button>
          </div>
        </div>

        {suggestions.length === 0 && <p style={{ color: 'var(--slate)', fontSize: 13 }}>No suggestions yet.</p>}
        {suggestions.map(s => (
          <div className="movie-lib-row" key={s.id}>
            <div>
              <div className="name">{s.name} <span className="tag">({s.upvotes} up / {s.downvotes} down, by {s.submittedByName})</span></div>
              {s.link && <div className="tag">{s.link}</div>}
              {s.note && <div className="tag">{s.note}</div>}
            </div>
            <button className="btn btn-ghost" onClick={() => removeSuggestion(s.id)}>Remove</button>
          </div>
        ))}
      </div>

      <div className="section-head" style={{ marginTop: 34 }}><div className="dot"></div><h2 style={{ fontSize: 22 }}>Site Access</h2></div>
      <div className="card">
        <p style={{ color: 'var(--slate)', fontSize: 13, marginBottom: 12 }}>
          Turn this on while making changes — everyone except admins sees "Site is down for now" instead of the app.
        </p>
        <button className={`btn ${maintenanceOn ? 'btn-primary' : 'btn-ghost'}`} onClick={toggleMaintenance}>
          {maintenanceOn ? 'Maintenance Mode: ON — Click to turn OFF' : 'Maintenance Mode: OFF — Click to turn ON'}
        </button>
      </div>

      <div className="section-head" style={{ marginTop: 34 }}><div className="dot"></div><h2 style={{ fontSize: 22 }}>Danger Zone — Reset</h2></div>
      <div className="card">
        {RESET_SCOPES.map(r => (
          <div className="movie-lib-row" key={r.id}>
            <div>
              <div className="name">{r.label}</div>
              <div className="tag">{r.desc}</div>
            </div>
            <button className="btn btn-ghost" onClick={() => runReset(r.id, r.label)}>Reset</button>
          </div>
        ))}
      </div>
    </section>
  );
}
