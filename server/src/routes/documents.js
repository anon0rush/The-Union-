import crypto from 'node:crypto';
import express from 'express';
import { z } from 'zod';
import { signCollabToken } from '../auth.js';
import { CloseCode, createInitialState } from '../collab.js';
import { HttpError, validate } from '../http.js';

const ROLE_RANK = { viewer: 1, editor: 2, owner: 3 };

const titleSchema = z.string().trim().min(1).max(200);
const createSchema = z.object({ title: titleSchema.optional() });
const renameSchema = z.object({ title: titleSchema });
const memberSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(['editor', 'viewer']),
});
const roleSchema = z.object({ role: z.enum(['editor', 'viewer']) });
const linkSchema = z.object({
  role: z.enum(['editor', 'viewer']),
  expiresInHours: z.number().int().min(1).max(24 * 90).nullable().optional(),
});
const versionSchema = z.object({ label: z.string().trim().min(1).max(120) });

export const hashShareToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const toDocument = (d) => ({
  id: d.id,
  title: d.title,
  ownerId: d.owner_id,
  ownerName: d.owner_name,
  role: d.role,
  createdAt: d.created_at,
  updatedAt: d.updated_at,
});

const toVersion = (v, users) => ({
  id: v.id,
  kind: v.kind,
  label: v.label,
  createdAt: v.created_at,
  createdBy: v.created_by ? { id: v.created_by, name: v.created_by_name } : null,
  authors: v.authors.map((id) => users[id]).filter(Boolean),
  size: v.size,
});

