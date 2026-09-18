import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { getDb } from './db.js';

const TOKEN_TTL = '7d';
export const COOKIE_NAME = 'pl_session';

export const hashPassword = (plain) => bcrypt.hash(plain, 10);
export const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash);

export function issueToken(user) {
  // The token carries only the subject. Role and status are always re-read from
  // the database on every request, so a stolen or stale token can never confer
  // privileges the user no longer has.
  return jwt.sign({ sub: String(user.id) }, config.jwtSecret, { expiresIn: TOKEN_TTL });
}

export function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    maxAge: 7 * 24 * 3600 * 1000,
    path: '/',
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

function readToken(req) {
  const header = req.get('authorization');
  if (header && header.startsWith('Bearer ')) return header.slice(7);
  return req.cookies ? req.cookies[COOKIE_NAME] : null;
}

/** Populates req.user (or leaves it null). Never throws on a bad token. */
export function attachUser(req, _res, next) {
  req.user = null;
  const token = readToken(req);
  if (!token) return next();
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = getDb()
      .prepare('SELECT id, email, display_name, role FROM users WHERE id = ?')
      .get(Number(payload.sub));
    if (user) req.user = user;
  } catch {
    /* expired or forged token → treated as guest */
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Sign in to continue.' });
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Sign in to continue.' });
  // Re-read the role straight from the database at the moment of use.
  const fresh = getDb().prepare('SELECT role FROM users WHERE id = ?').get(req.user.id);
  if (!fresh || fresh.role !== 'admin') {
    return res.status(403).json({ error: 'This action requires an administrator account.' });
  }
  next();
}
