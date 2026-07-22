import { useEffect, useState } from 'react';
import { api } from '../api';

export default function SuggestView({ showToast }) {
  const [suggestions, setSuggestions] = useState([]);
  const [name, setName] = useState('');
  const [link, setLink] = useState('');
  const [note, setNote] = useState('');

  async function load() {
    setSuggestions(await api.getSuggestions());
  }
  useEffect(() => { load(); }, []);

  async function submit() {
    if (!name.trim()) { showToast('Add a movie name first'); return; }
    await api.addSuggestion(name.trim(), link.trim(), note.trim());
    setName(''); setLink(''); setNote('');
    showToast('Suggestion added!');
    load();
  }

  async function upvote(id) {
    await api.toggleUpvote(id);
    load();
  }

  return (
    <section>
      <div className="section-head"><div className="dot"></div><h2>Suggest A Movie</h2></div>
      <div className="card">
        <label>Movie Name</label>
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. The Prestige" />
        <label>Link (IMDb, trailer, anything)</label>
        <input type="url" value={link} onChange={e => setLink(e.target.value)} placeholder="https://..." />
        <label>Why this one? (optional)</label>
        <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="One line is enough" />
        <button className="btn btn-primary" onClick={submit}>Submit Suggestion</button>
      </div>

      <div className="section-head" style={{ marginTop: 34 }}>
        <div className="dot"></div><h2 style={{ fontSize: 22 }}>What Others Suggested</h2>
      </div>

      {!suggestions.length && (
        <div className="empty"><span className="display">Nothing yet</span>Be the first to suggest a movie.</div>
      )}

      {suggestions.map(s => (
        <div className="suggestion" key={s.id}>
          <div className="txt">
            <strong>{s.name}</strong>
            {s.link && <div><a href={s.link} target="_blank" rel="noopener noreferrer">{s.link}</a></div>}
            {s.note && <div className="note">{s.note}</div>}
          </div>
          <div className={`upvote ${s.upvotedByMe ? 'done' : ''}`} onClick={() => upvote(s.id)}>
            <div>▲</div><div>{s.upvotes}</div>
          </div>
        </div>
      ))}
    </section>
  );
}
