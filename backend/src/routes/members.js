import express from 'express';
import { validate } from '../middleware/validate.js';
import { CloseCode } from '../realtime/closeCodes.js';
import { Activity, recordActivity } from '../services/activity.js';
import { HttpError } from '../utils/HttpError.js';
import { addMemberSchema, updateMemberSchema } from '../validation/schemas.js';

const toMember = (m) => ({ id: m.id, name: m.name, email: m.email, color: m.color, role: m.role, addedAt: m.added_at });

export function membersRouter({ repo, collab, access }) {
  const router = express.Router({ mergeParams: true });
  const log = (req, action, detail) =>
    recordActivity(repo, { documentId: req.doc.id, userId: req.user.id, action, detail });

  router.get('/', access('viewer'), (req, res) => {
    const owner = repo.getUserById(req.doc.owner_id);
    res.json({
      owner: { id: owner.id, name: owner.name, email: owner.email, color: owner.color, role: 'owner' },
      members: repo.listMembers(req.doc.id).map(toMember),
    });
  });

  router.post('/', access('owner'), (req, res) => {
    const { email, role } = validate(addMemberSchema, req.body);
    const user = repo.getUserByEmail(email);
    if (!user) throw new HttpError(404, 'No account uses that email yet. Send them a share link instead.');
    if (user.id === req.doc.owner_id) throw new HttpError(400, 'The owner already has full access');
    repo.upsertMember(req.doc.id, user.id, role);
    collab.disconnectUser(req.doc.id, user.id);
    log(req, Activity.MEMBER_ADDED, { name: user.name, role });
    res.status(201).json({ ok: true });
  });

  router.patch('/:userId', access('owner'), (req, res) => {
    const { role } = validate(updateMemberSchema, req.body);
    const { userId } = req.params;
    if (userId === req.doc.owner_id || !repo.getRole(req.doc.id, userId)) {
      throw new HttpError(404, 'Member not found');
    }
    repo.upsertMember(req.doc.id, userId, role);
    collab.disconnectUser(req.doc.id, userId);
    log(req, Activity.MEMBER_ROLE_CHANGED, { name: repo.getUserById(userId)?.name, role });
    res.json({ ok: true });
  });

  router.delete('/:userId', access('viewer'), (req, res) => {
    const { userId } = req.params;
    const isLeaving = userId === req.user.id;
    if (!isLeaving && req.role !== 'owner') throw new HttpError(403, 'Only the owner can remove members');
    const member = repo.getUserById(userId);
    if (!repo.removeMember(req.doc.id, userId)) throw new HttpError(404, 'Member not found');
    collab.disconnectUser(req.doc.id, userId, CloseCode.FORBIDDEN, 'Access removed');
    if (isLeaving) log(req, Activity.MEMBER_LEFT, {});
    else log(req, Activity.MEMBER_REMOVED, { name: member?.name });
    res.status(204).end();
  });

  return router;
}
