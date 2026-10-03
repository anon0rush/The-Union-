import { createServer } from './app.js';
import { config } from './config.js';
import { openDatabase } from './db.js';

const repo = openDatabase(config.dbPath);
const { server, close } = createServer({ repo, config });

server.listen(config.port, () => {
  console.log(`The Union server listening on http://localhost:${config.port}`);
});

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received — saving open documents and shutting down`);
  await close();
  repo.close();
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
