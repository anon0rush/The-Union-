import { Suspense, lazy, useMemo } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { api } from './api/client.js';
import CommandPalette from './components/CommandPalette.jsx';
import ShortcutsDialog from './components/ShortcutsDialog.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { useCommands, useRegisterCommands } from './context/CommandContext.jsx';
import { useTheme } from './context/ThemeContext.jsx';
import AuthPage from './pages/AuthPage.jsx';
import Dashboard from './pages/Dashboard.jsx';
import SharePage from './pages/SharePage.jsx';

const DocumentPage = lazy(() => import('./pages/DocumentPage.jsx'));

function FullScreenSpinner() {
  return (
    <div className="center-screen">
      <div className="spinner" aria-label="Loading" />
    </div>
  );
}

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullScreenSpinner />;
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <Suspense fallback={<FullScreenSpinner />}>{children}</Suspense>;
}

function GlobalCommands() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { setTheme } = useTheme();
  const { setShortcutsOpen } = useCommands();

  const commands = useMemo(
    () => [
      {
        id: 'new-document',
        label: 'Create a new document',
        icon: 'plus',
        keywords: 'add blank',
        run: async () => {
          const { document } = await api('/documents', { method: 'POST', body: {} });
          navigate(`/d/${document.id}`);
        },
      },
      {
        id: 'import-document',
        label: 'Import a Word or PDF file',
        icon: 'upload',
        keywords: 'upload docx pdf markdown',
        run: () => navigate('/?import=1'),
      },
      { id: 'go-home', label: 'Go to all documents', icon: 'doc', keywords: 'dashboard home', run: () => navigate('/') },
      { id: 'theme-light', group: 'Appearance', label: 'Use light theme', icon: 'sun', run: () => setTheme('light') },
      { id: 'theme-dark', group: 'Appearance', label: 'Use dark theme', icon: 'moon', run: () => setTheme('dark') },
      { id: 'theme-system', group: 'Appearance', label: 'Match system theme', icon: 'monitor', run: () => setTheme('system') },
      {
        id: 'shortcuts',
        group: 'Help',
        label: 'Show keyboard shortcuts',
        icon: 'keyboard',
        shortcut: '?',
        run: () => setShortcutsOpen(true),
      },
      { id: 'sign-out', group: 'Account', label: 'Sign out', icon: 'signout', keywords: 'log out', run: logout },
    ],
    [navigate, logout, setTheme, setShortcutsOpen],
  );

  useRegisterCommands(commands);
  return null;
}

export default function App() {
  const { user } = useAuth();

  return (
    <>
      <Routes>
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/d/:id" element={<RequireAuth><DocumentPage /></RequireAuth>} />
        <Route path="/share/:token" element={<RequireAuth><SharePage /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {user && (
        <>
          <GlobalCommands />
          <CommandPalette />
          <ShortcutsDialog />
        </>
      )}
    </>
  );
}
