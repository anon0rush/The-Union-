import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import Logo from '../components/Logo.jsx';
import { useAuth } from '../lib/auth.jsx';

/** Only follow same-site relative paths after login (no open redirects). */
function safeNext(raw) {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return '/';
  return raw;
}

export default function AuthPage({ mode }) {
  const { user, authenticate } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isRegister = mode === 'register';

  if (user) return <Navigate to={next} replace />;

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const fields = isRegister ? form : { email: form.email, password: form.password };
      await authenticate(mode, fields);
      navigate(next, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const otherLink = `${isRegister ? '/login' : '/register'}${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`;

  return (
    <main className="auth">
      <section className="auth-pitch">
        <Logo large />
        <h1>Write together, in real time.</h1>
        <ul>
          <li><strong>Live cursors</strong> show exactly who is typing where.</li>
          <li><strong>Conflict-free merging</strong> (CRDT): everyone’s edits land, even offline.</li>
          <li><strong>Version history</strong> with one-click restore.</li>
          <li><strong>Secure sharing</strong> with roles, expiring links and revocation.</li>
        </ul>
      </section>

      <form className="auth-card" onSubmit={submit} noValidate>
        <h2>{isRegister ? 'Create your account' : 'Welcome back'}</h2>
        {next.startsWith('/share/') && <p className="muted">Sign in to open the document that was shared with you.</p>}

        {isRegister && (
          <label>
            Name
            <input value={form.name} onChange={update('name')} autoComplete="name" required maxLength={60} autoFocus />
          </label>
        )}
        <label>
          Email
          <input type="email" value={form.email} onChange={update('email')} autoComplete="email" required autoFocus={!isRegister} />
        </label>
        <label>
          Password
          <input
            type="password"
            value={form.password}
            onChange={update('password')}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            minLength={isRegister ? 8 : undefined}
            required
          />
          {isRegister && <span className="hint">At least 8 characters.</span>}
        </label>

        {error && <p className="error" role="alert">{error}</p>}

        <button className="btn primary block" disabled={busy}>
          {busy ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
        </button>
        <p className="muted center">
          {isRegister ? 'Already have an account?' : 'New to The Union?'} <Link to={otherLink}>{isRegister ? 'Sign in' : 'Create an account'}</Link>
        </p>
      </form>
    </main>
  );
}
