import crypto from 'node:crypto';
import fs from 'node:fs';

if (fs.existsSync('.env')) process.loadEnvFile();

const env = process.env;
const isProduction = env.NODE_ENV === 'production';

function resolveJwtSecret() {
  const secret = env.JWT_SECRET;
  if (secret && secret !== 'change-me') return secret;
  if (isProduction) throw new Error('JWT_SECRET must be set to a strong random value in production');
  if (env.NODE_ENV !== 'test') console.warn('[config] JWT_SECRET not set, using a temporary development secret');
  return crypto.randomBytes(48).toString('hex');
}

const parseList = (value) => value.split(',').map((item) => item.trim()).filter(Boolean);

export const config = {
  isProduction,
  port: Number(env.PORT || 4000),
  jwtSecret: resolveJwtSecret(),
  dbPath: env.DB_PATH || 'data/union.db',
  clientOrigins: parseList(env.CLIENT_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173'),
  publicUrl: env.PUBLIC_URL || 'http://localhost:5173',
  snapshotIntervalMs: Number(env.SNAPSHOT_INTERVAL_MINUTES || 5) * 60 * 1000,
  sessionTtl: '7d',
  collabTokenTtl: '12h',
  maxVersionsPerDocument: 200,
};
