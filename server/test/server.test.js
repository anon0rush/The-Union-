import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

process.env.NODE_ENV = 'test';
const { config } = await import('../src/config.js');
const { openDatabase } = await import('../src/db.js');
const { createServer } = await import('../src/app.js');

const ORIGIN = 'http://localhost:5173';
let base, wsBase, repo, instance;
const providers = [];

before(async () => {
  repo = openDatabase(':memory:');
  instance = createServer({ repo, config: { ...config, snapshotIntervalMs: 60 * 60 * 1000 }, rateLimits: false });
  await new Promise((resolve) => instance.server.listen(0, resolve));
  const { port } = instance.server.address();
  base = `http://localhost:${port}/api`;
  wsBase = `ws://localhost:${port}/collab`;
});

after(async () => {
  // Destroying the Y.Doc also stops each provider's awareness heartbeat timer.
  providers.forEach((p) => {
    p.destroy();
    p.doc.destroy();
  });
  await instance.close();
  repo.close();
});

async function api(method, path, { token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', origin: ORIGIN, ...(token && { authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

async function register(name) {
  const res = await api('POST', '/auth/register', {
    body: { name, email: `${name.toLowerCase()}@example.com`, password: 'correct horse battery' },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body;
}

function connect(documentId, collabToken) {
  const doc = new Y.Doc();
  const provider = new WebsocketProvider(wsBase, documentId, doc, {
    params: { token: collabToken },
    WebSocketPolyfill: class extends WebSocket {
      constructor(url, protocols) {
        super(url, protocols, { headers: { origin: ORIGIN } });
      }
    },
    disableBc: true,
  });
  providers.push(provider);
  return { doc, provider };
}

const synced = (provider) =>
  new Promise((resolve) => (provider.synced ? resolve() : provider.once('sync', (s) => s && resolve())));

async function eventually(check, timeout = 3000) {
  const start = Date.now();
  for (;;) {
    try {
      return check();
    } catch (err) {
      if (Date.now() - start > timeout) throw err;
      await new Promise((r) => setTimeout(r, 25));
    }
  }
}

const paragraphText = (doc) =>
  doc.getXmlFragment('default').toArray().map((p) => p.toArray().map((t) => t.toString()).join('')).join('\n');

function writeParagraph(doc, text) {
  doc.transact(() => {
    const fragment = doc.getXmlFragment('default');
    const p = new Y.XmlElement('paragraph');
    p.insert(0, [new Y.XmlText(text)]);
    fragment.insert(fragment.length, [p]);
  });
}

describe('The Union server', () => {
  let alice, bob, carol, docId, shareToken, shareLinkId;

  before(async () => {
    [alice, bob, carol] = await Promise.all([register('Alice'), register('Bob'), register('Carol')]);
  });

  it('rejects duplicate accounts and bad credentials', async () => {
    const dup = await api('POST', '/auth/register', { body: { name: 'A', email: 'ALICE@example.com', password: '12345678' } });
    assert.equal(dup.status, 409);
    const bad = await api('POST', '/auth/login', { body: { email: 'alice@example.com', password: 'nope' } });
    assert.equal(bad.status, 401);
    const good = await api('POST', '/auth/login', { body: { email: 'alice@example.com', password: 'correct horse battery' } });
    assert.equal(good.status, 200);
    assert.equal((await api('GET', '/documents')).status, 401);
  });

  it('creates documents and hides them from strangers', async () => {
    const created = await api('POST', '/documents', { token: alice.token, body: { title: 'Roadmap' } });
    assert.equal(created.status, 201);
    docId = created.body.document.id;
    assert.equal(created.body.document.role, 'owner');

    assert.equal((await api('GET', `/documents/${docId}`, { token: bob.token })).status, 404);
    const list = await api('GET', '/documents', { token: bob.token });
    assert.deepEqual(list.body.documents, []);
  });

  it('shares with members by email and via share links', async () => {
    const add = await api('POST', `/documents/${docId}/members`, { token: alice.token, body: { email: 'bob@example.com', role: 'editor' } });
    assert.equal(add.status, 201);
    // editors cannot manage sharing
    const denied = await api('POST', `/documents/${docId}/links`, { token: bob.token, body: { role: 'editor' } });
    assert.equal(denied.status, 403);

    const link = await api('POST', `/documents/${docId}/links`, { token: alice.token, body: { role: 'viewer', expiresInHours: 24 } });
    assert.equal(link.status, 201);
    shareToken = link.body.url.split('/share/')[1];
    shareLinkId = link.body.link.id;

    const preview = await api('GET', `/share/${shareToken}`, { token: carol.token });
    assert.equal(preview.body.title, 'Roadmap');
    assert.equal(preview.body.currentRole, null);
    const accept = await api('POST', `/share/${shareToken}/accept`, { token: carol.token });
    assert.deepEqual(accept.body, { documentId: docId, role: 'viewer' });

    // a viewer link never downgrades an editor
    const bobAccept = await api('POST', `/share/${shareToken}/accept`, { token: bob.token });
    assert.equal(bobAccept.body.role, 'editor');

    const members = await api('GET', `/documents/${docId}/members`, { token: carol.token });
    assert.deepEqual(members.body.members.map((m) => [m.name, m.role]), [['Bob', 'editor'], ['Carol', 'viewer']]);
  });

  it('syncs edits and cursors live, and enforces read-only viewers', async () => {
    const tokens = {};
    for (const [name, user] of Object.entries({ alice, bob, carol })) {
      tokens[name] = (await api('GET', `/documents/${docId}`, { token: user.token })).body.collabToken;
    }
    const a = connect(docId, tokens.alice);
    const b = connect(docId, tokens.bob);
    const c = connect(docId, tokens.carol);
    await Promise.all([synced(a.provider), synced(b.provider), synced(c.provider)]);

    assert.equal(b.doc.getMap('meta').get('title'), 'Roadmap');

    writeParagraph(a.doc, 'Hello from Alice');
    await eventually(() => assert.match(paragraphText(b.doc), /Hello from Alice/));
    writeParagraph(b.doc, 'Bob was here');
    await eventually(() => assert.match(paragraphText(a.doc), /Bob was here/));
    await eventually(() => assert.match(paragraphText(c.doc), /Bob was here/));

    // Carol is a viewer: her local edit must not reach anyone else.
    writeParagraph(c.doc, 'Carol vandalism');
    writeParagraph(a.doc, 'After Carol');
    await eventually(() => assert.match(paragraphText(b.doc), /After Carol/));
    assert.doesNotMatch(paragraphText(b.doc), /Carol vandalism/);

    // Live cursors / presence travel over the awareness protocol.
    b.provider.awareness.setLocalStateField('user', { name: 'Bob', color: '#2563eb' });
    await eventually(() => {
      const names = [...a.provider.awareness.getStates().values()].map((s) => s.user?.name);
      assert.ok(names.includes('Bob'));
    });

    // Renaming over REST updates every open editor.
    await api('PATCH', `/documents/${docId}`, { token: bob.token, body: { title: 'Roadmap 2027' } });
    await eventually(() => assert.equal(c.doc.getMap('meta').get('title'), 'Roadmap 2027'));
    assert.equal((await api('PATCH', `/documents/${docId}`, { token: carol.token, body: { title: 'x' } })).status, 403);
  });

  it('records versions and restores them for everyone', async () => {
    const saved = await api('POST', `/documents/${docId}/versions`, { token: bob.token, body: { label: 'Draft 1' } });
    assert.equal(saved.status, 201);

    const a = providers[0];
    writeParagraph(a.doc, 'Something we will regret');
    const b = providers[1];
    await eventually(() => assert.match(paragraphText(b.doc), /regret/));

    const list = await api('GET', `/documents/${docId}/versions`, { token: carol.token });
    const draft = list.body.versions.find((v) => v.label === 'Draft 1');
    assert.ok(draft);
    assert.deepEqual(draft.authors.map((u) => u.name).sort(), ['Alice', 'Bob']);

    const full = await api('GET', `/documents/${docId}/versions/${draft.id}`, { token: carol.token });
    const snapshot = new Y.Doc();
    Y.applyUpdate(snapshot, Buffer.from(full.body.state, 'base64'));
    assert.doesNotMatch(paragraphText(snapshot), /regret/);

    assert.equal((await api('POST', `/documents/${docId}/versions/${draft.id}/restore`, { token: carol.token })).status, 403);
    const restore = await api('POST', `/documents/${docId}/versions/${draft.id}/restore`, { token: alice.token });
    assert.equal(restore.status, 200);
    await eventually(() => {
      assert.doesNotMatch(paragraphText(b.doc), /regret/);
      assert.match(paragraphText(b.doc), /After Carol/);
    });

    const after = await api('GET', `/documents/${docId}/versions`, { token: alice.token });
    assert.ok(after.body.versions.some((v) => v.kind === 'restore' && v.label.startsWith('Before restoring')));
  });

  it('revokes links and kicks removed members', async () => {
    assert.equal((await api('DELETE', `/documents/${docId}/links/${shareLinkId}`, { token: alice.token })).status, 204);
    const dave = await register('Dave');
    assert.equal((await api('POST', `/share/${shareToken}/accept`, { token: dave.token })).status, 410);

    const carolProvider = providers[2];
    const closed = new Promise((resolve) => carolProvider.once('connection-close', (event) => resolve(event.code)));
    assert.equal((await api('DELETE', `/documents/${docId}/members/${carol.user.id}`, { token: alice.token })).status, 204);
    assert.equal(await closed, 4403);
    carolProvider.disconnect();
    assert.equal((await api('GET', `/documents/${docId}`, { token: carol.token })).status, 404);
  });

  it('rejects sockets with bad tokens or foreign origins', async () => {
    const code = (url, origin) =>
      new Promise((resolve) => {
        const ws = new WebSocket(url, { headers: { origin } });
        ws.on('close', (c) => resolve(c));
      });
    assert.equal(await code(`${wsBase}/${docId}?token=garbage`, ORIGIN), 4401);
    const { collabToken } = (await api('GET', `/documents/${docId}`, { token: alice.token })).body;
    assert.equal(await code(`${wsBase}/${docId}?token=${collabToken}`, 'https://evil.example'), 4403);
    // a token for one document cannot open another
    const other = await api('POST', '/documents', { token: alice.token, body: {} });
    assert.equal(await code(`${wsBase}/${other.body.document.id}?token=${collabToken}`, ORIGIN), 4401);
  });

  it('persists to the database once everyone leaves', async () => {
    providers.forEach((p) => p.disconnect());
    await eventually(() => {
      assert.equal(instance.collab.stats().rooms, 0);
      const doc = new Y.Doc();
      Y.applyUpdate(doc, repo.getDocumentState(docId));
      assert.match(paragraphText(doc), /After Carol/);
      assert.equal(repo.getDocument(docId).title, 'Roadmap 2027');
    });
  });

  it('lets only the owner delete', async () => {
    assert.equal((await api('DELETE', `/documents/${docId}`, { token: bob.token })).status, 403);
    assert.equal((await api('DELETE', `/documents/${docId}`, { token: alice.token })).status, 204);
    assert.equal((await api('GET', `/documents/${docId}`, { token: bob.token })).status, 404);
  });
});
