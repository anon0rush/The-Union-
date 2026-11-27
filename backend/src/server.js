import { createServer } from './app.js';
import { config } from './config/env.js';
import { openDatabase } from './db/index.js';
import { FRAGMENT } from './realtime/collabServer.js';
import { backfillSummaries } from './realtime/documentText.js';

const repo = openDatabase(config.dbPath);
const backfilled = backfillSummaries(repo, FRAGMENT);
if (backfilled) console.log(`Added previews for ${backfilled} existing documents`);
const { server, close } = createServer({ repo, config });

server.listen(config.port, () => {
  console.log(`Server listening on http://localhost:${config.port}`);
});

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, saving open documents and shutting down`);
  await close();
  repo.close();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
