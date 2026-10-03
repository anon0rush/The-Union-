# The Union

A full-stack **real-time collaborative document editor**. Multiple people edit the same document at the same time and see each other's **live cursors**. Edits merge without conflicts (CRDT), keep working **offline**, and every document has a **version history** with one-click restore. Documents are shared securely with **roles, expiring links and revocation**.

| | |
|---|---|
| **Frontend** | React 18, Vite, TipTap 3 (ProseMirror), Yjs, y-websocket, y-indexeddb |
| **Backend** | Node.js 22+, Express, `ws`, Yjs + y-protocols, SQLite (`node:sqlite`, no native build) |
| **Security** | bcrypt, JWT, helmet, rate limiting, zod validation, server-enforced roles |

## Features

**Real-time collaboration**
- Character-level live editing over WebSockets, using the Yjs CRDT. Concurrent edits always converge, so there are no locks and no "someone else is editing" errors.
- **Live cursors and selections**, labelled with each collaborator's name and color.
- A presence bar showing who has the document open, one avatar per person even if they have several tabs open.
- **Offline-first.** Every document is cached in IndexedDB, so it opens instantly and accepts edits with no connection. Those edits merge automatically when you reconnect. A connection badge shows *Live / Syncing / Connecting / Offline*.
- Per-user undo/redo: you undo your own typing, never a collaborator's.
- The title is part of the shared document, so renames appear live everywhere.

**Document management**
- A dashboard listing every document you own or that is shared with you. You can filter (*All / Owned by me / Shared with me*), search, create, rename, delete (owner only) and leave (members).
- A rich editor with headings, bold/italic/underline/strike, highlight, inline code, code blocks, links, bulleted/numbered lists, checklists, quotes, dividers, alignment, and word/character counts.

**Version history**
- **Automatic snapshots**: at most one every 5 minutes while people edit (configurable), plus one when the last person leaves.
- **Named versions** that you can save at any time.
- Each version records **who contributed** to it.
- You can preview any version read-only, then **restore** it for everyone live. Before restoring, the current state is saved as a "Before restore" version, so a restore can always be undone.
- Old automatic snapshots are pruned (the newest 200 are kept). Named versions are never pruned.

**Secure sharing**
- Three roles: **Owner**, **Editor** and **Viewer**.
- Invite people by email, change their role or remove them.
- **Share links** with a chosen role and expiry (1 day, 7 days, 30 days or never), a use counter and **revocation**. Only a SHA-256 hash of each link token is stored, and the full link is shown once.
- A link can upgrade your access but never downgrade it.
- Permission changes take effect **immediately**. A removed user's live connection is closed and their offline copy is wiped. A user whose role changes is reconnected with the new role.

## Security model

- **The server enforces read-only access.** Updates from viewers' sockets are dropped, whatever their client does.
- Passwords are hashed with bcrypt (cost 12). Logging in with an unknown email does the same bcrypt work as a wrong password, so timing does not reveal which emails have accounts.
- The REST API uses a 7-day session JWT. The WebSocket uses a separate **12-hour token scoped to a single document**, so the long-lived session token never appears in a URL. On every connection, the server checks the role against the database at that moment.
- WebSocket `Origin` allow-list, CORS allow-list, helmet security headers, JSON body size limits, a 10 MB WebSocket message cap, and rate limits (30 auth attempts per 15 minutes per IP and 600 API calls per minute).
- All input is validated with zod. Every SQL query is parameterized.
- A document someone cannot access returns **404 rather than 403**, so its existence isn't leaked.
- After login the app only redirects to same-site relative paths (no open redirect).
- `JWT_SECRET` is required in production. In development an ephemeral secret is generated.

## Getting started

Requires **Node.js 22.13+**. SQLite is built into Node, so there is no database to install.

```bash
npm install
npm run dev
```

This starts the API and WebSocket server on http://localhost:4000 and the web app on **http://localhost:5173**. Vite proxies `/api` and `/collab` to the server.

To try collaboration, register two accounts, one in a normal window and one in a private window. Create a document, click **Share**, then either invite the second account by email or create a link and open it in the other window.

