// Isolated local development only. Persistent database and captured emails are gitignored.
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
const dbPath = path.resolve('.local', 'mongo');
await mkdir(dbPath, { recursive: true });
const repl = await MongoMemoryReplSet.create({ instanceOpts: [{ dbPath, port: 27028 }], replSet: { count: 1, storageEngine: 'wiredTiger' } });
process.env.MONGODB_URI = repl.getUri();
process.env.MONGODB_DB = 'dwights_gutters_local';
process.env.EMAIL_TRANSPORT = 'file';
process.env.APP_URL = 'http://127.0.0.1:3000';
await writeFile(path.resolve('.local', 'runtime.json'), JSON.stringify({ uri: process.env.MONGODB_URI, database: process.env.MONGODB_DB }));
const { seed, database } = await import('../lib/db.mjs');
await seed();
await (await database()).client.close();
console.log('Local MongoDB ready. Admin: dwight@dwightsgutters.com. Emails are captured in .local/mail (never sent).');
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '3000'], { stdio: 'inherit', env: process.env });
let stopping = false;
async function stop() { if (stopping) return; stopping = true; child.kill(); await repl.stop(); process.exit(); }
process.on('SIGINT', stop); process.on('SIGTERM', stop); child.on('exit', stop);
