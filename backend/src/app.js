import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { requireAuth } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { createSocketAuthenticator } from './realtime/authenticateSocket.js';
import { createCollabServer } from './realtime/collabServer.js';
import { authRouter } from './routes/auth.js';
import { documentsRouter } from './routes/documents.js';
import { importRouter } from './routes/import.js';
import { shareRouter } from './routes/share.js';

const FRONTEND_DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend/dist');

export function createServer({ repo, config, rateLimits = true }) {
  const allowedOrigins = new Set([...config.clientOrigins, new URL(config.publicUrl).origin]);
  const authenticate = createSocketAuthenticator({ repo, allowedOrigins });
  const collab = createCollabServer({ repo, config, authenticate });
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: (origin, cb) => cb(null, !origin || allowedOrigins.has(origin)) }));
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', apiLimiter(rateLimits));

  app.get('/api/health', (_req, res) => res.json({ ok: true, ...collab.stats() }));
  app.use('/api/auth', authRouter({ repo, rateLimits }));
  app.use('/api/documents', requireAuth(repo), documentsRouter({ repo, collab, config }));
  app.use('/api/share', requireAuth(repo), shareRouter({ repo, collab }));
  app.use('/api/import', requireAuth(repo), importRouter());
  app.use('/api', notFoundHandler);

  if (fs.existsSync(FRONTEND_DIST)) {
    app.use(express.static(FRONTEND_DIST, { index: false, maxAge: '1h' }));
    app.get('*', (_req, res) => res.sendFile(path.join(FRONTEND_DIST, 'index.html')));
  }

  app.use(errorHandler);

  const server = http.createServer(app);
  server.on('upgrade', (req, socket, head) => {
    if (!collab.handleUpgrade(req, socket, head)) socket.destroy();
  });

  const close = () =>
    new Promise((resolve) => {
      collab.close();
      server.close(() => resolve());
      server.closeAllConnections?.();
    });

  return { app, server, collab, close };
}
