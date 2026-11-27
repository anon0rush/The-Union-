import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

const ISSUER = 'the-union';

function sign(payload, subject, expiresIn) {
  return jwt.sign(payload, config.jwtSecret, { subject, issuer: ISSUER, expiresIn });
}

export const signSessionToken = (userId) => sign({ typ: 'session' }, userId, config.sessionTtl);

export const signCollabToken = (userId, documentId) =>
  sign({ typ: 'collab', doc: documentId }, userId, config.collabTokenTtl);

export function verifyToken(token, expectedType) {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.jwtSecret, { issuer: ISSUER, algorithms: ['HS256'] });
    return payload.typ === expectedType ? payload : null;
  } catch {
    return null;
  }
}

export const generateShareToken = () => crypto.randomBytes(32).toString('base64url');

export const hashShareToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
