import express from 'express';
import { Activity, recordActivity } from '../services/activity.js';
import { HttpError } from '../utils/HttpError.js';
import { ROLE_RANK } from '../utils/permissions.js';
import { hashShareToken } from '../utils/tokens.js';

export function shareRouter({ repo, collab }) {
  const router = express.Router();

  function resolveLink(token) {
    if (typeof token !== 'string' || token.length < 20 || token.length > 100) {
      throw new HttpError(404, 'This share link is invalid');
    }
    const link = repo.getShareLinkByHash(hashShareToken(token));
    if (!link) throw new HttpError(404, 'This share link is invalid');
    if (link.revoked_at) throw new HttpError(410, 'This share link has been revoked');
    if (link.expires_at && link.expires_at <= Date.now()) throw new HttpError(410, 'This share link has expired');

    const doc = repo.getDocument(link.document_id);
    if (!doc) throw new HttpError(404, 'The shared document no longer exists');
    return { link, doc };
  }

  router.get('/:token', (req, res) => {
    const { link, doc } = resolveLink(req.params.token);
    const owner = repo.getUserById(doc.owner_id);
    res.json({
      documentId: doc.id,
      title: doc.title,
      ownerName: owner?.name,
      role: link.role,
      currentRole: repo.getRole(doc.id, req.user.id),
    });
  });

  router.post('/:token/accept', (req, res) => {
    const { link, doc } = resolveLink(req.params.token);
    const current = repo.getRole(doc.id, req.user.id);
    const isUpgrade = !current || ROLE_RANK[link.role] > ROLE_RANK[current];
    if (isUpgrade) {
      repo.upsertMember(doc.id, req.user.id, link.role);
      repo.recordShareLinkUse(link.id);
      recordActivity(repo, { documentId: doc.id, userId: req.user.id, action: Activity.LINK_ACCEPTED, detail: { role: link.role } });
      if (current) collab.disconnectUser(doc.id, req.user.id);
    }
    res.json({ documentId: doc.id, role: repo.getRole(doc.id, req.user.id) });
  });

  return router;
}
