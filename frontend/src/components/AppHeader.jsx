import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { MOD, useCommands } from '../context/CommandContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import Avatar from './Avatar.jsx';
import Icon from './Icon.jsx';
import Logo from './Logo.jsx';
import Menu from './Menu.jsx';

const THEME_OPTIONS = [
  ['system', 'Match system', 'monitor'],
  ['light', 'Light', 'sun'],
  ['dark', 'Dark', 'moon'],
];

export default function AppHeader({ children }) {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { setPaletteOpen, setShortcutsOpen } = useCommands();

  return (
    <header className="app-header">
      <Link to="/" className="logo" aria-label="All documents">
        <Logo />
      </Link>
      <div className="app-header-main">{children}</div>
      {user && (
        <div className="app-header-end">
          <button className="btn btn-sm command-trigger hide-sm" onClick={() => setPaletteOpen(true)}>
            <Icon name="search" size={14} />
            Search
            <span className="kbd">{MOD} K</span>
          </button>
          <Menu
            label="Account"
            trigger={({ toggle, ...aria }) => (
              <button className="btn btn-ghost btn-icon" onClick={toggle} aria-label="Account menu" {...aria}>
                <Avatar user={user} size={26} />
              </button>
            )}
          >
            <div className="menu-user">
              <Avatar user={user} size={32} />
              <span>
                <strong>{user.name}</strong>
                <small>{user.email}</small>
              </span>
            </div>
            <div className="menu-sep" />
            <p className="menu-label">Appearance</p>
            {THEME_OPTIONS.map(([value, label, icon]) => (
              <button
                key={value}
                className="menu-item"
                role="menuitemradio"
                aria-checked={theme === value}
                onClick={() => setTheme(value)}
              >
                <Icon name={icon} />
                {label}
              </button>
            ))}
            <div className="menu-sep" />
            <button className="menu-item" role="menuitem" onClick={() => setShortcutsOpen(true)}>
              <Icon name="keyboard" />
              Keyboard shortcuts
            </button>
            <button className="menu-item danger" role="menuitem" onClick={logout}>
              <Icon name="signout" />
              Sign out
            </button>
          </Menu>
        </div>
      )}
    </header>
  );
}
