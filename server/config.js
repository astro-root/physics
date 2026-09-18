import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '..');

const required = (name, fallback) => {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing required environment variable ${name}`);
  return v;
};

export const config = {
  port: Number(process.env.PORT || 8787),
  jwtSecret: required('JWT_SECRET', process.env.NODE_ENV === 'production' ? undefined : 'dev-only-insecure-secret'),
  databaseFile: path.resolve(ROOT, process.env.DATABASE_FILE || './data/dynamis.db'),
  adminEmail: process.env.ADMIN_EMAIL || 'admin@physics.lab',
  adminPassword: process.env.ADMIN_PASSWORD || 'change-this-password',
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim()),
  serveClient: process.env.SERVE_CLIENT === 'true',
  isProd: process.env.NODE_ENV === 'production',
};

if (config.isProd && config.jwtSecret === 'dev-only-insecure-secret') {
  throw new Error('Refusing to start in production with the development JWT secret.');
}
