import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { makeDocx, makePdf } from './fixtures.js';

process.env.NODE_ENV = 'test';
const { config } = await import('../src/config/env.js');
const { openDatabase } = await import('../src/db/index.js');
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

async function upload(token, fileName, bytes) {
  const form = new FormData();
  form.append('file', new Blob([bytes]), fileName);
  const res = await fetch(`${base}/import`, {
    method: 'POST',
    headers: { origin: ORIGIN, authorization: `Bearer ${token}` },
    body: form,
  });
  return { status: res.status, body: await res.json() };
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

    writeParagraph(c.doc, 'Carol vandalism');
    writeParagraph(a.doc, 'After Carol');
    await eventually(() => assert.match(paragraphText(b.doc), /After Carol/));
    assert.doesNotMatch(paragraphText(b.doc), /Carol vandalism/);

    b.provider.awareness.setLocalStateField('user', { name: 'Bob', color: '#2563eb' });
    await eventually(() => {
      const names = [...a.provider.awareness.getStates().values()].map((s) => s.user?.name);
      assert.ok(names.includes('Bob'));
    });

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

  it('imports Word, PDF and Markdown files and rejects anything else', async () => {
    const docx = makeDocx(
      '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Meeting notes</w:t></w:r></w:p>' +
        '<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Decision:</w:t></w:r><w:r><w:t xml:space="preserve"> ship on Friday.</w:t></w:r></w:p>',
    );
    const word = await upload(alice.token, 'meeting_notes.docx', docx);
    assert.equal(word.status, 200, JSON.stringify(word.body));
    assert.equal(word.body.title, 'meeting notes');
    assert.equal(word.body.format, 'docx');
    assert.match(word.body.html, /<h1>Meeting notes<\/h1>/);
    assert.match(word.body.html, /<strong>Decision:<\/strong> ship on Friday\./);

    const pdf = makePdf([
      { text: 'Quarterly report', size: 24, y: 700 },
      { text: 'Summary', size: 16, y: 680 },
      { text: 'Revenue grew in every region.', size: 12, y: 660 },
      { text: 'Costs stayed flat.', size: 12, y: 645 },
      { text: '- Hire two engineers', size: 12, y: 610 },
    ]);
    const report = await upload(alice.token, 'report.pdf', pdf);
    assert.equal(report.status, 200, JSON.stringify(report.body));
    assert.equal(report.body.pages, 1);
    assert.match(report.body.html, /<h1>Quarterly report<\/h1>/);
    assert.match(report.body.html, /<h3>Summary<\/h3>/);
    assert.match(report.body.html, /<p>Revenue grew in every region\. Costs stayed flat\.<\/p>/);
    assert.match(report.body.html, /<ul><li><p>Hire two engineers<\/p><\/li><\/ul>/);

    const md = await upload(alice.token, 'plan.md', Buffer.from('# Plan\n\nFirst <script>x</script> step\n\n- one\n- two'));
    assert.equal(md.status, 200);
    assert.match(md.body.html, /<h1>Plan<\/h1>/);
    assert.match(md.body.html, /&lt;script&gt;/);
    assert.match(md.body.html, /<ul><li><p>one<\/p><\/li><li><p>two<\/p><\/li><\/ul>/);

    assert.equal((await upload(alice.token, 'virus.exe', Buffer.from('MZ'))).status, 415);
    assert.equal((await upload(alice.token, 'fake.pdf', Buffer.from('not a pdf'))).status, 415);
    assert.equal((await upload(alice.token, 'empty.txt', Buffer.from('   '))).status, 422);
    assert.equal((await upload(alice.token, 'big.txt', Buffer.alloc(11 * 1024 * 1024, 97))).status, 413);
    assert.equal((await upload(null, 'plan.md', Buffer.from('# Plan'))).status, 401);

    const created = await api('POST', '/documents', {
      token: alice.token,
      body: { title: 'Quarterly report', importedFrom: 'report.pdf' },
    });
    const log = await api('GET', `/documents/${created.body.document.id}/activity`, { token: alice.token });
    assert.deepEqual(log.body.activity[0].detail, { title: 'Quarterly report', file: 'report.pdf' });
    assert.equal(log.body.activity[0].action, 'document.imported');
  });

  it('stars documents per user', async () => {
    const star = await api('PUT', `/documents/${docId}/star`, { token: bob.token });
    assert.deepEqual(star.body, { starred: true });

    const bobList = await api('GET', '/documents', { token: bob.token });
    assert.equal(bobList.body.documents.find((d) => d.id === docId).starred, true);
    const aliceList = await api('GET', '/documents', { token: alice.token });
    assert.equal(aliceList.body.documents.find((d) => d.id === docId).starred, false);

    await api('DELETE', `/documents/${docId}/star`, { token: bob.token });
    const detail = await api('GET', `/documents/${docId}`, { token: bob.token });
    assert.equal(detail.body.document.starred, false);
  });

  it('records an activity log visible to every member', async () => {
    const res = await api('GET', `/documents/${docId}/activity`, { token: carol.token });
    assert.equal(res.status, 200);
    const actions = res.body.activity.map((a) => a.action);
    for (const action of [
      'document.created',
      'member.added',
      'link.created',
      'link.accepted',
      'document.renamed',
      'version.saved',
      'version.restored',
    ]) {
      assert.ok(actions.includes(action), `missing ${action}`);
    }
    assert.equal(actions.at(-1), 'document.created');
    const added = res.body.activity.find((a) => a.action === 'member.added');
    assert.deepEqual(added.detail, { name: 'Bob', role: 'editor' });
    assert.equal(added.user.name, 'Alice');
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
      const listed = repo.listDocumentsForUser(alice.user.id).find((d) => d.id === docId);
      assert.match(listed.excerpt, /Hello from Alice/);
      assert.ok(listed.word_count >= 6);
    });
  });

  it('lets only the owner delete', async () => {
    assert.equal((await api('DELETE', `/documents/${docId}`, { token: bob.token })).status, 403);
    assert.equal((await api('DELETE', `/documents/${docId}`, { token: alice.token })).status, 204);
    assert.equal((await api('GET', `/documents/${docId}`, { token: bob.token })).status, 404);
  });
});
