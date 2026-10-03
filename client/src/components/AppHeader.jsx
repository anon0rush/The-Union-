import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import Avatar from './Avatar.jsx';
import Logo from './Logo.jsx';

export default function AppHeader({ children }) {
  const { user, logout } = useAuth();
  return (
    <header className="app-header">
      <Link to="/" className="brand-link" aria-label="All documents"><Logo /></Link>
      <div className="app-header-main">{children}</div>
      {user && (
        <div className="user-chip">
          <Avatar user={user} />
          <span className="user-name">{user.name}</span>
          <button className="link-btn" onClick={logout}>Sign out</button>
        </div>
      )}
    </header>
  );
}
