import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { requireAuth, verifyToken } from './auth.js';
import { CloseCode, createCollabServer } from './collab.js';
import { errorHandler } from './http.js';
import { authRouter } from './routes/auth.js';
import { documentsRouter } from './routes/documents.js';
import { shareRouter } from './routes/share.js';

const CLIENT_DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');

export function createServer({ repo, config, rateLimits = true }) {
  const allowedOrigins = new Set([...config.clientOrigins, new URL(config.publicUrl).origin]);

  /** WebSocket handshake authentication: doc-scoped token + live role lookup. */
  function authenticate({ token, documentId, origin }) {
    if (origin && !allowedOrigins.has(origin)) return { error: 'Origin not allowed', code: CloseCode.FORBIDDEN };
    const payload = verifyToken(token, 'collab');
    if (!payload || payload.doc !== documentId) return { error: 'Invalid or expired token', code: CloseCode.UNAUTHORIZED };
    const user = repo.getUserById(payload.sub);
    if (!user) return { error: 'Unknown user', code: CloseCode.UNAUTHORIZED };
    if (!repo.getDocument(documentId)) return { error: 'Document not found', code: CloseCode.NOT_FOUND };
    const role = repo.getRole(documentId, user.id);
    if (!role) return { error: 'No access to this document', code: CloseCode.FORBIDDEN };
    return { user, role };
  }

  const collab = createCollabServer({ repo, config, authenticate });
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: (origin, cb) => cb(null, !origin || allowedOrigins.has(origin)) }));
  app.use(express.json({ limit: '100kb' }));

  if (rateLimits) {
    app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: 600, standardHeaders: 'draft-7', legacyHeaders: false }));
  }

  app.get('/api/health', (_req, res) => res.json({ ok: true, ...collab.stats() }));
  app.use('/api/auth', authRouter({ repo, limit: rateLimits }));
  app.use('/api/documents', requireAuth(repo), documentsRouter({ repo, collab, config }));
  app.use('/api/share', requireAuth(repo), shareRouter({ repo, collab }));
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  // In production the API also serves the built React app.
  if (fs.existsSync(CLIENT_DIST)) {
    app.use(express.static(CLIENT_DIST, { index: false, maxAge: '1h' }));
    app.get('*', (_req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')));
  }

  app.use(errorHandler);

  const server = http.createServer(app);
  server.on('upgrade', (req, socket, head) => {
    if (!collab.handleUpgrade(req, socket, head)) socket.destroy();
  });

  return {
    app,
    server,
    collab,
    close: () =>
      new Promise((resolve) => {
        collab.close();
        server.close(() => resolve());
        server.closeAllConnections?.();
      }),
  };
}
