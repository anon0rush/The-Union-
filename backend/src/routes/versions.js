import express from 'express';
import { validate } from '../middleware/validate.js';
import { Activity, recordActivity } from '../services/activity.js';
import { HttpError } from '../utils/HttpError.js';
import { createVersionSchema } from '../validation/schemas.js';

const toVersion = (v, users) => ({
  id: v.id,
  kind: v.kind,
  label: v.label,
  createdAt: v.created_at,
  createdBy: v.created_by ? { id: v.created_by, name: v.created_by_name } : null,
  authors: v.authors.map((id) => users[id]).filter(Boolean),
  size: v.size,
});

export function versionsRouter({ repo, collab, access }) {
  const router = express.Router({ mergeParams: true });

  function findVersion(req) {
    const version = repo.getVersion(req.doc.id, req.params.versionId);
    if (!version) throw new HttpError(404, 'Version not found');
    return version;
  }

  router.get('/', access('viewer'), (req, res) => {
    const versions = repo.listVersions(req.doc.id);
    const users = repo.getUsersByIds([...new Set(versions.flatMap((v) => v.authors))]);
    res.json({ versions: versions.map((v) => toVersion(v, users)) });
  });

  router.post('/', access('editor'), (req, res) => {
    const { label } = validate(createVersionSchema, req.body);
    const v = collab.createVersion(req.doc.id, { label, createdBy: req.user.id });
    recordActivity(repo, { documentId: req.doc.id, userId: req.user.id, action: Activity.VERSION_SAVED, detail: { label } });
    res.status(201).json({ version: { id: v.id, kind: v.kind, label: v.label, createdAt: v.createdAt } });
  });

  router.get('/:versionId', access('viewer'), (req, res) => {
    const v = findVersion(req);
    res.json({
      version: { id: v.id, kind: v.kind, label: v.label, createdAt: v.created_at },
      state: v.state.toString('base64'),
    });
  });

  router.post('/:versionId/restore', access('editor'), (req, res) => {
    const version = findVersion(req);
    collab.restoreVersion(req.doc.id, version, req.user.id);
    recordActivity(repo, {
      documentId: req.doc.id,
      userId: req.user.id,
      action: Activity.VERSION_RESTORED,
      detail: { label: version.label, createdAt: version.created_at },
    });
    res.json({ ok: true });
  });

  return router;
}
