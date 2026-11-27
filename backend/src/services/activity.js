import crypto from 'node:crypto';

export const Activity = {
  DOCUMENT_CREATED: 'document.created',
  DOCUMENT_IMPORTED: 'document.imported',
  DOCUMENT_RENAMED: 'document.renamed',
  MEMBER_ADDED: 'member.added',
  MEMBER_ROLE_CHANGED: 'member.role_changed',
  MEMBER_REMOVED: 'member.removed',
  MEMBER_LEFT: 'member.left',
  LINK_CREATED: 'link.created',
  LINK_REVOKED: 'link.revoked',
  LINK_ACCEPTED: 'link.accepted',
  VERSION_SAVED: 'version.saved',
  VERSION_RESTORED: 'version.restored',
};

export function recordActivity(repo, { documentId, userId, action, detail }) {
  repo.logActivity({ id: crypto.randomUUID(), documentId, userId, action, detail, createdAt: Date.now() });
}
