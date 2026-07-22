import { useState } from 'react';
import { api, setToken } from '../api';

export default function Auth({ onAuthed }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [regNo, setRegNo] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = mode === 'login'
        ? await api.login(regNo, password)
        : await api.register(regNo, name, password, adminCode);
      setToken(result.token);
      onAuthed({ regNo, name: result.name, isAdmin: result.isAdmin });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <h2 className="display">Saturday Night Cinema</h2>
      <p className="sub">Sign in with your college reg number.</p>
      <div className="auth-toggle">
        <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Log In</button>
        <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>Register</button>
      </div>
      <form onSubmit={submit} className="card" style={{ textAlign: 'left' }}>
        <label>College Reg No.</label>
        <input type="text" value={regNo} onChange={e => setRegNo(e.target.value)} placeholder="e.g. 1RV21CS001" required />

        {mode === 'register' && (
          <>
            <label>Full Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" required />
          </>
        )}

        <label>Password</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Choose a password" required minLength={4} />

        {mode === 'register' && (
          <>
            <label>Admin Code (only for the organizers, leave blank otherwise)</label>
            <input type="text" value={adminCode} onChange={e => setAdminCode(e.target.value)} placeholder="Optional" />
          </>
        )}

        <p className="error-text">{error}</p>
        <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>
          {busy ? 'Please wait…' : mode === 'login' ? 'Log In' : 'Create Account'}
        </button>
      </form>
    </div>
  );
}
