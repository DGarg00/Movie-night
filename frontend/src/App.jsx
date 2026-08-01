import { useEffect, useRef, useState } from 'react';
import { api, getToken, setToken, clearToken } from './api';
import Auth from './components/Auth';
import VoteView from './components/VoteView';
import SuggestView from './components/SuggestView';
import FeedbackView from './components/FeedbackView';
import OldMovies from './components/OldMovies';
import AdminView from './components/AdminView';
import BanPopups from './components/BanPopups';
import AboutUs from './components/AboutUs';
import NoticeBanner from './components/NoticeBanner';

// Render's free tier can go to sleep and the very first request after that
// can be slow or drop — retry a couple of times before giving up, instead
// of silently failing (this was why ban pop-ups sometimes didn't show up).
async function withRetry(fn, attempts = 3, delayMs = 2000) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

export default function App() {
  const [maintenanceOn, setMaintenanceOn] = useState(false);
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [tab, setTab] = useState('vote');
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);
  const [bannedNames, setBannedNames] = useState([]);
  const [notice, setNotice] = useState({ on: false, message: '' });
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const [presence, setPresence] = useState(null);
  const [showOnlineList, setShowOnlineList] = useState(false);
  const [showVisitedList, setShowVisitedList] = useState(false);

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
      try {
        const m = await withRetry(() => api.getMaintenance());
        setMaintenanceOn(m.on);
      } catch {}
      try {
        const n = await withRetry(() => api.getNotice());
        setNotice(n);
      } catch {}
      try {
        const bn = await withRetry(() => api.getBannedNotice());
        if (bn.on && bn.names.length) setBannedNames(bn.names);
      } catch {}
      setCheckingSession(false);
    })();
  }, []);

  // Keep this browser's "last seen" fresh, and (for admins) poll live counts.
  useEffect(() => {
    if (!user) return;
    api.ping().catch(() => {});
    const pingTimer = setInterval(() => api.ping().catch(() => {}), 30000);

    let presenceTimer;
    if (user.isAdmin) {
      api.getPresence().then(setPresence).catch(() => {});
      presenceTimer = setInterval(() => {
        api.getPresence().then(setPresence).catch(() => {});
      }, 20000);
    }
    return () => {
      clearInterval(pingTimer);
      if (presenceTimer) clearInterval(presenceTimer);
    };
  }, [user]);

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

  if (maintenanceOn && (!user || !user.isAdmin)) {
    return (
      <>
        <div className="auth-screen">
          <h2 className="display">Saturday Night Cinema</h2>
          <div className="card" style={{ textAlign: 'center', padding: '30px 22px' }}>
            <p style={{ fontSize: 15, color: 'var(--cream)' }}>Site is down for now. Come again later.</p>
          </div>
        </div>
        <BanPopups names={bannedNames} />
      </>
    );
  }

  if (!user) return <><Auth onAuthed={setUser} /><BanPopups names={bannedNames} /></>;

  const tabs = [
    { id: 'vote', label: 'Next Saturday' },
    { id: 'suggest', label: 'Suggest a Movie' },
    { id: 'feedback', label: 'Feedback' },
    { id: 'old', label: 'Old Movies' },
    { id: 'about', label: 'About Us' },
    ...(user.isAdmin ? [{ id: 'admin', label: 'Admin' }] : [])
  ];

  return (
    <>
      {notice.on && notice.message && !noticeDismissed && (
        <NoticeBanner message={notice.message} onDismiss={() => setNoticeDismissed(true)} />
      )}

      <div className="marquee">
        <div className="bulbs">
          {Array.from({ length: 7 }).map((_, i) => <div className="bulb" key={i}></div>)}
        </div>
        <h1 className="display">Movie Committee - NDG</h1>
        <p>Pick it. Suggest it. Rate it.</p>

        {user.isAdmin && presence && (
          <div className="presence-widget">
            <div
              style={{ position: 'relative', cursor: 'pointer' }}
              onMouseEnter={() => setShowOnlineList(true)}
              onMouseLeave={() => setShowOnlineList(false)}
            >
              <span className="presence-dot presence-dot-online"></span>Online: {presence.online}
              {showOnlineList && (
                <div className="online-list-popover">
                  {presence.onlineNames && presence.onlineNames.length > 0
                    ? presence.onlineNames.map((n, i) => <div key={i}>{n}</div>)
                    : <div style={{ color: 'var(--slate)' }}>No one online</div>}
                </div>
              )}
            </div>
            <div
              style={{ position: 'relative', cursor: 'pointer' }}
              onMouseEnter={() => setShowVisitedList(true)}
              onMouseLeave={() => setShowVisitedList(false)}
            >
              <span className="presence-dot presence-dot-visited"></span>Visited today: {presence.visited}
              {showVisitedList && (
                <div className="online-list-popover">
                  {presence.visitedNames && presence.visitedNames.length > 0
                    ? presence.visitedNames.map((n, i) => <div key={i}>{n}</div>)
                    : <div style={{ color: 'var(--slate)' }}>No one yet today</div>}
                </div>
              )}
            </div>
          </div>
        )}

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
        {tab === 'about' && <AboutUs />}
        {tab === 'admin' && user.isAdmin && <AdminView showToast={showToast} />}
      </main>

      <footer>Built for movie nights, one Saturday at a time.</footer>
      <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
      <BanPopups names={bannedNames} />
    </>
  );
}
