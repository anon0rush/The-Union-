# The Union

A real-time collaborative document editor. Multiple users can edit the same document at once, see each other's cursors, keep working offline, and restore earlier versions. Documents are shared through role-based access and expiring share links.

## Tech stack

| Layer | Technologies |
|---|---|
| Frontend | React 18, Vite, React Router, TipTap (ProseMirror), Yjs, y-websocket, y-indexeddb |
| Backend | Node.js 22, Express, WebSockets (`ws`), Yjs, y-protocols |
| Database | SQLite via the built-in `node:sqlite` module, with versioned migrations |
| Auth | JWT session tokens, document-scoped collaboration tokens, bcrypt password hashing |
| Security | helmet, CORS and WebSocket origin allow-lists, rate limiting, zod validation |
| DevOps | Docker multi-stage build, docker-compose, GitHub Actions CI |

## Features

- Live collaborative editing with conflict-free merging (CRDT)
- Live cursors, a presence bar, and follow mode to keep another person's cursor in view
- Offline editing that syncs automatically on reconnect
- Version history with automatic snapshots, named versions and restore
- Activity log of sharing, renames and version changes
- Owner, editor and viewer roles, enforced on the server
- Invite by email or by share link with expiry, usage count and revocation
- Command menu (Cmd/Ctrl + K) for documents and actions, plus keyboard shortcuts (press ?)
- Document outline built from headings, starred documents, and light, dark or system theme
- Import Word (.docx), PDF, Markdown and plain text files by upload or drag and drop
- Export to Markdown or HTML, or print and save as PDF
- Rich text editor with headings, lists, checklists, code blocks, links and alignment

## Project structure

```
.
├── backend/
│   ├── src/
│   │   ├── config/         environment configuration
│   │   ├── db/             SQL schema, connection and repository
│   │   ├── middleware/     auth, document access, validation, rate limiting, errors
│   │   ├── realtime/       WebSocket collaboration server and socket authentication
│   │   ├── routes/         REST endpoints: auth, documents, members, links, versions, share
│   │   ├── services/       activity log and file import (Word, PDF, Markdown, text)
│   │   ├── utils/          tokens, permissions, HTTP errors
│   │   ├── validation/     request schemas
│   │   ├── app.js          Express app setup
│   │   └── server.js       entry point and graceful shutdown
│   └── tests/              integration tests
├── frontend/
│   └── src/
│       ├── api/            HTTP client
│       ├── components/     UI components
│       ├── context/        authentication, theme and command menu state
│       ├── editor/         editor extensions
│       ├── hooks/          collaboration hook
│       ├── pages/          route pages
│       ├── styles/         global styles
│       └── utils/          formatting and offline storage helpers
├── .github/workflows/      CI pipeline
├── .vscode/                editor tasks and debug configurations
├── Dockerfile
└── docker-compose.yml
```

## Getting started

Requirements: Node.js 22.13 or later. No database server is needed.

```bash
npm install
cp backend/.env.example backend/.env
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:4000/api

In VS Code, open the project folder and run **Terminal → Run Build Task** to start both servers, or use the **Run and Debug** panel to debug the backend.

## Environment variables

Defined in `backend/.env`:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | HTTP and WebSocket port |
| `JWT_SECRET` | generated in development | Secret used to sign tokens. Required in production |
| `DB_PATH` | `data/union.db` | SQLite database file |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Allowed browser origins, comma separated |
| `PUBLIC_URL` | `http://localhost:5173` | Base URL for generated share links |
| `SNAPSHOT_INTERVAL_MINUTES` | `5` | Minimum interval between automatic snapshots |

## API overview

| Method | Endpoint | Access |
|---|---|---|
| POST | `/api/auth/register` | Public |
| POST | `/api/auth/login` | Public |
| GET | `/api/auth/me` | Authenticated |
| GET, POST | `/api/documents` | Authenticated |
| GET, PATCH, DELETE | `/api/documents/:id` | Viewer, Editor, Owner |
| GET, POST, PATCH, DELETE | `/api/documents/:id/members` | Viewer / Owner |
| GET, POST, DELETE | `/api/documents/:id/links` | Owner |
| GET, POST | `/api/documents/:id/versions` | Viewer / Editor |
| PUT, DELETE | `/api/documents/:id/star` | Viewer |
| GET | `/api/documents/:id/activity` | Viewer |
| POST | `/api/import` | Authenticated (multipart upload, max 10 MB) |
| POST | `/api/documents/:id/versions/:versionId/restore` | Editor |
| GET, POST | `/api/share/:token` | Authenticated |
| WS | `/collab/:id?token=...` | Document member |

## Security

- Passwords are hashed with bcrypt, and login takes the same time whether or not the email exists.
- REST requests use a 7-day session token. WebSocket connections use a separate 12-hour token valid for one document only.
- Roles are checked on every request and every socket connection. Updates from viewers are rejected on the server.
- Share link tokens are stored as SHA-256 hashes and shown only once.
- Documents a user cannot access return 404, so their existence is not revealed.
- All SQL queries are parameterized and all request bodies are validated.

## Testing

```bash
npm test
```

The integration tests start a real server and connect real WebSocket clients. They cover authentication, access control, sharing, live sync, read-only enforcement, versioning, link revocation and persistence.

## Production

```bash
npm run build
NODE_ENV=production JWT_SECRET=<secret> npm start
```

The backend serves the built frontend, so the app, API and WebSocket share one origin.

With Docker:

```bash
JWT_SECRET=$(openssl rand -hex 48) docker compose up --build
```

The app is then available at http://localhost:4000.
