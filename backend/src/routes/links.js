import crypto from 'node:crypto';
import express from 'express';
import { validate } from '../middleware/validate.js';
import { Activity, recordActivity } from '../services/activity.js';
import { HttpError } from '../utils/HttpError.js';
import { generateShareToken, hashShareToken } from '../utils/tokens.js';
import { createLinkSchema } from '../validation/schemas.js';

const HOUR_MS = 60 * 60 * 1000;

const toLink = (l, now) => ({
  id: l.id,
  role: l.role,
  createdAt: l.created_at,
  expiresAt: l.expires_at,
  revokedAt: l.revoked_at,
  uses: l.uses,
  createdBy: l.created_by_name,
  active: !l.revoked_at && (!l.expires_at || l.expires_at > now),
});

export function linksRouter({ repo, config, access }) {
  const router = express.Router({ mergeParams: true });
  const baseUrl = config.publicUrl.replace(/\/$/, '');

  router.get('/', access('owner'), (req, res) => {
    const now = Date.now();
    res.json({ links: repo.listShareLinks(req.doc.id).map((l) => toLink(l, now)) });
  });

  router.post('/', access('owner'), (req, res) => {
    const { role, expiresInHours } = validate(createLinkSchema, req.body);
    const token = generateShareToken();
    const now = Date.now();
    const link = {
      id: crypto.randomUUID(),
      documentId: req.doc.id,
      tokenHash: hashShareToken(token),
      role,
      createdBy: req.user.id,
      createdAt: now,
      expiresAt: expiresInHours ? now + expiresInHours * HOUR_MS : null,
    };
    repo.createShareLink(link);
    recordActivity(repo, {
      documentId: req.doc.id,
      userId: req.user.id,
      action: Activity.LINK_CREATED,
      detail: { role, expiresAt: link.expiresAt },
    });
    res.status(201).json({
      link: { id: link.id, role, createdAt: now, expiresAt: link.expiresAt, uses: 0, active: true },
      url: `${baseUrl}/share/${token}`,
    });
  });

  router.delete('/:linkId', access('owner'), (req, res) => {
    if (!repo.revokeShareLink(req.doc.id, req.params.linkId)) throw new HttpError(404, 'Link not found');
    recordActivity(repo, { documentId: req.doc.id, userId: req.user.id, action: Activity.LINK_REVOKED, detail: {} });
    res.status(204).end();
  });

  return router;
}
