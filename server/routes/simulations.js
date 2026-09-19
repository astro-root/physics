import { Router } from 'express';
import { getDb, reindexSimulation } from '../db.js';
import { requireAdmin } from '../auth.js';
import { asyncRoute, uniqueSlug, json } from '../util.js';
import { serializeSimulation, serializeVersion } from '../serialize.js';
import { simulationInput, lintSimulationCode, lintRendererCode } from '../validate.js';

export const simulationsRouter = Router();

const SORTS = {
  recent: 's.updated_at DESC',
  created: 's.created_at DESC',
  title: 's.title ASC',
  difficulty: 's.difficulty ASC, s.title ASC',
  manual: 's.sort_order ASC, s.title ASC',
};

function ensureTags(db, simulationId, tagSlugs) {
  db.prepare('DELETE FROM simulation_tags WHERE simulation_id = ?').run(simulationId);
  const find = db.prepare('SELECT id FROM tags WHERE slug = ?');
  const create = db.prepare('INSERT INTO tags (slug, name) VALUES (?, ?)');
  const link = db.prepare('INSERT OR IGNORE INTO simulation_tags (simulation_id, tag_id) VALUES (?, ?)');
  for (const raw of tagSlugs) {
    const slug = String(raw).trim().toLowerCase();
    if (!slug) continue;
    let tag = find.get(slug);
    if (!tag) {
      const info = create.run(slug, slug.replace(/-/g, ' '));
      tag = { id: info.lastInsertRowid };
    }
    link.run(simulationId, tag.id);
  }
}

function snapshotOf(db, id) {
  const row = db.prepare('SELECT * FROM simulations WHERE id = ?').get(id);
  return JSON.stringify(serializeSimulation(row, { full: true }));
}

function recordVersion(db, id, version, summary, user) {
  db.prepare(
    `INSERT OR REPLACE INTO simulation_versions
       (simulation_id, version, summary, snapshot, changed_by, changed_by_email)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, version, summary || '', snapshotOf(db, id), user ? user.id : null, user ? user.email : '');
}

// ------------------------------------------------------------------ public list
simulationsRouter.get(
  '/',
  asyncRoute((req, res) => {
    const db = getDb();
    const isAdmin = req.user && req.user.role === 'admin';
    const {
      q = '', category = '', tags = '', tagMode = 'and', type = '', difficulty = '',
      level = '', sort = 'recent', status = '', limit = '200', offset = '0',
    } = req.query;

    const where = [];
    const args = [];

    if (isAdmin && status) { where.push('s.status = ?'); args.push(status); }
    else if (!isAdmin) where.push("s.status = 'published'");
    else if (!status) where.push("s.status IN ('published','draft')");

    if (category) { where.push('s.category_slug = ?'); args.push(category); }
    if (type) { where.push('s.type = ?'); args.push(type); }
    if (level) { where.push('s.target_level = ?'); args.push(level); }
    if (difficulty) { where.push('s.difficulty <= ?'); args.push(Number(difficulty)); }

    if (q.trim()) {
      // FTS first; fall back to LIKE for short or symbol-heavy queries.
      let slugs = [];
      try {
        const match = q.trim().split(/\s+/).map((w) => `${w.replace(/["*]/g, '')}*`).join(' ');
        slugs = db.prepare('SELECT slug FROM simulations_fts WHERE simulations_fts MATCH ?').all(match).map((r) => r.slug);
      } catch { slugs = []; }
      if (slugs.length) {
        where.push(`s.slug IN (${slugs.map(() => '?').join(',')})`);
        args.push(...slugs);
      } else {
        where.push('(s.title LIKE ? OR s.title_en LIKE ? OR s.short_description LIKE ? OR s.physics_topics LIKE ?)');
        const like = `%${q.trim()}%`;
        args.push(like, like, like, like);
      }
    }

    const tagList = String(tags).split(',').map((t) => t.trim()).filter(Boolean);
    if (tagList.length) {
      const placeholders = tagList.map(() => '?').join(',');
      if (tagMode === 'or') {
        where.push(`s.id IN (SELECT st.simulation_id FROM simulation_tags st JOIN tags t ON t.id = st.tag_id WHERE t.slug IN (${placeholders}))`);
        args.push(...tagList);
      } else {
        where.push(
          `s.id IN (SELECT st.simulation_id FROM simulation_tags st JOIN tags t ON t.id = st.tag_id
                    WHERE t.slug IN (${placeholders})
                    GROUP BY st.simulation_id HAVING COUNT(DISTINCT t.slug) = ?)`,
        );
        args.push(...tagList, tagList.length);
      }
    }

    const sql = `SELECT s.* FROM simulations s
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY ${SORTS[sort] || SORTS.recent}
      LIMIT ? OFFSET ?`;
    const rows = db.prepare(sql).all(...args, Math.min(Number(limit) || 200, 500), Number(offset) || 0);
    const total = db
      .prepare(`SELECT COUNT(*) AS n FROM simulations s ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`)
      .get(...args).n;
    res.json({ items: rows.map((r) => serializeSimulation(r)), total });
  }),
);

