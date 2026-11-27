export const ROLES = ['editor', 'viewer'];

export const ROLE_RANK = { viewer: 1, editor: 2, owner: 3 };

export const canWrite = (role) => role === 'owner' || role === 'editor';

export const hasRole = (role, minRole) => ROLE_RANK[role] >= ROLE_RANK[minRole];
