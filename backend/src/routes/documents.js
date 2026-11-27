import crypto from 'node:crypto';
import express from 'express';
import { documentAccess } from '../middleware/documentAccess.js';
import { validate } from '../middleware/validate.js';
import { createInitialState } from '../realtime/collabServer.js';
import { Activity, recordActivity } from '../services/activity.js';
import { signCollabToken } from '../utils/tokens.js';
import { createDocumentSchema, renameDocumentSchema } from '../validation/schemas.js';
import { linksRouter } from './links.js';
import { membersRouter } from './members.js';
import { versionsRouter } from './versions.js';

const DEFAULT_TITLE = 'Untitled document';

const toDocument = (d) => ({
  id: d.id,
  title: d.title,
  excerpt: d.excerpt ?? '',
  wordCount: d.word_count ?? 0,
  ownerId: d.owner_id,
  ownerName: d.owner_name,
  role: d.role,
  starred: Boolean(d.starred),
  createdAt: d.created_at,
  updatedAt: d.updated_at,
});

export function documentsRouter({ repo, collab, config }) {
  const router = express.Router();
  const access = (minRole) => documentAccess(repo, minRole);

  router.get('/', (req, res) => {
    res.json({ documents: repo.listDocumentsForUser(req.user.id).map(toDocument) });
  });

  router.post('/', (req, res) => {
    const { title = DEFAULT_TITLE, importedFrom } = validate(createDocumentSchema, req.body ?? {});
    const id = crypto.randomUUID();
    repo.createDocument({ id, title, ownerId: req.user.id, state: createInitialState(title), createdAt: Date.now() });
    recordActivity(repo, {
      documentId: id,
      userId: req.user.id,
      action: importedFrom ? Activity.DOCUMENT_IMPORTED : Activity.DOCUMENT_CREATED,
      detail: importedFrom ? { title, file: importedFrom } : { title },
    });
    const doc = repo.listDocumentsForUser(req.user.id).find((d) => d.id === id);
    res.status(201).json({ document: toDocument(doc) });
  });

  router.get('/:id', access('viewer'), (req, res) => {
    const owner = repo.getUserById(req.doc.owner_id);
    res.json({
      document: toDocument({
        ...req.doc,
        owner_name: owner?.name,
        role: req.role,
        starred: repo.isStarred(req.user.id, req.doc.id),
      }),
      role: req.role,
      collabToken: signCollabToken(req.user.id, req.doc.id),
    });
  });

  router.patch('/:id', access('editor'), (req, res) => {
    const { title } = validate(renameDocumentSchema, req.body);
    collab.setTitle(req.doc.id, title, req.user.id);
    recordActivity(repo, {
      documentId: req.doc.id,
      userId: req.user.id,
      action: Activity.DOCUMENT_RENAMED,
      detail: { from: req.doc.title, to: title },
    });
    res.json({ ok: true, title });
  });

  router.delete('/:id', access('owner'), (req, res) => {
    collab.closeDocument(req.doc.id);
    repo.deleteDocument(req.doc.id);
    res.status(204).end();
  });

  router.put('/:id/star', access('viewer'), (req, res) => {
    repo.setStarred(req.user.id, req.doc.id, true);
    res.json({ starred: true });
  });

  router.delete('/:id/star', access('viewer'), (req, res) => {
    repo.setStarred(req.user.id, req.doc.id, false);
    res.json({ starred: false });
  });

  router.get('/:id/activity', access('viewer'), (req, res) => {
    const activity = repo.listActivity(req.doc.id).map((a) => ({
      id: a.id,
      action: a.action,
      detail: a.detail,
      createdAt: a.created_at,
      user: a.user_id ? { id: a.user_id, name: a.user_name, color: a.user_color } : null,
    }));
    res.json({ activity });
  });

  router.use('/:id/members', membersRouter({ repo, collab, access }));
  router.use('/:id/links', linksRouter({ repo, config, access }));
  router.use('/:id/versions', versionsRouter({ repo, collab, access }));

  return router;
}