// ------------------------------------------------------------------ public read
simulationsRouter.get(
  '/:slug',
  asyncRoute((req, res) => {
    const db = getDb();
    const row = db.prepare('SELECT * FROM simulations WHERE slug = ?').get(req.params.slug);
    if (!row) return res.status(404).json({ error: 'No simulation with that address.' });
    const isAdmin = req.user && req.user.role === 'admin';
    if (row.status !== 'published' && !isAdmin) {
      return res.status(404).json({ error: 'No simulation with that address.' });
    }
    res.json(serializeSimulation(row, { full: true }));
  }),
);

// ------------------------------------------------------------------ validation
simulationsRouter.post(
  '/validate',
  requireAdmin,
  asyncRoute((req, res) => {
    const problems = [
      ...lintSimulationCode(req.body.simulationCode).map((p) => ({ ...p, where: 'simulation' })),
      ...lintRendererCode(req.body.rendererCode).map((p) => ({ ...p, where: 'renderer' })),
    ];
    const parsed = simulationInput.safeParse({ ...req.body, title: req.body.title || 'untitled', category: req.body.category || 'mechanics' });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        problems.push({ level: 'error', where: 'metadata', message: `${issue.path.join('.')}: ${issue.message}` });
      }
    }
    res.json({ ok: !problems.some((p) => p.level === 'error'), problems });
  }),
);

