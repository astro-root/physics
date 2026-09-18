import { Router } from 'express';
import { getDb } from '../db.js';
import { requireAdmin } from '../auth.js';
import { asyncRoute, uniqueSlug } from '../util.js';
import { tagInput, categoryInput } from '../validate.js';

export const taxonomyRouter = Router();

// --------------------------------------------------------------- categories
taxonomyRouter.get(
  '/categories',
  asyncRoute((req, res) => {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM categories ORDER BY sort_order, name').all();
    const counts = db.prepare(
      `SELECT category_slug AS slug, COUNT(*) AS n FROM simulations
       WHERE status = 'published' GROUP BY category_slug`,
    ).all();
    const map = Object.fromEntries(counts.map((c) => [c.slug, c.n]));
    res.json({
      items: rows.map((r) => ({
        id: r.id, slug: r.slug, name: r.name, description: r.description,
        parentSlug: r.parent_slug, sortOrder: r.sort_order, count: map[r.slug] || 0,
      })),
    });
  }),
);

taxonomyRouter.post(
  '/categories',
  requireAdmin,
  asyncRoute((req, res) => {
    const parsed = categoryInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Check the highlighted fields.', issues: parsed.error.issues });
    const db = getDb();
    const slug = uniqueSlug(db, 'categories', parsed.data.slug || parsed.data.name);
    const info = db.prepare(
      'INSERT INTO categories (slug, name, description, parent_slug, sort_order) VALUES (?, ?, ?, ?, ?)',
    ).run(slug, parsed.data.name, parsed.data.description, parsed.data.parentSlug, parsed.data.sortOrder);
    res.status(201).json({ id: Number(info.lastInsertRowid), slug });
  }),
);

taxonomyRouter.put(
  '/categories/:id',
  requireAdmin,
  asyncRoute((req, res) => {
    const parsed = categoryInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Check the highlighted fields.', issues: parsed.error.issues });
    const db = getDb();
    const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(Number(req.params.id));
    if (!row) return res.status(404).json({ error: 'No such category.' });
    // Renaming the slug cascades to simulations through ON UPDATE CASCADE.
    const slug = parsed.data.slug ? uniqueSlug(db, 'categories', parsed.data.slug, row.id) : row.slug;
    db.prepare('UPDATE categories SET slug=?, name=?, description=?, parent_slug=?, sort_order=? WHERE id=?')
      .run(slug, parsed.data.name, parsed.data.description, parsed.data.parentSlug, parsed.data.sortOrder, row.id);
    res.json({ id: row.id, slug });
  }),
);

taxonomyRouter.delete(
  '/categories/:id',
  requireAdmin,
  asyncRoute((req, res) => {
    const db = getDb();
    const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(Number(req.params.id));
    if (!row) return res.status(404).json({ error: 'No such category.' });
    const used = db.prepare('SELECT COUNT(*) AS n FROM simulations WHERE category_slug = ?').get(row.slug).n;
    if (used > 0) {
      return res.status(409).json({ error: `${used} simulation(s) still use this category. Move them first.` });
    }
    db.prepare('DELETE FROM categories WHERE id = ?').run(row.id);
    res.json({ deleted: row.slug });
  }),
);

// --------------------------------------------------------------------- tags
taxonomyRouter.get(
  '/tags',
  asyncRoute((req, res) => {
    const db = getDb();
    const isAdmin = req.user && req.user.role === 'admin' ? 1 : 0;
    const tags = db.prepare(
      `SELECT t.id, t.slug, t.name, t.description,
              (SELECT COUNT(*) FROM simulation_tags st JOIN simulations s ON s.id = st.simulation_id
               WHERE st.tag_id = t.id AND (s.status = 'published' OR ? = 1)) AS count
       FROM tags t ORDER BY count DESC, t.name`,
    ).all(isAdmin);
    res.json({ items: tags });
  }),
);

taxonomyRouter.post(
  '/tags',
  requireAdmin,
  asyncRoute((req, res) => {
    const parsed = tagInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Check the highlighted fields.', issues: parsed.error.issues });
    const db = getDb();
    const slug = uniqueSlug(db, 'tags', parsed.data.slug || parsed.data.name);
    const info = db.prepare('INSERT INTO tags (slug, name, description) VALUES (?, ?, ?)')
      .run(slug, parsed.data.name, parsed.data.description);
    res.status(201).json({ id: Number(info.lastInsertRowid), slug, name: parsed.data.name });
  }),
);

taxonomyRouter.put(
  '/tags/:id',
  requireAdmin,
  asyncRoute((req, res) => {
    const parsed = tagInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Check the highlighted fields.', issues: parsed.error.issues });
    const db = getDb();
    const row = db.prepare('SELECT * FROM tags WHERE id = ?').get(Number(req.params.id));
    if (!row) return res.status(404).json({ error: 'No such tag.' });
    const slug = parsed.data.slug ? uniqueSlug(db, 'tags', parsed.data.slug, row.id) : row.slug;
    db.prepare('UPDATE tags SET slug = ?, name = ?, description = ? WHERE id = ?')
      .run(slug, parsed.data.name, parsed.data.description, row.id);
    res.json({ id: row.id, slug, name: parsed.data.name });
  }),
);

taxonomyRouter.delete(
  '/tags/:id',
  requireAdmin,
  asyncRoute((req, res) => {
    const db = getDb();
    const row = db.prepare('SELECT * FROM tags WHERE id = ?').get(Number(req.params.id));
    if (!row) return res.status(404).json({ error: 'No such tag.' });
    db.prepare('DELETE FROM tags WHERE id = ?').run(row.id); // links cascade
    res.json({ deleted: row.slug });
  }),
);
