import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApp } from './app.ts';
import { openSqliteStore } from './sqliteStore.ts';

const here = dirname(fileURLToPath(import.meta.url));
const dbFile = process.env.JIRAN_DB ?? resolve(here, '../data/jiran.sqlite');
mkdirSync(dirname(dbFile), { recursive: true });

const secret = process.env.JIRAN_SECRET ?? 'dev-only-secret-change-me';
if (!process.env.JIRAN_SECRET) console.warn('JIRAN_SECRET is not set, using a development secret');

const { app } = buildApp({
  store: openSqliteStore(dbFile),
  secret,
  webDist: resolve(here, '../../web/dist'),
  logger: true,
});

const port = Number(process.env.PORT ?? 8787);
app.listen({ port, host: '0.0.0.0' }).then(() => {
  console.log(`JIRAN API on http://localhost:${port}/api/health (database: ${dbFile})`);
});
