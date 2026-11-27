import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import Logo from '../components/Logo.jsx';
import Shapes from '../components/Shapes.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const AYLIN = '#0b7a6b';
const MARCO = '#c0306f';

function safeNext(raw) {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return '/';
  return raw;
}

function Caret({ name, color }) {
  return (
    <span className="sample-caret" style={{ background: color }} aria-hidden="true">
      <span style={{ background: color }}>{name}</span>
    </span>
  );
}

function SampleDocument() {
  return (
    <figure className="auth-sample" aria-label="Example of two people editing the same document">
      <h2>Launch notes</h2>
      <p>
        The beta opens to the first 200 teams on Monday.
        <Caret name="Aylin" color={AYLIN} /> Support hours move to 08:00 to 20:00 for the first week.
      </p>
      <p>
        <span className="sample-select" style={{ background: `${MARCO}33` }}>
          Pricing stays the same until the review on 14 October.
        </span>
        <Caret name="Marco" color={MARCO} />
      </p>
    </figure>
  );
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

  const update = (field) => (event) => setForm((f) => ({ ...f, [field]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
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
      <section className="auth-intro">
        <Shapes width={210} height={175} />
        <Logo />
        <div className="auth-intro-copy">
          <h1>Write the same document with your team, at the same time.</h1>
          <p className="muted">
            Everyone in a document sees each other's cursor and edits as they happen. Your changes keep saving when the
            connection drops and sync when it comes back.
          </p>
        </div>
        <SampleDocument />
        <ul className="auth-facts">
          <li className="tone-sun">Version history with restore</li>
          <li className="tone-coral">Owner, editor and viewer roles</li>
          <li className="tone-cobalt">Share links that expire</li>
          <li className="tone-leaf">Import Word and PDF</li>
          <li className="tone-pink">Works offline</li>
        </ul>
      </section>

      <section className="auth-main">
        <form className="auth-form" onSubmit={submit} noValidate>
          <h2>{isRegister ? 'Create an account' : 'Sign in'}</h2>
          {next.startsWith('/share/') && <p className="muted">Sign in to open the document someone shared with you.</p>}

          {isRegister && (
            <label className="field">
              Name
              <input value={form.name} onChange={update('name')} autoComplete="name" required maxLength={60} autoFocus />
            </label>
          )}
          <label className="field">
            Email
            <input
              type="email"
              value={form.email}
              onChange={update('email')}
              autoComplete="email"
              required
              autoFocus={!isRegister}
            />
          </label>
          <label className="field">
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

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
          </button>
          <p className="auth-switch">
            {isRegister ? 'Already have an account?' : 'New here?'}{' '}
            <Link to={otherLink}>{isRegister ? 'Sign in' : 'Create an account'}</Link>
          </p>
        </form>
      </section>
    </main>
  );
}
