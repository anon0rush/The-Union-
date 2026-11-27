import { HttpError } from '../utils/HttpError.js';
import { verifyToken } from '../utils/tokens.js';

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
