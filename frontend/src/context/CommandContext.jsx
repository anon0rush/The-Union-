import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const CommandContext = createContext(null);

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
export const MOD = isMac ? '⌘' : 'Ctrl';

function isTyping(target) {
  return target.closest?.('input, textarea, select, [contenteditable="true"]');
}

export function CommandProvider({ children }) {
  const [sources, setSources] = useState({});
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const counter = useRef(0);

  const register = useCallback((commands) => {
    counter.current += 1;
    const id = counter.current;
    setSources((prev) => ({ ...prev, [id]: commands }));
    return () =>
      setSources((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
  }, []);

  useEffect(() => {
    function onKeyDown(event) {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      } else if (event.key === '?' && !mod && !isTyping(event.target)) {
        event.preventDefault();
        setShortcutsOpen(true);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const commands = useMemo(() => Object.values(sources).reverse().flat(), [sources]);

  const value = useMemo(
    () => ({ commands, register, paletteOpen, setPaletteOpen, shortcutsOpen, setShortcutsOpen }),
    [commands, register, paletteOpen, shortcutsOpen],
  );
  return <CommandContext.Provider value={value}>{children}</CommandContext.Provider>;
}

export const useCommands = () => useContext(CommandContext);

export function useRegisterCommands(commands) {
  const { register } = useCommands();
  useEffect(() => register(commands), [register, commands]);
}
