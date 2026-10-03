import crypto from 'node:crypto';

try {
  process.loadEnvFile();
} catch {
  // no .env file — rely on the real environment
}

const isProduction = process.env.NODE_ENV === 'production';

let jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret === 'change-me') {
  if (isProduction) {
    throw new Error('JWT_SECRET must be set to a strong random value in production');
  }
  // Ephemeral dev secret: sessions are invalidated on every restart, which is fine locally.
  jwtSecret = crypto.randomBytes(48).toString('hex');
  if (process.env.NODE_ENV !== 'test') {
    console.warn('[config] JWT_SECRET not set — using an ephemeral development secret');
  }
}

export const config = {
  isProduction,
  port: Number(process.env.PORT || 4000),
  jwtSecret,
  dbPath: process.env.DB_PATH || 'data/union.db',
  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  publicUrl: process.env.PUBLIC_URL || 'http://localhost:5173',
  snapshotIntervalMs: Number(process.env.SNAPSHOT_INTERVAL_MINUTES || 5) * 60 * 1000,
  sessionTtl: '7d',
  collabTokenTtl: '12h',
  maxVersionsPerDocument: 200,
};
