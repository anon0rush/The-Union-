export function createRepository(db) {
  const q = (sql) => db.prepare(sql);
  const toBuffer = (blob) => (blob ? Buffer.from(blob) : null);

  const stmts = {
    insertUser: q(`INSERT INTO users (id, email, name, password_hash, color, created_at) VALUES (?, ?, ?, ?, ?, ?)`),
    userByEmail: q(`SELECT * FROM users WHERE email = ?`),
    userById: q(`SELECT id, email, name, color, created_at FROM users WHERE id = ?`),

    insertDocument: q(`INSERT INTO documents (id, title, owner_id, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`),
    documentById: q(`SELECT id, title, owner_id, created_at, updated_at FROM documents WHERE id = ?`),
    documentState: q(`SELECT state FROM documents WHERE id = ?`),
    saveDocumentState: q(`UPDATE documents SET state = ?, title = ?, excerpt = ?, word_count = ?, updated_at = ? WHERE id = ?`),
    deleteDocument: q(`DELETE FROM documents WHERE id = ?`),
    documentsWithoutSummary: q(`SELECT id, state FROM documents WHERE state IS NOT NULL AND excerpt = '' AND word_count = 0`),
    saveSummary: q(`UPDATE documents SET excerpt = ?, word_count = ? WHERE id = ?`),
    listDocuments: q(`
      SELECT d.id, d.title, d.excerpt, d.word_count, d.created_at, d.updated_at, d.owner_id,
             u.name AS owner_name,
             CASE WHEN d.owner_id = :userId THEN 'owner' ELSE m.role END AS role,
             EXISTS (SELECT 1 FROM document_stars s WHERE s.document_id = d.id AND s.user_id = :userId) AS starred
      FROM documents d
      JOIN users u ON u.id = d.owner_id
      LEFT JOIN document_members m ON m.document_id = d.id AND m.user_id = :userId
      WHERE d.owner_id = :userId OR m.user_id IS NOT NULL
      ORDER BY d.updated_at DESC`),

    memberRole: q(`SELECT role FROM document_members WHERE document_id = ? AND user_id = ?`),
    upsertMember: q(`
      INSERT INTO document_members (document_id, user_id, role, added_at) VALUES (?, ?, ?, ?)
      ON CONFLICT (document_id, user_id) DO UPDATE SET role = excluded.role`),
    deleteMember: q(`DELETE FROM document_members WHERE document_id = ? AND user_id = ?`),
    listMembers: q(`
      SELECT u.id, u.name, u.email, u.color, m.role, m.added_at
      FROM document_members m JOIN users u ON u.id = m.user_id
      WHERE m.document_id = ? ORDER BY m.added_at`),

    insertLink: q(`INSERT INTO share_links (id, document_id, token_hash, role, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)`),
    linkByHash: q(`SELECT * FROM share_links WHERE token_hash = ?`),
    listLinks: q(`
      SELECT l.id, l.role, l.created_at, l.expires_at, l.revoked_at, l.uses, u.name AS created_by_name
      FROM share_links l JOIN users u ON u.id = l.created_by
      WHERE l.document_id = ? ORDER BY l.created_at DESC`),
    revokeLink: q(`UPDATE share_links SET revoked_at = ? WHERE id = ? AND document_id = ? AND revoked_at IS NULL`),
    incrementLinkUses: q(`UPDATE share_links SET uses = uses + 1 WHERE id = ?`),

    insertStar: q(`INSERT OR IGNORE INTO document_stars (user_id, document_id, created_at) VALUES (?, ?, ?)`),
    deleteStar: q(`DELETE FROM document_stars WHERE user_id = ? AND document_id = ?`),
    isStarred: q(`SELECT 1 FROM document_stars WHERE user_id = ? AND document_id = ?`),

    insertActivity: q(`INSERT INTO activity (id, document_id, user_id, action, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)`),
    listActivity: q(`
      SELECT a.id, a.action, a.detail, a.created_at, a.user_id, u.name AS user_name, u.color AS user_color
      FROM activity a LEFT JOIN users u ON u.id = a.user_id
      WHERE a.document_id = ? ORDER BY a.created_at DESC, a.rowid DESC LIMIT ?`),

    insertVersion: q(`INSERT INTO versions (id, document_id, state, kind, label, created_by, authors, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`),
    listVersions: q(`
      SELECT v.id, v.kind, v.label, v.created_at, v.authors, v.created_by, u.name AS created_by_name, length(v.state) AS size
      FROM versions v LEFT JOIN users u ON u.id = v.created_by
      WHERE v.document_id = ? ORDER BY v.created_at DESC, v.rowid DESC`),
    versionById: q(`SELECT * FROM versions WHERE id = ? AND document_id = ?`),
    pruneVersions: q(`
      DELETE FROM versions WHERE document_id = :docId AND kind = 'auto' AND id NOT IN (
        SELECT id FROM versions WHERE document_id = :docId ORDER BY created_at DESC, rowid DESC LIMIT :keep)`),
  };

  return {
    raw: db,
    close: () => db.close(),

    createUser: (u) => stmts.insertUser.run(u.id, u.email, u.name, u.passwordHash, u.color, u.createdAt),
    getUserByEmail: (email) => stmts.userByEmail.get(email) ?? null,
    getUserById: (id) => stmts.userById.get(id) ?? null,
    getUsersByIds(ids) {
      if (!ids.length) return {};
      const rows = db
        .prepare(`SELECT id, name, color FROM users WHERE id IN (${ids.map(() => '?').join(',')})`)
        .all(...ids);
      return Object.fromEntries(rows.map((r) => [r.id, { id: r.id, name: r.name, color: r.color }]));
    },

    createDocument: (d) => stmts.insertDocument.run(d.id, d.title, d.ownerId, d.state, d.createdAt, d.createdAt),
    getDocument: (id) => stmts.documentById.get(id) ?? null,
    getDocumentState: (id) => toBuffer(stmts.documentState.get(id)?.state),
    saveDocumentState: (id, { state, title, excerpt, wordCount, updatedAt }) =>
      stmts.saveDocumentState.run(state, title, excerpt, wordCount, updatedAt, id),
    deleteDocument: (id) => stmts.deleteDocument.run(id),
    documentsWithoutSummary: () => stmts.documentsWithoutSummary.all().map((d) => ({ id: d.id, state: toBuffer(d.state) })),
    saveSummary: (id, { excerpt, wordCount }) => stmts.saveSummary.run(excerpt, wordCount, id),
    listDocumentsForUser: (userId) => stmts.listDocuments.all({ userId }),

    getRole(documentId, userId) {
      const doc = stmts.documentById.get(documentId);
      if (!doc) return null;
      if (doc.owner_id === userId) return 'owner';
      return stmts.memberRole.get(documentId, userId)?.role ?? null;
    },
    upsertMember: (documentId, userId, role) => stmts.upsertMember.run(documentId, userId, role, Date.now()),
    removeMember(documentId, userId) {
      stmts.deleteStar.run(userId, documentId);
      return stmts.deleteMember.run(documentId, userId).changes > 0;
    },
    listMembers: (documentId) => stmts.listMembers.all(documentId),

    createShareLink: (l) =>
      stmts.insertLink.run(l.id, l.documentId, l.tokenHash, l.role, l.createdBy, l.createdAt, l.expiresAt ?? null),
    getShareLinkByHash: (hash) => stmts.linkByHash.get(hash) ?? null,
    listShareLinks: (documentId) => stmts.listLinks.all(documentId),
    revokeShareLink: (documentId, linkId) => stmts.revokeLink.run(Date.now(), linkId, documentId).changes > 0,
    recordShareLinkUse: (linkId) => stmts.incrementLinkUses.run(linkId),

    setStarred(userId, documentId, starred) {
      if (starred) stmts.insertStar.run(userId, documentId, Date.now());
      else stmts.deleteStar.run(userId, documentId);
    },
    isStarred: (userId, documentId) => Boolean(stmts.isStarred.get(userId, documentId)),

    logActivity: (a) =>
      stmts.insertActivity.run(a.id, a.documentId, a.userId ?? null, a.action, JSON.stringify(a.detail ?? {}), a.createdAt),
    listActivity: (documentId, limit = 100) =>
      stmts.listActivity.all(documentId, limit).map((a) => ({ ...a, detail: JSON.parse(a.detail) })),

    createVersion(v) {
      stmts.insertVersion.run(
        v.id, v.documentId, v.state, v.kind, v.label ?? null, v.createdBy ?? null,
        JSON.stringify(v.authors ?? []), v.createdAt,
      );
      stmts.pruneVersions.run({ docId: v.documentId, keep: v.keep ?? 200 });
    },
    listVersions: (documentId) =>
      stmts.listVersions.all(documentId).map((v) => ({ ...v, authors: JSON.parse(v.authors) })),
    getVersion(documentId, versionId) {
      const v = stmts.versionById.get(versionId, documentId);
      return v ? { ...v, state: toBuffer(v.state), authors: JSON.parse(v.authors) } : null;
    },
  };
}
