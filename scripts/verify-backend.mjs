import EmbeddedPostgres from 'embedded-postgres';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';

await mkdir('work', { recursive: true });
const directory = await mkdtemp(resolve('work/backend-check-'));
const password = randomBytes(24).toString('hex');
const databaseUrl = `postgresql://relay_test:${password}@127.0.0.1:55433/relay_test`;
const env = { ...process.env, DATABASE_URL: databaseUrl, DIRECT_URL: databaseUrl,
  TEST_DATABASE_URL: databaseUrl, NEXTAUTH_URL: 'http://127.0.0.1:3001',
  NEXTAUTH_SECRET: randomBytes(32).toString('hex'), NEXT_PUBLIC_DEMO_MODE: 'false',
  HTTP_TEST_PASSWORD: password, SEED_PASSWORD: password, ALLOW_DEMO_SEED: 'true',
  ANTHROPIC_API_KEY: '', STRIPE_SECRET_KEY: '', CRON_SECRET: randomBytes(32).toString('hex') };
const pg = new EmbeddedPostgres({ databaseDir: directory, user: 'relay_test', password,
  port: 55433, persistent: false, postgresFlags: ['-h', '127.0.0.1'], onLog: () => {}, onError: () => {} });
const run = (file, args) => new Promise((resolve, reject) => {
  const child = spawn(file, args, { env, stdio: 'inherit' });
  child.on('error', reject);
  child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${file} failed (${code})`)));
});
let server;
try {
  await pg.initialise(); await pg.start(); await pg.createDatabase('relay_test');
  await run(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy']);
  await run(process.execPath, ['node_modules/vitest/vitest.mjs', 'run']);
  await run(process.execPath, ['--import', 'tsx', 'prisma/seed.ts']);
  await run(process.execPath, ['node_modules/next/dist/bin/next', 'build']);
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3001'], { env, stdio: 'inherit' });
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) throw new Error('Application exited before readiness');
    try { const r = await fetch(env.NEXTAUTH_URL + '/api/auth/csrf'); if (r.ok) { ready = true; break; } } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  if (!ready) throw new Error('Application did not become ready');
  await run(process.execPath, ['scripts/http-smoke.mjs']);
  console.log('Backend verification passed: isolated PostgreSQL, production build, and authenticated HTTP workflows.');
} finally {
  if (server && server.exitCode === null) { server.kill('SIGTERM'); await new Promise(r => server.once('exit', r)); }
  await pg.stop();
}
