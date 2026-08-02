import { useEffect, useState } from 'react';
import { api } from '../api';
import Collapsible from './Collapsible';

const emptyForm = {
  title: '', genre: '', duration: '', language: '', year: '',
  rating: '', pgTag: 'mild', pgDetail: '', storyline: ''
};

const RESET_SCOPES = [
  { id: 'poll', label: 'Reset Poll / Votes', desc: 'Clears this week\'s nominees and votes. Movie library stays.' },
  { id: 'suggestions', label: 'Reset Suggestions', desc: 'Deletes all suggestions & votes, and gives everyone their suggestion back.' },
  { id: 'feedback', label: 'Reset Feedback', desc: 'Wipes every rating/comment ever left, but keeps the Old Movies entries themselves.' },
  { id: 'movies', label: 'Reset Movie Library', desc: 'Deletes every movie from the library. Old Movies history is untouched.' },
  { id: 'history', label: 'Reset Old Movies & Ratings', desc: 'The only option that actually deletes Old Movies entries themselves.' },
  { id: 'everything', label: 'Reset Everything', desc: "Wipes movies, poll, and suggestions — Old Movies history is kept permanently." }
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

  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [banPopupsOn, setBanPopupsOn] = useState(false);

  const [noticeOn, setNoticeOn] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState('');

  async function loadAll() {
    setLoadError('');
    try {
      const [mRes, pRes, lmRes, sRes, maintRes, uRes, bpRes, nRes] = await Promise.allSettled([
        api.getMovies(), api.getPoll(), api.getLastMovie(), api.getSuggestions(), api.getMaintenance(),
        api.getUsers(), api.getBannedNotice(), api.getNotice()
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
      if (uRes.status === 'fulfilled') setUsers(uRes.value);
      if (bpRes.status === 'fulfilled') setBanPopupsOn(bpRes.value.on);
      if (nRes.status === 'fulfilled') {
        setNoticeOn(nRes.value.on);
        setNoticeMessage(nRes.value.message || '');
      }

      const failed = [mRes, pRes, lmRes, sRes].find(r => r.status === 'rejected');
      if (failed) setLoadError(failed.reason?.message || 'Some data could not be loaded.');
      if (pRes.status !== 'fulfilled' && !poll) setPoll({ nominees: [] });
    } catch (err) {
      setLoadError(err.message || 'Could not load the admin panel.');
      setPoll(p => p || { nominees: [] });
    }
  }
  useEffect(() => { loadAll(); }, []);

  async function toggleBan(u) {
    if (!u.banned && !window.confirm(`Ban ${u.name} (${u.email})? They won't be able to sign back in until you unban them.`)) return;
    try {
      if (u.banned) await api.unbanUser(u.email);
      else await api.banUser(u.email);
      setUsers(prev => prev.map(x => x.email === u.email ? { ...x, banned: !u.banned } : x));
      showToast(u.banned ? `${u.name} unbanned` : `${u.name} banned`);
    } catch (err) {
      showToast(err.message || 'Could not update that account');
    }
  }

  async function toggleBanPopups() {
    const next = !banPopupsOn;
    try {
      await api.setBanPopups(next);
      setBanPopupsOn(next);
      showToast(next ? 'Ban pop-ups turned on for everyone' : 'Ban pop-ups turned off');
    } catch (err) {
      showToast(err.message || 'Could not change that setting');
    }
  }

  async function toggleNoticeOn() {
    const next = !noticeOn;
    try {
      await api.updateNotice(next, noticeMessage);
      setNoticeOn(next);
      showToast(next ? 'Notice turned on for everyone' : 'Notice turned off');
    } catch (err) {
      showToast(err.message || 'Could not change that setting');
    }
  }

  async function saveNoticeMessage() {
    try {
      await api.updateNotice(noticeOn, noticeMessage);
      showToast('Notice message saved');
    } catch (err) {
      showToast(err.message || 'Could not save the notice');
    }
  }

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

  async function saveNominees(resetVotes) {
    if (checkedNominees.length < 1) { showToast('Pick at least 1 movie'); return; }
    await api.setNominees(checkedNominees, resetVotes);
    showToast(resetVotes ? 'Nominees saved, votes reset' : 'Nominees saved, existing votes kept');
    loadAll();
  }

  async function clearNominees() {
    if (!window.confirm('Clear everything from Next Saturday? This removes all nominees and votes.')) return;
    await api.adminReset('poll');
    showToast('Next Saturday cleared');
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

      <Collapsible title={editingId ? 'Edit Movie' : 'Add A Movie'} defaultOpen>
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
      </Collapsible>

      <Collapsible title="Movie Library" badge={`${movies.length} movies`}>
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
      </Collapsible>

      <Collapsible title="Set Next Saturday's Nominees">
        <small className="hint">Pick 1 or more movies. Saving resets the current vote count (unless you choose "Keep Votes").</small>
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
        <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={() => saveNominees(false)}>Save Nominees (Keep Votes)</button>
          <button className="btn btn-primary" onClick={() => saveNominees(true)}>Save Nominees &amp; Reset Votes</button>
          <button className="btn btn-ghost" style={{ color: 'var(--red)', borderColor: 'var(--red)' }} onClick={clearNominees}>Clear Next Saturday</button>
        </div>
      </Collapsible>

      <Collapsible title="Mark Last Shown Movie">
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
      </Collapsible>

      <Collapsible title="Suggestions From Everyone" badge={`${suggestions.length} suggestions`}>
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
      </Collapsible>

      <Collapsible title="Manage Users" badge={`${users.length} signed in`}>
        <div className="switch-row">
          <div>
            <div className="name" style={{ marginBottom: 2 }}>Show ban pop-ups</div>
            <div className="tag">When on, everyone who opens the site sees who's been banned.</div>
          </div>
          <button
            type="button"
            className={`switch ${banPopupsOn ? 'on' : ''}`}
            onClick={toggleBanPopups}
            aria-pressed={banPopupsOn}
            aria-label="Toggle ban pop-ups"
          >
            <span className="knob"></span>
          </button>
        </div>

        <input
          type="text"
          value={userSearch}
          onChange={e => setUserSearch(e.target.value)}
          placeholder="Search by name or email…"
          style={{ marginTop: 16, marginBottom: 4 }}
        />

        {users.length === 0 && <p style={{ color: 'var(--slate)', fontSize: 13, marginTop: 10 }}>No one has signed in yet.</p>}

        {users.length > 0 && (
          <div className="user-table" style={{ marginTop: 12 }}>
            <div className="user-table-head">
              <span>Name</span><span>Email</span><span></span>
            </div>
            {users
              .filter(u =>
                u.name.toLowerCase().includes(userSearch.trim().toLowerCase()) ||
                u.email.toLowerCase().includes(userSearch.trim().toLowerCase())
              )
              .map(u => (
                <div className="user-table-row" key={u.email}>
                  <span className="name">{u.name}{u.isAdmin ? <span className="tag" style={{ marginLeft: 6 }}>admin</span> : ''}</span>
                  <span className="tag">{u.email}</span>
                  <button
                    className={`btn ${u.banned ? 'btn-primary' : 'btn-ghost'}`}
                    style={u.banned ? {} : { color: 'var(--red)', borderColor: 'var(--red)' }}
                    onClick={() => toggleBan(u)}
                  >
                    {u.banned ? 'Unban' : 'Ban'}
                  </button>
                </div>
              ))}
          </div>
        )}
      </Collapsible>

      <Collapsible title="Site Notice">
        <div className="switch-row">
          <div>
            <div className="name" style={{ marginBottom: 2 }}>Show notice to everyone</div>
            <div className="tag">When on, anyone opening the site sees this message first, with an OK button.</div>
          </div>
          <button
            type="button"
            className={`switch ${noticeOn ? 'on' : ''}`}
            onClick={toggleNoticeOn}
            aria-pressed={noticeOn}
            aria-label="Toggle site notice"
          >
            <span className="knob"></span>
          </button>
        </div>
        <label style={{ marginTop: 16 }}>Notice message</label>
        <textarea
          value={noticeMessage}
          onChange={e => setNoticeMessage(e.target.value)}
          placeholder="e.g. No movie night this Saturday — resuming next week!"
        />
        <button className="btn btn-primary" onClick={saveNoticeMessage}>Save Message</button>
        <small className="hint" style={{ marginTop: 10 }}>
          You can change this message any time — just edit the text above and click Save. It updates for everyone immediately.
        </small>
      </Collapsible>

      <Collapsible title="Site Access">
        <p style={{ color: 'var(--slate)', fontSize: 13, marginBottom: 12 }}>
          Turn this on while making changes — everyone except admins sees "Site is down for now" instead of the app.
        </p>
        <button className={`btn ${maintenanceOn ? 'btn-primary' : 'btn-ghost'}`} onClick={toggleMaintenance}>
          {maintenanceOn ? 'Maintenance Mode: ON — Click to turn OFF' : 'Maintenance Mode: OFF — Click to turn ON'}
        </button>
      </Collapsible>

      <Collapsible title="Danger Zone — Reset">
        {RESET_SCOPES.map(r => (
          <div className="movie-lib-row" key={r.id}>
            <div>
              <div className="name">{r.label}</div>
              <div className="tag">{r.desc}</div>
            </div>
            <button className="btn btn-ghost" onClick={() => runReset(r.id, r.label)}>Reset</button>
          </div>
        ))}
      </Collapsible>
    </section>
  );
}
