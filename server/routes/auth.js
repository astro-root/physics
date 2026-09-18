import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getDb } from '../db.js';
import {
  hashPassword, verifyPassword, issueToken, setSessionCookie, clearSessionCookie, requireAuth, requireAdmin,
} from '../auth.js';
import { asyncRoute } from '../util.js';
import { credentials } from '../validate.js';

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Wait ten minutes and try again.' },
});

const publicUser = (u) => ({ id: u.id, email: u.email, displayName: u.display_name, role: u.role });

authRouter.post(
  '/register',
  loginLimiter,
  asyncRoute(async (req, res) => {
    const parsed = credentials.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const db = getDb();
    const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(parsed.data.email.toLowerCase());
    if (exists) return res.status(409).json({ error: 'That email already has an account.' });
    const hash = await hashPassword(parsed.data.password);
    // Role is fixed server-side. A `role` field in the request body is ignored.
    const info = db.prepare('INSERT INTO users (email, display_name, password_hash, role) VALUES (?, ?, ?, ?)')
      .run(parsed.data.email.toLowerCase(), parsed.data.displayName || '', hash, 'user');
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(info.lastInsertRowid));
    setSessionCookie(res, issueToken(user));
    res.status(201).json({ user: publicUser(user) });
  }),
);

authRouter.post(
  '/login',
  loginLimiter,
  asyncRoute(async (req, res) => {
    const parsed = credentials.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(parsed.data.email.toLowerCase());
    const ok = user && (await verifyPassword(parsed.data.password, user.password_hash));
    if (!ok) return res.status(401).json({ error: 'That email and password do not match.' });
    db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(user.id);
    setSessionCookie(res, issueToken(user));
    res.json({ user: publicUser(user) });
  }),
);

authRouter.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

authRouter.get('/me', (req, res) => {
  res.json({ user: req.user ? { id: req.user.id, email: req.user.email, displayName: req.user.display_name, role: req.user.role } : null });
});

authRouter.get(
  '/users',
  requireAdmin,
  asyncRoute((req, res) => {
    const rows = getDb().prepare('SELECT id, email, display_name, role, created_at, last_login_at FROM users ORDER BY created_at').all();
    res.json({ items: rows.map(publicUser) });
  }),
);

authRouter.put(
  '/users/:id/role',
  requireAdmin,
  asyncRoute((req, res) => {
    const role = req.body.role;
    if (!['user', 'admin'].includes(role)) return res.status(400).json({ error: 'Role must be user or admin.' });
    const db = getDb();
    const target = Number(req.params.id);
    if (target === req.user.id && role !== 'admin') {
      return res.status(400).json({ error: 'You cannot remove your own administrator access.' });
    }
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, target);
    res.json({ ok: true });
  }),
);

authRouter.post(
  '/password',
  requireAuth,
  asyncRoute(async (req, res) => {
    const { current, next } = req.body;
    if (!next || String(next).length < 8) return res.status(400).json({ error: 'Passwords must be at least 8 characters.' });
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!(await verifyPassword(String(current || ''), user.password_hash))) {
      return res.status(401).json({ error: 'Your current password is not correct.' });
    }
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await hashPassword(String(next)), user.id);
    res.json({ ok: true });
  }),
);
