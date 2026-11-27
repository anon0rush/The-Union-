import { verifyToken } from '../utils/tokens.js';
import { CloseCode } from './closeCodes.js';

export function createSocketAuthenticator({ repo, allowedOrigins }) {
  return function authenticate({ token, documentId, origin }) {
    if (origin && !allowedOrigins.has(origin)) return { error: 'Origin not allowed', code: CloseCode.FORBIDDEN };

    const payload = verifyToken(token, 'collab');
    if (!payload || payload.doc !== documentId) return { error: 'Invalid or expired token', code: CloseCode.UNAUTHORIZED };

    const user = repo.getUserById(payload.sub);
    if (!user) return { error: 'Unknown user', code: CloseCode.UNAUTHORIZED };
    if (!repo.getDocument(documentId)) return { error: 'Document not found', code: CloseCode.NOT_FOUND };

    const role = repo.getRole(documentId, user.id);
    if (!role) return { error: 'No access to this document', code: CloseCode.FORBIDDEN };

    return { user, role };
  };
}
