/** Deletes the database file and rebuilds it from scratch, then seeds. */
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';

for (const suffix of ['', '-wal', '-shm']) {
  const file = config.databaseFile + suffix;
  if (fs.existsSync(file)) { fs.unlinkSync(file); console.log(`Removed ${file}`); }
}
const here = path.dirname(fileURLToPath(import.meta.url));
const result = spawnSync(process.execPath, [path.join(here, 'seed.js')], { stdio: 'inherit' });
process.exit(result.status ?? 0);
