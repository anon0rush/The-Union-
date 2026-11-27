import crypto from 'node:crypto';
import { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { canWrite } from '../utils/permissions.js';
import { CloseCode } from './closeCodes.js';
import { summarize } from './documentText.js';

const MSG_SYNC = 0;
const MSG_AWARENESS = 1;
const MSG_QUERY_AWARENESS = 3;

const SAVE_DEBOUNCE_MS = 1000;
const SAVE_MAX_WAIT_MS = 10_000;
const HEARTBEAT_MS = 30_000;

export const FRAGMENT = 'default';
const DEFAULT_TITLE = 'Untitled document';

export function createInitialState(title) {
  const doc = new Y.Doc();
  doc.transact(() => {
    doc.getMap('meta').set('title', title);
    doc.getXmlFragment(FRAGMENT).insert(0, [new Y.XmlElement('paragraph')]);
  });
  const state = Y.encodeStateAsUpdate(doc);
  doc.destroy();
  return state;
}

export function createCollabServer({ repo, config, authenticate }) {
  const rooms = new Map();
  const wss = new WebSocketServer({ noServer: true, maxPayload: 10 * 1024 * 1024 });

  function getRoom(documentId) {
    const existing = rooms.get(documentId);
    if (existing) return existing;

    const doc = new Y.Doc();
    const state = repo.getDocumentState(documentId);
    if (state) Y.applyUpdate(doc, state);

    const awareness = new awarenessProtocol.Awareness(doc);
    awareness.setLocalState(null);

    const latest = repo.listVersions(documentId)[0];
    const room = {
      id: documentId,
      doc,
      awareness,
      conns: new Map(),
      saveTimer: null,
      firstDirtyAt: 0,
      dirty: false,
      changedSinceSnapshot: false,
      contributors: new Set(),
      lastSnapshotAt: latest?.created_at ?? repo.getDocument(documentId)?.created_at ?? Date.now(),
      destroyed: false,
    };

    doc.on('update', (update, origin) => {
      broadcast(room, encodeMessage(MSG_SYNC, (enc) => syncProtocol.writeUpdate(enc, update)));
      const userId = room.conns.get(origin)?.userId ?? origin?.userId;
      if (userId) room.contributors.add(userId);
      room.changedSinceSnapshot = true;
      scheduleSave(room);
    });

    awareness.on('update', ({ added, updated, removed }, origin) => {
      const conn = room.conns.get(origin);
      if (conn) {
        added.forEach((id) => conn.awarenessIds.add(id));
        removed.forEach((id) => conn.awarenessIds.delete(id));
      }
      const changed = added.concat(updated, removed);
      const update = awarenessProtocol.encodeAwarenessUpdate(awareness, changed);
      broadcast(room, encodeMessage(MSG_AWARENESS, (enc) => encoding.writeVarUint8Array(enc, update)));
    });

    rooms.set(documentId, room);
    return room;
  }

  function scheduleSave(room) {
    if (!room.dirty) room.firstDirtyAt = Date.now();
    room.dirty = true;
    clearTimeout(room.saveTimer);
    const wait = Math.max(0, Math.min(SAVE_DEBOUNCE_MS, room.firstDirtyAt + SAVE_MAX_WAIT_MS - Date.now()));
    room.saveTimer = setTimeout(() => persist(room), wait);
  }

  function persist(room, { forceSnapshot = false } = {}) {
    if (room.destroyed) return;
    clearTimeout(room.saveTimer);
    room.saveTimer = null;
    if (room.dirty) {
      const title = String(room.doc.getMap('meta').get('title') || DEFAULT_TITLE).slice(0, 200);
      const { excerpt, wordCount } = summarize(room.doc.getXmlFragment(FRAGMENT));
      repo.saveDocumentState(room.id, {
        state: Y.encodeStateAsUpdate(room.doc),
        title,
        excerpt,
        wordCount,
        updatedAt: Date.now(),
      });
      room.dirty = false;
    }
    const due = Date.now() - room.lastSnapshotAt >= config.snapshotIntervalMs;
    if (room.changedSinceSnapshot && (due || forceSnapshot)) {
      recordVersion(room, { kind: 'auto' });
    }
  }

  function recordVersion(room, { kind, label = null, createdBy = null }) {
    const now = Date.now();
    const version = {
      id: crypto.randomUUID(),
      documentId: room.id,
      state: Y.encodeStateAsUpdate(room.doc),
      kind,
      label,
      createdBy,
      authors: [...room.contributors],
      createdAt: now,
      keep: config.maxVersionsPerDocument,
    };
    repo.createVersion(version);
    room.contributors.clear();
    room.changedSinceSnapshot = false;
    room.lastSnapshotAt = now;
    return version;
  }

  function destroyRoom(room, { save }) {
    if (room.destroyed) return;
    if (save) persist(room, { forceSnapshot: true });
    clearTimeout(room.saveTimer);
    room.destroyed = true;
    room.awareness.destroy();
    room.doc.destroy();
    if (rooms.get(room.id) === room) rooms.delete(room.id);
  }

  function withDocument(documentId, fn) {
    const room = getRoom(documentId);
    try {
      return fn(room.doc, room);
    } finally {
      persist(room);
      if (room.conns.size === 0) destroyRoom(room, { save: false });
    }
  }

  function send(ws, message) {
    if (ws.readyState !== ws.OPEN) return;
    ws.send(message, (err) => err && ws.terminate());
  }

  function broadcast(room, message) {
    for (const ws of room.conns.keys()) send(ws, message);
  }

  function handleConnection(ws, { documentId, user, role }) {
    const room = getRoom(documentId);
    const conn = { userId: user.id, role, awarenessIds: new Set(), alive: true };
    room.conns.set(ws, conn);

    ws.on('pong', () => (conn.alive = true));
    ws.on('close', () => closeConnection(room, ws));
    ws.on('message', (data) => {
      try {
        handleMessage(room, ws, conn, new Uint8Array(data));
      } catch (err) {
        console.warn(`[collab] dropping malformed message on ${documentId}:`, err.message);
        ws.close(1007, 'Malformed message');
      }
    });

    send(ws, encodeMessage(MSG_SYNC, (enc) => syncProtocol.writeSyncStep1(enc, room.doc)));
    const states = room.awareness.getStates();
    if (states.size > 0) {
      const update = awarenessProtocol.encodeAwarenessUpdate(room.awareness, [...states.keys()]);
      send(ws, encodeMessage(MSG_AWARENESS, (enc) => encoding.writeVarUint8Array(enc, update)));
    }
  }

  function handleMessage(room, ws, conn, message) {
    const decoder = decoding.createDecoder(message);
    const messageType = decoding.readVarUint(decoder);

    switch (messageType) {
      case MSG_SYNC: {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MSG_SYNC);
        const syncType = decoding.readVarUint(decoder);
        if (syncType === syncProtocol.messageYjsSyncStep1) {
          syncProtocol.readSyncStep1(decoder, encoder, room.doc);
        } else if (syncType === syncProtocol.messageYjsSyncStep2 || syncType === syncProtocol.messageYjsUpdate) {
          const update = decoding.readVarUint8Array(decoder);
          if (canWrite(conn.role)) Y.applyUpdate(room.doc, update, ws);
        } else {
          throw new Error(`unknown sync message type ${syncType}`);
        }
        if (encoding.length(encoder) > 1) send(ws, encoding.toUint8Array(encoder));
        break;
      }
      case MSG_AWARENESS:
        awarenessProtocol.applyAwarenessUpdate(room.awareness, decoding.readVarUint8Array(decoder), ws);
        break;
      case MSG_QUERY_AWARENESS: {
        const update = awarenessProtocol.encodeAwarenessUpdate(room.awareness, [...room.awareness.getStates().keys()]);
        send(ws, encodeMessage(MSG_AWARENESS, (enc) => encoding.writeVarUint8Array(enc, update)));
        break;
      }
      default:
        break;
    }
  }

  function closeConnection(room, ws) {
    const conn = room.conns.get(ws);
    if (!conn) return;
    room.conns.delete(ws);
    if (!room.destroyed) {
      awarenessProtocol.removeAwarenessStates(room.awareness, [...conn.awarenessIds], null);
      if (room.conns.size === 0) destroyRoom(room, { save: true });
    }
  }

  const heartbeat = setInterval(() => {
    for (const room of rooms.values()) {
      for (const [ws, conn] of room.conns) {
        if (!conn.alive) {
          ws.terminate();
          continue;
        }
        conn.alive = false;
        ws.ping();
      }
    }
  }, HEARTBEAT_MS);
  heartbeat.unref();

  function handleUpgrade(req, socket, head) {
    const url = new URL(req.url, 'http://localhost');
    const match = url.pathname.match(/^\/collab\/([A-Za-z0-9-]{1,64})$/);
    if (!match) return false;

    wss.handleUpgrade(req, socket, head, (ws) => {
      const documentId = match[1];
      const result = authenticate({ token: url.searchParams.get('token'), documentId, origin: req.headers.origin });
      if (result.error) {
        ws.close(result.code, result.error);
        return;
      }
      handleConnection(ws, { documentId, user: result.user, role: result.role });
    });
    return true;
  }

  return {
    handleUpgrade,

    setTitle(documentId, title, userId) {
      withDocument(documentId, (doc) => doc.transact(() => doc.getMap('meta').set('title', title), { userId }));
    },

    createVersion(documentId, { label, createdBy }) {
      return withDocument(documentId, (_doc, room) => {
        persist(room);
        return recordVersion(room, { kind: 'manual', label, createdBy });
      });
    },

    restoreVersion(documentId, version, userId) {
      return withDocument(documentId, (doc, room) => {
        const when = new Date(version.created_at).toISOString().replace('T', ' ').slice(0, 16);
        recordVersion(room, {
          kind: 'restore',
          label: `Before restoring “${version.label || when + ' UTC'}”`,
          createdBy: userId,
        });

        const snapshot = new Y.Doc();
        Y.applyUpdate(snapshot, version.state);
        doc.transact(() => {
          const fragment = doc.getXmlFragment(FRAGMENT);
          fragment.delete(0, fragment.length);
          fragment.insert(0, snapshot.getXmlFragment(FRAGMENT).toArray().map((node) => node.clone()));
          const title = snapshot.getMap('meta').get('title');
          if (title) doc.getMap('meta').set('title', title);
        }, { userId });
        snapshot.destroy();
      });
    },

    disconnectUser(documentId, userId, code = CloseCode.ROLE_CHANGED, reason = 'Your access changed') {
      const room = rooms.get(documentId);
      if (!room) return;
      for (const [ws, conn] of room.conns) {
        if (conn.userId === userId) ws.close(code, reason);
      }
    },

    closeDocument(documentId) {
      const room = rooms.get(documentId);
      if (!room) return;
      destroyRoom(room, { save: false });
      for (const ws of room.conns.keys()) ws.close(CloseCode.NOT_FOUND, 'Document deleted');
    },

    stats: () => ({
      rooms: rooms.size,
      connections: [...rooms.values()].reduce((n, r) => n + r.conns.size, 0),
    }),

    close() {
      clearInterval(heartbeat);
      for (const room of [...rooms.values()]) {
        for (const ws of room.conns.keys()) {
          ws.close(1001, 'Server shutting down');
          setTimeout(() => ws.terminate(), 1000).unref();
        }
        destroyRoom(room, { save: true });
      }
      wss.close();
    },
  };
}

function encodeMessage(type, write) {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, type);
  write(encoder);
  return encoding.toUint8Array(encoder);
}
