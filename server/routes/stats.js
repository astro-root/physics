import { Router } from 'express';
import { getDb } from '../db.js';
import { requireAdmin } from '../auth.js';
import { asyncRoute } from '../util.js';
import { serializeSimulation } from '../serialize.js';

export const statsRouter = Router();

statsRouter.get(
  '/dashboard',
  requireAdmin,
  asyncRoute((req, res) => {
    const db = getDb();
    const count = (sql, ...args) => db.prepare(sql).get(...args).n;
    const recent = (order) =>
      db.prepare(`SELECT * FROM simulations ORDER BY ${order} DESC LIMIT 8`).all().map((r) => serializeSimulation(r));
    res.json({
      simulations: count('SELECT COUNT(*) AS n FROM simulations'),
      published: count("SELECT COUNT(*) AS n FROM simulations WHERE status = 'published'"),
      drafts: count("SELECT COUNT(*) AS n FROM simulations WHERE status = 'draft'"),
      archived: count("SELECT COUNT(*) AS n FROM simulations WHERE status = 'archived'"),
      experiments: count("SELECT COUNT(*) AS n FROM simulations WHERE type = 'experiment'"),
      categories: count('SELECT COUNT(*) AS n FROM categories'),
      tags: count('SELECT COUNT(*) AS n FROM tags'),
      users: count('SELECT COUNT(*) AS n FROM users'),
      versions: count('SELECT COUNT(*) AS n FROM simulation_versions'),
      byCategory: db.prepare(
        `SELECT c.name, c.slug, COUNT(s.id) AS n FROM categories c
         LEFT JOIN simulations s ON s.category_slug = c.slug
         GROUP BY c.slug ORDER BY n DESC`,
      ).all(),
      byType: db.prepare('SELECT type, COUNT(*) AS n FROM simulations GROUP BY type ORDER BY n DESC').all(),
      recentlyUpdated: recent('updated_at'),
      recentlyCreated: recent('created_at'),
    });
  }),
);
