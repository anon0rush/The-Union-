export const offlineKey = (userId, documentId) => `union:${userId}:${documentId}`;

export async function clearOfflineCopies(userId) {
  if (!('indexedDB' in window) || typeof indexedDB.databases !== 'function') return;
  try {
    const dbs = await indexedDB.databases();
    await Promise.all(
      dbs
        .filter((db) => db.name?.startsWith(`union:${userId}:`))
        .map(
          (db) =>
            new Promise((resolve) => {
              const req = indexedDB.deleteDatabase(db.name);
              req.onsuccess = req.onerror = req.onblocked = () => resolve();
            }),
        ),
    );
  } catch (err) {
    console.warn('Could not clear offline copies', err);
  }
}
