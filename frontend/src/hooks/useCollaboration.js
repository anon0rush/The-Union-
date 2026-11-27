import { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { IndexeddbPersistence } from 'y-indexeddb';
import { collabUrl } from '../api/client.js';
import { offlineKey } from '../utils/offlineStorage.js';

export function useCollaboration({ documentId, token, userId, onAccessEvent }) {
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState('connecting');
  const [synced, setSynced] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const onAccessEventRef = useRef(onAccessEvent);
  onAccessEventRef.current = onAccessEvent;

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  useEffect(() => {
    if (!token) return undefined;
    const ydoc = new Y.Doc();
    const local = new IndexeddbPersistence(offlineKey(userId, documentId), ydoc);
    const provider = new WebsocketProvider(collabUrl(), documentId, ydoc, { params: { token } });

    setStatus('connecting');
    setSynced(false);
    provider.on('status', ({ status }) => setStatus(status));
    provider.on('sync', (isSynced) => setSynced(isSynced));
    provider.on('connection-close', (event) => {
      const code = event?.code;
      if (code < 4400 || code > 4499) return;
      provider.shouldConnect = false;
      if (code === 4403 || code === 4404) local.clearData();
      onAccessEventRef.current?.(code);
    });

    setSession({ ydoc, provider });
    return () => {
      provider.destroy();
      local.destroy();
      ydoc.destroy();
      setSession(null);
    };
  }, [documentId, token, userId]);

  const state = !online ? 'offline' : status === 'connected' && synced ? 'live' : status === 'connected' ? 'syncing' : 'connecting';
  return { ...session, connection: state };
}
