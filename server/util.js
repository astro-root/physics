export const json = (value, fallback) => {
  if (value === null || value === undefined || value === '') return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
};

export const slugify = (input) =>
  String(input)
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9\u3040-\u30ff\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'item';

export function uniqueSlug(db, table, base, excludeId) {
  let slug = slugify(base);
  let n = 1;
  const stmt = db.prepare(`SELECT id FROM ${table} WHERE slug = ?`);
  for (;;) {
    const row = stmt.get(slug);
    if (!row || (excludeId && row.id === excludeId)) return slug;
    n += 1;
    slug = `${slugify(base)}-${n}`;
  }
}

/** Wraps an async route so rejected promises become 500s instead of hangs. */
export const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
