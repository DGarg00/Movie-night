import { useEffect, useState } from 'react';
import { api } from '../api';
import MovieTicket from './MovieTicket';

export default function VoteView({ showToast, user }) {
  const [poll, setPoll] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hoveredMovieId, setHoveredMovieId] = useState(null);

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

  async function adjustVotes(movieId, movieTitle) {
    const input = window.prompt(`Increase votes for "${movieTitle}" by how many?`);
    if (input === null) return;
    const amount = Number(input);
    if (!Number.isInteger(amount) || amount <= 0) {
      showToast('Enter a positive whole number');
      return;
    }
    try {
      await api.adjustVotes(movieId, amount);
      showToast(`Added ${amount} vote${amount === 1 ? '' : 's'} to ${movieTitle}`);
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
        const voters = (poll.voterNames && poll.voterNames[m.id]) || [];

       return (
          <div key={m.id} style={{ position: 'relative' }}>
            <MovieTicket movie={m}>
              <div className="vote-row">
                <button
                  className={`btn btn-vote ${votedForThis ? 'voted' : ''}`}
                  onClick={() => vote(m.id)}
                >
                  {votedForThis ? '✓ Your pick (tap to undo)' : 'Vote for this'}
                </button>
                <div
                  className="vote-bar-wrap"
                  style={{ cursor: voters.length ? 'pointer' : 'default' }}
                  onMouseEnter={() => voters.length && setHoveredMovieId(m.id)}
                  onMouseLeave={() => setHoveredMovieId(null)}
                >
                  <div className="vote-bar-track"><div className="vote-bar-fill" style={{ width: `${pct}%` }} /></div>
                  <div className="vote-count">{count} vote{count === 1 ? '' : 's'} · {pct}%</div>
                </div>
              </div>
            </MovieTicket>

            {/* Rendered outside MovieTicket on purpose — the ticket card clips
                overflow for its notch/perforation look, which was hiding this. */}
            {hoveredMovieId === m.id && (
              <div className="online-list-popover vote-names-popover">
                {voters.map((n, i) => <div key={i}>{n}</div>)}
              </div>
            )}

            {user?.isAdmin && (
              <button
                className="btn btn-ghost manual-vote-btn"
                onClick={() => adjustVotes(m.id, m.title)}
                title="Manually increase votes"
              >
                +
              </button>
            )}
          </div>
        );
      })}
    </section>
  );
}