// ------------------------------------------------------------------ admin write
function writeRow(db, data, user, existing) {
  const slug = data.slug ? uniqueSlug(db, 'simulations', data.slug, existing?.id) : uniqueSlug(db, 'simulations', data.titleEn || data.title, existing?.id);
  const values = {
    slug,
    title: data.title,
    title_en: data.titleEn,
    short_description: data.shortDescription,
    description: data.description,
    category_slug: data.category,
    type: data.type,
    difficulty: data.difficulty,
    target_level: data.targetLevel,
    physics_topics: JSON.stringify(data.physicsTopics),
    formulas: JSON.stringify(data.formulas),
    simulation_code: data.simulationCode,
    renderer_code: data.rendererCode,
    parameter_definitions: JSON.stringify(data.parameterDefinitions),
    graph_definitions: JSON.stringify(data.graphDefinitions),
    display_definitions: JSON.stringify(data.displayDefinitions),
    runtime_options: JSON.stringify(data.runtimeOptions),
    experiment: data.experiment ? JSON.stringify(data.experiment) : null,
    thumbnail: data.thumbnail,
    status: data.status,
    sort_order: data.sortOrder,
    author: data.author,
  };

  if (existing) {
    const version = existing.version + 1;
    db.prepare(
      `UPDATE simulations SET
        slug=@slug, title=@title, title_en=@title_en, short_description=@short_description,
        description=@description, category_slug=@category_slug, type=@type, difficulty=@difficulty,
        target_level=@target_level, physics_topics=@physics_topics, formulas=@formulas,
        simulation_code=@simulation_code, renderer_code=@renderer_code,
        parameter_definitions=@parameter_definitions, graph_definitions=@graph_definitions,
        display_definitions=@display_definitions, runtime_options=@runtime_options,
        experiment=@experiment, thumbnail=@thumbnail, status=@status, sort_order=@sort_order,
        author=@author, version=@version, updated_at=datetime('now'), updated_by=@updated_by
       WHERE id=@id`,
    ).run({ ...values, version, updated_by: user ? user.id : null, id: existing.id });
    ensureTags(db, existing.id, data.tags);
    reindexSimulation(existing.id);
    recordVersion(db, existing.id, version, data.versionSummary, user);
    return existing.id;
  }

  const info = db.prepare(
    `INSERT INTO simulations
      (slug, title, title_en, short_description, description, category_slug, type, difficulty,
       target_level, physics_topics, formulas, simulation_code, renderer_code, parameter_definitions,
       graph_definitions, display_definitions, runtime_options, experiment, thumbnail, status,
       sort_order, author, version, created_by, updated_by)
     VALUES (@slug,@title,@title_en,@short_description,@description,@category_slug,@type,@difficulty,
       @target_level,@physics_topics,@formulas,@simulation_code,@renderer_code,@parameter_definitions,
       @graph_definitions,@display_definitions,@runtime_options,@experiment,@thumbnail,@status,
       @sort_order,@author,1,@created_by,@created_by)`,
  ).run({ ...values, created_by: user ? user.id : null });
  const id = Number(info.lastInsertRowid);
  ensureTags(db, id, data.tags);
  reindexSimulation(id);
  recordVersion(db, id, 1, data.versionSummary || 'Created', user);
  return id;
}

export { writeRow as upsertSimulation };

simulationsRouter.post(
  '/',
  requireAdmin,
  asyncRoute((req, res) => {
    const parsed = simulationInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Check the highlighted fields.', issues: parsed.error.issues });
    const db = getDb();
    const id = db.transaction(() => writeRow(db, parsed.data, req.user, null))();
    res.status(201).json(serializeSimulation(db.prepare('SELECT * FROM simulations WHERE id = ?').get(id), { full: true }));
  }),
);

simulationsRouter.put(
  '/:id',
  requireAdmin,
  asyncRoute((req, res) => {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM simulations WHERE id = ?').get(Number(req.params.id));
    if (!existing) return res.status(404).json({ error: 'That simulation no longer exists.' });
    const parsed = simulationInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Check the highlighted fields.', issues: parsed.error.issues });
    db.transaction(() => writeRow(db, parsed.data, req.user, existing))();
    res.json(serializeSimulation(db.prepare('SELECT * FROM simulations WHERE id = ?').get(existing.id), { full: true }));
  }),
);

simulationsRouter.delete(
  '/:id',
  requireAdmin,
  asyncRoute((req, res) => {
    const db = getDb();
    const row = db.prepare('SELECT * FROM simulations WHERE id = ?').get(Number(req.params.id));
    if (!row) return res.status(404).json({ error: 'That simulation no longer exists.' });
    db.prepare('DELETE FROM simulations WHERE id = ?').run(row.id);
    db.prepare('DELETE FROM simulations_fts WHERE slug = ?').run(row.slug);
    res.json({ deleted: row.slug });
  }),
);

simulationsRouter.post(
  '/:id/duplicate',
  requireAdmin,
  asyncRoute((req, res) => {
    const db = getDb();
    const row = db.prepare('SELECT * FROM simulations WHERE id = ?').get(Number(req.params.id));
    if (!row) return res.status(404).json({ error: 'That simulation no longer exists.' });
    const source = serializeSimulation(row, { full: true });
    const copy = {
      ...source,
      title: `${source.title} (copy)`,
      slug: `${source.slug}-copy`,
      status: 'draft',
      tags: source.tags.map((t) => t.slug),
      versionSummary: `Duplicated from ${source.slug}`,
    };
    const parsed = simulationInput.parse(copy);
    const id = db.transaction(() => writeRow(db, parsed, req.user, null))();
    res.status(201).json(serializeSimulation(db.prepare('SELECT * FROM simulations WHERE id = ?').get(id), { full: true }));
  }),
);

