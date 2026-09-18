import { getDb } from '../db.js';
import { config } from '../config.js';

getDb();
console.log(`Database ready at ${config.databaseFile}`);
