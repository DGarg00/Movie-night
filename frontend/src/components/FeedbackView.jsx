import { useEffect, useState } from 'react';
import { api } from '../api';
import MovieTicket from './MovieTicket';

export default function FeedbackView({ showToast, user }) {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [experience, setExperience] = useState([]);

  async function load() {
    setLoadError('');
    try {
      setData(await api.getLastMovie());
    } catch (err) {
      setLoadError(err.message || 'Could not load this section.');
    }
  }
  useEffect(() => { load(); }, []);
  
  function toggleExperience(opt) {
    setExperience(prev => prev.includes(opt) ? prev.filter(x => x !== opt) : [...prev, opt]);
  }

  async function submit() {
    if (!rating) { showToast('Pick a star rating first'); return; }
    try {
      await api.submitFeedback(rating, comment.trim(), experience);
      showToast('Thanks for rating!');
      setComment(''); setRating(0); setExperience([]);
      load();
    } catch (err) {
      showToast(err.message);
    }
  }

  async function removeComment() {
    try {
      await api.removeMyComment();
      showToast('Comment removed');
      load();
    } catch (err) {
      showToast(err.message);
    }
  }

  async function react(id, reaction) {
    try {
      await api.reactFeedback(id, reaction);
      load();
    } catch (err) {
      showToast(err.message);
    }
  }

  async function adminRemoveFeedback(id) {
    try {
      await api.deleteFeedback(id);
      showToast('Feedback removed');
      load();
    } catch (err) {
      showToast(err.message);
    }
  }

  function buildReportText() {
    const lines = [];
    lines.push(`SATURDAY NIGHT CINEMA — FEEDBACK REPORT`);
    lines.push(`Movie: ${data.movie.title}${data.movie.year ? ` (${data.movie.year})` : ''}`);
    if (data.shownDate) lines.push(`Shown on: ${new Date(data.shownDate).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}`);
    lines.push(`Total ratings: ${data.feedback.length}`);
    if (data.feedback.length) lines.push(`Average rating: ${data.average.toFixed(1)} / 5`);
    lines.push('');
    lines.push('--- Individual Responses ---');
    data.feedback.forEach((f, i) => {
      lines.push('');
      lines.push(`${i + 1}. Rating: ${f.rating}/5`);
      if (f.experience && f.experience.length) lines.push(`   Experience: ${f.experience.join('; ')}`);
      if (f.comment) lines.push(`   Comment: ${f.comment}`);
    });
    return lines.join('\n');
  }

  function downloadReport() {
    const blob = new Blob([buildReportText()], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `feedback-${data.movie.title.replace(/\s+/g, '-').toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(buildReportText());
      showToast('Copied to clipboard');
    } catch {
      showToast('Could not copy — try Download instead');
    }
  }

  if (loadError) {
    return (
      <section>
        <div className="section-head"><div className="dot"></div><h2>Rate Last Movie</h2></div>
        <div className="empty">
          <span className="display">Couldn't load this section</span>
          {loadError}
          <div style={{ marginTop: 14 }}>
            <button className="btn btn-primary" onClick={load}>Try Again</button>
          </div>
        </div>
      </section>
    );
  }
  
  if (!data) return null;

  if (!data.movie) {
    return (
      <section>
        <div className="section-head"><div className="dot"></div><h2>Rate Last Movie</h2></div>
        <div className="empty">
          <span className="display">No movie marked yet</span>
          Once the admins mark last Saturday's movie, you can rate it here.
        </div>
      </section>
    );
  }

  const experienceOptions = data.experienceOptions || [];

  return (
    <section>
      <div className="section-head"><div className="dot"></div><h2>Rate Last Movie</h2></div>
      <MovieTicket movie={data.movie} />

      {data.feedback.length > 0 && (
        <div className="avg-badge">
          <span className="num">{data.average.toFixed(1)}</span>
          <span className="lbl">avg / {data.feedback.length} rating{data.feedback.length === 1 ? '' : 's'}</span>
        </div>
      )}

      <div className="card">
        {data.myFeedback ? (
          <>
            <p style={{ color: 'var(--gold)', fontSize: 13 }}>You've already rated this one. Thanks!</p>
            {data.myFeedback.comment !== null && data.myFeedback.comment !== undefined && data.myFeedback.comment !== '' && (
              <div style={{ marginTop: 10 }}>
                <div className="comment" style={{ marginBottom: 8 }}>"{data.myFeedback.comment}"</div>
                <button className="btn btn-ghost" onClick={removeComment}>Remove My Comment</button>
              </div>
            )}
          </>
        ) : (
          <>
            <label>Your Rating</label>
            <div className="stars">
              {[1, 2, 3, 4, 5].map(n => (
                <span key={n} className={`star ${n <= rating ? 'filled' : ''}`} onClick={() => setRating(n)}>★</span>
              ))}
            </div>

            {experienceOptions.length > 0 && (
              <>
                <label style={{ marginTop: 10 }}>Experience (select all that apply)</label>
                {experienceOptions.map(opt => (
                  <div className="checkline" key={opt}>
                    <input
                      type="checkbox"
                      checked={experience.includes(opt)}
                      onChange={() => toggleExperience(opt)}
                    />
                    <span>{opt}</span>
                  </div>
                ))}
              </>
            )}

            <label style={{ marginTop: 10 }}>Comment (optional)</label>
            <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="What did you think?" />
            <button className="btn btn-primary" onClick={submit}>Submit Rating</button>
          </>
        )}
      </div>

      {data.feedback.length > 0 && (
        <>
          <div className="section-head" style={{ marginTop: 30 }}>
            <div className="dot"></div><h2 style={{ fontSize: 20 }}>What People Said</h2>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" onClick={copyReport}>Copy Report</button>
              <button className="btn btn-ghost" onClick={downloadReport}>Download Report</button>
            </div>
          </div>
          <div className="card">
            {data.feedback.map((f, i) => (
              <div className="feedback-item" key={i}>
                <div className="stars-mini">{'★'.repeat(f.rating)}{'☆'.repeat(5 - f.rating)} <span style={{ color: 'var(--slate)', fontFamily: 'Inter', fontWeight: 600, fontSize: 12 }}>— {f.name}</span></div>
                {f.experience && f.experience.length > 0 && (
                  <div className="tag" style={{ marginTop: 4 }}>{f.experience.join(' · ')}</div>
                )}
                {f.comment && <div className="comment">{f.comment}</div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                  <div className="when" style={{ marginRight: 'auto' }}>{new Date(f.createdAt).toLocaleDateString()}</div>
                  <div className={`upvote ${f.myReaction === 'up' ? 'done' : ''}`} onClick={() => react(f.id, 'up')}>
                    <div>👍</div><div>{f.thumbsUp}</div>
                  </div>
                  <div className={`downvote ${f.myReaction === 'down' ? 'done' : ''}`} onClick={() => react(f.id, 'down')}>
                    <div>👎</div><div>{f.thumbsDown}</div>
                  </div>
                  {user?.isAdmin && (
                    <button className="btn btn-ghost" onClick={() => adminRemoveFeedback(f.id)}>Remove</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
