import { useEffect, useRef, useState } from 'react';
import { api, setToken } from '../api';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export default function Auth({ onAuthed }) {
  const [error, setError] = useState('');
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      setError('Google sign-in is not configured yet (missing VITE_GOOGLE_CLIENT_ID).');
      return;
    }

    let cancelled = false;

    function init() {
      if (cancelled || !window.google || !buttonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredential
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'filled_black', size: 'large', shape: 'pill', width: 280
      });
    }

    // The GIS script loads async, so poll briefly until it's ready.
    if (window.google) {
      init();
    } else {
      const interval = setInterval(() => {
        if (window.google) { clearInterval(interval); init(); }
      }, 100);
      setTimeout(() => clearInterval(interval), 8000);
    }

    return () => { cancelled = true; };
  }, []);

  async function handleCredential(response) {
    setError('');
    try {
      const result = await api.googleAuth(response.credential);
      setToken(result.token);
      onAuthed({ regNo: result.email, name: result.name, isAdmin: result.isAdmin });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="auth-screen">
      <h2 className="display">Saturday Night Cinema</h2>
      <p className="sub">Sign in with your Google account to vote, suggest, and rate movies.</p>
      <div className="card" style={{ display: 'flex', justifyContent: 'center', padding: '28px 22px' }}>
        <div ref={buttonRef}></div>
      </div>
      {error && <p className="error-text" style={{ textAlign: 'center' }}>{error}</p>}
    </div>
  );
}
