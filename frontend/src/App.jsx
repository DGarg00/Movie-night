import { useEffect, useRef, useState } from 'react';
import { api, getToken, setToken, clearToken } from './api';
import Auth from './components/Auth';
import VoteView from './components/VoteView';
import SuggestView from './components/SuggestView';
import FeedbackView from './components/FeedbackView';
import OldMovies from './components/OldMovies';
import AdminView from './components/AdminView';

export default function App() {
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [tab, setTab] = useState('vote');
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);

  const [showAdminClaim, setShowAdminClaim] = useState(false);
  const [adminCode, setAdminCode] = useState('');
  const [claimError, setClaimError] = useState('');

  useEffect(() => {
    (async () => {
      if (getToken()) {
        try {
          const me = await api.me();
          setUser(me);
        } catch {
          clearToken();
        }
      }
      setCheckingSession(false);
    })();
  }, []);

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2200);
  }

  function logout() {
    clearToken();
    setUser(null);
  }

  async function claimAdmin(e) {
    e.preventDefault();
    setClaimError('');
    try {
      const result = await api.claimAdmin(adminCode.trim());
      setToken(result.token);
      setUser(u => ({ ...u, isAdmin: true }));
      setShowAdminClaim(false);
      setAdminCode('');
      showToast("You're an admin now!");
    } catch (err) {
      setClaimError(err.message);
    }
  }

  if (checkingSession) return null;
  if (!user) return <Auth onAuthed={setUser} />;

  const tabs = [
    { id: 'vote', label: 'Next Saturday' },
    { id: 'suggest', label: 'Suggest a Movie' },
    { id: 'feedback', label: 'Feedback' },
    { id: 'old', label: 'Old Movies' },
    ...(user.isAdmin ? [{ id: 'admin', label: 'Admin' }] : [])
  ];

  return (
    <>
      <div className="marquee">
        <div className="bulbs">
          {Array.from({ length: 7 }).map((_, i) => <div className="bulb" key={i}></div>)}
        </div>
        <h1 className="display">Movie Committee - NDG</h1>
        <p>Pick it. Suggest it. Rate it.</p>
        <div className="who">
          {user.name} ({user.regNo}){user.isAdmin ? ' · admin' : ''}
          {!user.isAdmin && (
            <button onClick={() => setShowAdminClaim(s => !s)} style={{ marginLeft: 8 }}>
              I'm an organizer
            </button>
          )}
          <button onClick={logout}>Log out</button>
        </div>
        {showAdminClaim && (
          <form onSubmit={claimAdmin} style={{ marginTop: 10, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              value={adminCode}
              onChange={e => setAdminCode(e.target.value)}
              placeholder="Enter admin code"
              style={{ maxWidth: 200 }}
            />
            <button type="submit" className="btn btn-primary" style={{ padding: '8px 16px', fontSize: 12 }}>Unlock Admin</button>
          </form>
        )}
        {claimError && <p className="error-text" style={{ textAlign: 'center', marginTop: 6 }}>{claimError}</p>}
      </div>

      <nav>
        {tabs.map(t => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      <main>
        {tab === 'vote' && <VoteView showToast={showToast} />}
        {tab === 'suggest' && <SuggestView showToast={showToast} user={user} />}
        {tab === 'feedback' && <FeedbackView showToast={showToast} user={user} />}
        {tab === 'old' && <OldMovies />}
        {tab === 'admin' && user.isAdmin && <AdminView showToast={showToast} />}
      </main>

      <footer>Built for movie nights, one Saturday at a time.</footer>
      <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
    </>
  );
}
