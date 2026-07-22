import { useEffect, useRef, useState } from 'react';
import { api, getToken, clearToken } from './api';
import Auth from './components/Auth';
import VoteView from './components/VoteView';
import SuggestView from './components/SuggestView';
import FeedbackView from './components/FeedbackView';
import AdminView from './components/AdminView';

export default function App() {
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [tab, setTab] = useState('vote');
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);

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

  if (checkingSession) return null;
  if (!user) return <Auth onAuthed={setUser} />;

  const tabs = [
    { id: 'vote', label: 'Next Saturday' },
    { id: 'suggest', label: 'Suggest' },
    { id: 'feedback', label: 'Feedback' },
    ...(user.isAdmin ? [{ id: 'admin', label: 'Admin' }] : [])
  ];

  return (
    <>
      <div className="marquee">
        <div className="bulbs">
          {Array.from({ length: 7 }).map((_, i) => <div className="bulb" key={i}></div>)}
        </div>
        <h1 className="display">MC - NDG Movie Committee</h1>
        <p>Pick it. Suggest it. Rate it.</p>
        <div className="who">
          {user.name} ({user.regNo}){user.isAdmin ? ' · admin' : ''}
          <button onClick={logout}>Log out</button>
        </div>
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
        {tab === 'suggest' && <SuggestView showToast={showToast} />}
        {tab === 'feedback' && <FeedbackView showToast={showToast} />}
        {tab === 'admin' && user.isAdmin && <AdminView showToast={showToast} />}
      </main>

      <footer>Built for movie nights, one Saturday at a time.</footer>
      <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
    </>
  );
}
