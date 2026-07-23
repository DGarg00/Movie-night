import { useEffect, useState } from 'react';
import { api } from '../api';
import MovieTicket from './MovieTicket';

export default function VoteView({ showToast }) {
  const [poll, setPoll] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const data = await api.getPoll();
    setPoll(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function vote(movieId) {
    try {
      if (poll.myVote === movieId) {
        await api.unvote();
        showToast('Vote removed');
      } else {
        await api.vote(movieId);
        showToast('Vote counted!');
      }
      load();
    } catch (err) {
      showToast(err.message);
    }
  }

  if (loading) return null;

  const totalVotes = Object.values(poll.votes || {}).reduce((a, b) => a + b, 0);

  return (
    <section>
      <div className="section-head">
        <div className="dot"></div>
        <h2>Vote For Next Saturday</h2>
        <div className="sub">{totalVotes ? `${totalVotes} vote${totalVotes === 1 ? '' : 's'} so far` : ''}</div>
      </div>

      {!poll.nominees.length && (
        <div className="empty">
          <span className="display">No nominees yet</span>
          Check back once the admins line up this week's picks.
        </div>
      )}

      {poll.nominees.map(m => {
        const count = poll.votes[m.id] || 0;
        const pct = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
        const votedForThis = poll.myVote === m.id;
        return (
          <MovieTicket key={m.id} movie={m}>
            <div className="vote-row">
              <button
                className={`btn btn-vote ${votedForThis ? 'voted' : ''}`}
                onClick={() => vote(m.id)}
              >
                {votedForThis ? '✓ Your pick (Tap to undo)' : 'Vote for this'}
              </button>
              <div className="vote-bar-wrap">
                <div className="vote-bar-track"><div className="vote-bar-fill" style={{ width: `${pct}%` }} /></div>
                <div className="vote-count">{count} vote{count === 1 ? '' : 's'} · {pct}%</div>
              </div>
            </div>
          </MovieTicket>
        );
      })}
    </section>
  );
}
