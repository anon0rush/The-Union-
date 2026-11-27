import { HttpError } from '../utils/HttpError.js';
import { hasRole } from '../utils/permissions.js';

export function documentAccess(repo, minRole) {
  return (req, _res, next) => {
    const doc = repo.getDocument(req.params.id);
    const role = doc && repo.getRole(doc.id, req.user.id);
    if (!doc || !role) return next(new HttpError(404, 'Document not found'));
    if (!hasRole(role, minRole)) return next(new HttpError(403, `This action requires ${minRole} access`));
    req.doc = doc;
    req.role = role;
    next();
  };
}