### Configuration

Copy `server/.env.example` to `server/.env`:

| Variable | Default | Purpose |
|---|---|---|
| `JWT_SECRET` | ephemeral in dev | **Required in production.** Signs session and collaboration tokens |
| `PORT` | `4000` | HTTP and WebSocket port |
| `DB_PATH` | `data/union.db` | SQLite database file |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Comma-separated browser origins allowed for CORS and WebSockets |
| `PUBLIC_URL` | `http://localhost:5173` | Base URL used when generating share links |
| `SNAPSHOT_INTERVAL_MINUTES` | `5` | Minimum time between automatic version snapshots |

### Production

```bash
npm run build                      # builds client/dist
NODE_ENV=production JWT_SECRET=... PUBLIC_URL=https://docs.example.com CLIENT_ORIGIN=https://docs.example.com npm start
```

In production the server also serves the built client, so the app, API and WebSocket share one origin. Put it behind TLS (`wss://`).

You can also run it with Docker:

```bash
JWT_SECRET=$(openssl rand -hex 48) docker compose up --build   # → http://localhost:4000
```

### Tests

```bash
npm test
```

These are integration tests that start a real server and connect real `y-websocket` clients. They cover:
- authentication and duplicate or invalid credentials
- access isolation between users
- invites and share links, including that a link never downgrades access
- live sync between editors and enforcement of read-only viewers
- presence over the awareness protocol
- live renames
- named versions, contributor tracking and restore for every connected client
- link revocation and kicking removed members
- rejecting forged or foreign-origin sockets and cross-document tokens
- persistence after everyone disconnects, and owner-only delete

## Architecture

```
Browser (per open document)                         Server
┌───────────────────────────────┐   WebSocket   ┌──────────────────────────────────┐
│ TipTap editor                 │  /collab/:id  │ collab.js — one "room" per open  │
│  ├─ Collaboration (Y.XmlFrag) │◀────────────▶│ doc: Y.Doc + Awareness           │
│  └─ CollaborationCaret        │  y-websocket  │  • sync step 1/2 + updates       │
│ Y.Doc ── y-indexeddb (offline)│   protocol    │  • role check (viewers read-only)│
│ Awareness (cursor, presence)  │               │  • debounced save → SQLite       │
└───────────────────────────────┘               │  • auto snapshots → versions     │
            │ REST /api (JWT)                   └──────────────────────────────────┘
            └──────────────────────────────────▶ Express: auth, documents, members,
                                                 share links, versions
```

- **Why a CRDT?** With Yjs, every client applies operations locally right away and exchanges compact binary updates. Updates commute, so all replicas converge, whether the edits were concurrent or made offline. This avoids the central sequencing that operational transforms need.
- **Persistence.** A room keeps the authoritative `Y.Doc` in memory while anyone is connected. It is saved to SQLite 1 second after a burst of edits (or at most every 10 seconds of continuous typing) and when the last person leaves. Then the room is unloaded.
- **Restore** replaces the content of the live shared document inside a single Yjs transaction. Restores are therefore just another CRDT change: they sync to everyone and cached offline copies merge them correctly.
- **Scaling out.** The current server is a single process. Because the sync layer speaks the standard y-websocket protocol, you can scale horizontally by routing each document to one node (consistent hashing on the document id) or by relaying room updates over Redis pub/sub. The storage layer is isolated in `server/src/db.js`, so it can be swapped for Postgres.

## Project layout

```
server/
  src/index.js            entry point and graceful shutdown (flushes open documents)
  src/app.js              Express app, security middleware, WebSocket auth
  src/collab.js           real-time engine: rooms, sync, awareness, persistence, versions
  src/db.js               SQLite schema and queries
  src/auth.js             session and document-scoped tokens
  src/routes/             auth, documents (members, links, versions), share links
  test/                   integration tests
client/
  src/pages/              Auth, Dashboard, Document, Share-link landing
  src/components/         editor, toolbar, presence, share dialog, version history
  src/lib/                API client, auth context, collaboration hook, offline cache
```
