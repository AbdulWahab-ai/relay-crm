import EmbeddedPostgres from 'embedded-postgres';
import { mkdir } from 'node:fs/promises';
await mkdir('work', { recursive: true });
const pg = new EmbeddedPostgres({
  databaseDir: 'work/test-postgres',
  user: 'relay_test',
  password: 'isolated-local-test-only',
  port: 55432,
  persistent: true,
  postgresFlags: ['-h', '127.0.0.1'],
  onLog: () => {},
  onError: () => {},
});
await pg.initialise();
await pg.start();
try {
  await pg.createDatabase('relay_test');
} catch {}
console.log('Isolated test PostgreSQL ready on 127.0.0.1:55432');
process.on('SIGINT', async () => {
  await pg.stop();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await pg.stop();
  process.exit(0);
});
setInterval(() => {}, 60000);
