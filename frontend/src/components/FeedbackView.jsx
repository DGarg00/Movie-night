import { useEffect, useState } from 'react';
import { api } from '../api';
import MovieTicket from './MovieTicket';

export default function FeedbackView({ showToast }) {
  const [data, setData] = useState(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  async function load() {
    setData(await api.getLastMovie());
  }
  useEffect(() => { load(); }, []);

  async function submit() {
    if (!rating) { showToast('Pick a star rating first'); return; }
    try {
      await api.submitFeedback(rating, comment.trim());
      showToast('Thanks for rating!');
      setComment(''); setRating(0);
      load();
    } catch (err) {
      showToast(err.message);
    }
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
          <p style={{ color: 'var(--gold)', fontSize: 13 }}>You've already rated this one. Thanks!</p>
        ) : (
          <>
            <label>Your Rating</label>
            <div className="stars">
              {[1, 2, 3, 4, 5].map(n => (
                <span key={n} className={`star ${n <= rating ? 'filled' : ''}`} onClick={() => setRating(n)}>★</span>
              ))}
            </div>
            <label>Comment (optional)</label>
            <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="What did you think?" />
            <button className="btn btn-primary" onClick={submit}>Submit Rating</button>
          </>
        )}
      </div>

      {data.feedback.length > 0 && (
        <>
          <div className="section-head" style={{ marginTop: 30 }}>
            <div className="dot"></div><h2 style={{ fontSize: 20 }}>What People Said</h2>
          </div>
          <div className="card">
            {data.feedback.map((f, i) => (
              <div className="feedback-item" key={i}>
                <div className="stars-mini">{'★'.repeat(f.rating)}{'☆'.repeat(5 - f.rating)}</div>
                {f.comment && <div className="comment">{f.comment}</div>}
                <div className="when">{new Date(f.createdAt).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