for (const [path, status] of [['publish', 'published'], ['unpublish', 'draft'], ['archive', 'archived']]) {
  simulationsRouter.post(
    `/:id/${path}`,
    requireAdmin,
    asyncRoute((req, res) => {
      const db = getDb();
      const row = db.prepare('SELECT * FROM simulations WHERE id = ?').get(Number(req.params.id));
      if (!row) return res.status(404).json({ error: 'That simulation no longer exists.' });
      if (status === 'published') {
        const problems = lintSimulationCode(row.simulation_code).filter((p) => p.level === 'error');
        if (problems.length) return res.status(400).json({ error: 'Fix the code errors before publishing.', problems });
      }
      db.prepare("UPDATE simulations SET status = ?, updated_at = datetime('now'), updated_by = ? WHERE id = ?")
        .run(status, req.user.id, row.id);
      res.json(serializeSimulation(db.prepare('SELECT * FROM simulations WHERE id = ?').get(row.id)));
    }),
  );
}

simulationsRouter.post(
  '/reorder',
  requireAdmin,
  asyncRoute((req, res) => {
    const db = getDb();
    const order = Array.isArray(req.body.order) ? req.body.order : [];
    const stmt = db.prepare('UPDATE simulations SET sort_order = ? WHERE id = ?');
    db.transaction(() => order.forEach((id, i) => stmt.run(i, Number(id))))();
    res.json({ ok: true });
  }),
);

// ------------------------------------------------------------------- versions
simulationsRouter.get(
  '/:id/versions',
  requireAdmin,
  asyncRoute((req, res) => {
    const rows = getDb()
      .prepare('SELECT * FROM simulation_versions WHERE simulation_id = ? ORDER BY version DESC')
      .all(Number(req.params.id));
    res.json({ items: rows.map(serializeVersion) });
  }),
);

simulationsRouter.get(
  '/:id/versions/:version',
  requireAdmin,
  asyncRoute((req, res) => {
    const row = getDb()
      .prepare('SELECT * FROM simulation_versions WHERE simulation_id = ? AND version = ?')
      .get(Number(req.params.id), Number(req.params.version));
    if (!row) return res.status(404).json({ error: 'No such version.' });
    res.json({ ...serializeVersion(row), snapshot: json(row.snapshot, null) });
  }),
);

simulationsRouter.post(
  '/:id/versions/:version/restore',
  requireAdmin,
  asyncRoute((req, res) => {
    const db = getDb();
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM simulations WHERE id = ?').get(id);
    const row = db.prepare('SELECT * FROM simulation_versions WHERE simulation_id = ? AND version = ?')
      .get(id, Number(req.params.version));
    if (!existing || !row) return res.status(404).json({ error: 'No such version.' });
    const snapshot = json(row.snapshot, null);
    // Restoring brings back an old version's *content* only. It must not also
    // revert the simulation's current publish state (e.g. restoring the first,
    // pre-publish draft version of an already-published simulation should not
    // silently unpublish it), so `status` intentionally comes from the current
    // row, not from the historical snapshot.
    const data = simulationInput.parse({
      ...snapshot,
      status: existing.status,
      tags: (snapshot.tags || []).map((t) => (typeof t === 'string' ? t : t.slug)),
      slug: existing.slug,
      versionSummary: `Restored version ${row.version}`,
    });
    db.transaction(() => writeRow(db, data, req.user, existing))();
    res.json(serializeSimulation(db.prepare('SELECT * FROM simulations WHERE id = ?').get(id), { full: true }));
  }),
);