export function documentsRouter({ repo, collab, config }) {
  const router = express.Router();

  /** Load the document and enforce a minimum role. Unknown docs and no-access both 404 (don't leak existence). */
  function access(minRole) {
    return (req, _res, next) => {
      const doc = repo.getDocument(req.params.id);
      const role = doc && repo.getRole(doc.id, req.user.id);
      if (!doc || !role) return next(new HttpError(404, 'Document not found'));
      if (ROLE_RANK[role] < ROLE_RANK[minRole]) {
        return next(new HttpError(403, `This action requires ${minRole} access`));
      }
      req.doc = doc;
      req.role = role;
      next();
    };
  }

  // ---------------------------------------------------------------- documents

  router.get('/', (req, res) => {
    res.json({ documents: repo.listDocumentsForUser(req.user.id).map(toDocument) });
  });

  router.post('/', (req, res) => {
    const { title = 'Untitled document' } = validate(createSchema, req.body ?? {});
    const id = crypto.randomUUID();
    repo.createDocument({ id, title, ownerId: req.user.id, state: createInitialState(title), createdAt: Date.now() });
    const doc = repo.listDocumentsForUser(req.user.id).find((d) => d.id === id);
    res.status(201).json({ document: toDocument(doc) });
  });

  router.get('/:id', access('viewer'), (req, res) => {
    const owner = repo.getUserById(req.doc.owner_id);
    res.json({
      document: toDocument({ ...req.doc, owner_name: owner?.name, role: req.role }),
      role: req.role,
      collabToken: signCollabToken(req.user.id, req.doc.id),
    });
  });

  router.patch('/:id', access('editor'), (req, res) => {
    const { title } = validate(renameSchema, req.body);
    collab.setTitle(req.doc.id, title, req.user.id);
    res.json({ ok: true, title });
  });

  router.delete('/:id', access('owner'), (req, res) => {
    collab.closeDocument(req.doc.id);
    repo.deleteDocument(req.doc.id);
    res.status(204).end();
  });

  // ---------------------------------------------------------------- members

  router.get('/:id/members', access('viewer'), (req, res) => {
    const owner = repo.getUserById(req.doc.owner_id);
    res.json({
      owner: { id: owner.id, name: owner.name, email: owner.email, color: owner.color, role: 'owner' },
      members: repo.listMembers(req.doc.id).map((m) => ({
        id: m.id, name: m.name, email: m.email, color: m.color, role: m.role, addedAt: m.added_at,
      })),
    });
  });

  router.post('/:id/members', access('owner'), (req, res) => {
    const { email, role } = validate(memberSchema, req.body);
    const user = repo.getUserByEmail(email);
    if (!user) throw new HttpError(404, 'No account uses that email yet — send them a share link instead');
    if (user.id === req.doc.owner_id) throw new HttpError(400, 'The owner already has full access');
    repo.upsertMember(req.doc.id, user.id, role);
    collab.disconnectUser(req.doc.id, user.id);
    res.status(201).json({ ok: true });
  });

  router.patch('/:id/members/:userId', access('owner'), (req, res) => {
    const { role } = validate(roleSchema, req.body);
    if (!repo.getRole(req.doc.id, req.params.userId) || req.params.userId === req.doc.owner_id) {
      throw new HttpError(404, 'Member not found');
    }
    repo.upsertMember(req.doc.id, req.params.userId, role);
    collab.disconnectUser(req.doc.id, req.params.userId);
    res.json({ ok: true });
  });

  router.delete('/:id/members/:userId', access('viewer'), (req, res) => {
    const leaving = req.params.userId === req.user.id;
    if (!leaving && req.role !== 'owner') throw new HttpError(403, 'Only the owner can remove members');
    if (!repo.removeMember(req.doc.id, req.params.userId)) throw new HttpError(404, 'Member not found');
    collab.disconnectUser(req.doc.id, req.params.userId, CloseCode.FORBIDDEN, 'Access removed');
    res.status(204).end();
  });

  // ---------------------------------------------------------------- share links

  router.get('/:id/links', access('owner'), (req, res) => {
    const now = Date.now();
    res.json({
      links: repo.listShareLinks(req.doc.id).map((l) => ({
        id: l.id,
        role: l.role,
        createdAt: l.created_at,
        expiresAt: l.expires_at,
        revokedAt: l.revoked_at,
        uses: l.uses,
        createdBy: l.created_by_name,
        active: !l.revoked_at && (!l.expires_at || l.expires_at > now),
      })),
    });
  });

  router.post('/:id/links', access('owner'), (req, res) => {
    const { role, expiresInHours } = validate(linkSchema, req.body);
    const token = crypto.randomBytes(32).toString('base64url');
    const now = Date.now();
    const link = {
      id: crypto.randomUUID(),
      documentId: req.doc.id,
      tokenHash: hashShareToken(token), // only the hash is stored; the raw token is shown exactly once
      role,
      createdBy: req.user.id,
      createdAt: now,
      expiresAt: expiresInHours ? now + expiresInHours * 3600 * 1000 : null,
    };
    repo.createShareLink(link);
    res.status(201).json({
      link: { id: link.id, role, createdAt: now, expiresAt: link.expiresAt, uses: 0, active: true },
      url: `${config.publicUrl.replace(/\/$/, '')}/share/${token}`,
    });
  });

  router.delete('/:id/links/:linkId', access('owner'), (req, res) => {
    if (!repo.revokeShareLink(req.doc.id, req.params.linkId)) throw new HttpError(404, 'Link not found');
    res.status(204).end();
  });

  // ---------------------------------------------------------------- versions

  router.get('/:id/versions', access('viewer'), (req, res) => {
    const versions = repo.listVersions(req.doc.id);
    const ids = [...new Set(versions.flatMap((v) => v.authors))];
    const users = repo.getUsersByIds(ids);
    res.json({ versions: versions.map((v) => toVersion(v, users)) });
  });

  router.post('/:id/versions', access('editor'), (req, res) => {
    const { label } = validate(versionSchema, req.body);
    const v = collab.createVersion(req.doc.id, { label, createdBy: req.user.id });
    res.status(201).json({ version: { id: v.id, kind: v.kind, label: v.label, createdAt: v.createdAt } });
  });

  router.get('/:id/versions/:versionId', access('viewer'), (req, res) => {
    const v = repo.getVersion(req.doc.id, req.params.versionId);
    if (!v) throw new HttpError(404, 'Version not found');
    res.json({ version: { id: v.id, kind: v.kind, label: v.label, createdAt: v.created_at }, state: v.state.toString('base64') });
  });

  router.post('/:id/versions/:versionId/restore', access('editor'), (req, res) => {
    const v = repo.getVersion(req.doc.id, req.params.versionId);
    if (!v) throw new HttpError(404, 'Version not found');
    collab.restoreVersion(req.doc.id, v, req.user.id);
    res.json({ ok: true });
  });

  return router;
}

export { ROLE_RANK };
