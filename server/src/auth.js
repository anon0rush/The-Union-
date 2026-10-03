import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { HttpError } from './http.js';

const ISSUER = 'the-union';

export function signSessionToken(userId) {
  return jwt.sign({ typ: 'session' }, config.jwtSecret, {
    subject: userId,
    issuer: ISSUER,
    expiresIn: config.sessionTtl,
  });
}

/**
 * Short-lived token scoped to a single document. It travels in the WebSocket URL,
 * so we never put the long-lived session token there.
 */
export function signCollabToken(userId, documentId) {
  return jwt.sign({ typ: 'collab', doc: documentId }, config.jwtSecret, {
    subject: userId,
    issuer: ISSUER,
    expiresIn: config.collabTokenTtl,
  });
}

/** Returns the decoded payload, or null when the token is missing, invalid, expired or of the wrong type. */
export function verifyToken(token, expectedType) {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.jwtSecret, { issuer: ISSUER, algorithms: ['HS256'] });
    return payload.typ === expectedType ? payload : null;
  } catch {
    return null;
  }
}

export function requireAuth(repo) {
  return (req, _res, next) => {
    const header = req.get('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    const payload = verifyToken(token, 'session');
    const user = payload && repo.getUserById(payload.sub);
    if (!user) return next(new HttpError(401, 'Authentication required'));
    req.user = user;
    next();
  };
}
