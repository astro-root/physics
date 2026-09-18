/**
 * Bakes the seeded catalogue into a single JSON bundle that the client ships
 * with. This is what makes the free (static) deployment possible: no database,
 * no server, no cold starts — the catalogue is just data in the bundle.
 *
 *   node scripts/build-content.mjs
 *
 * The same seed modules still feed the optional server mode, so there is only
 * one source of truth for the shipped content.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedCategories, seedTags, seedSimulations } from '../server/seed/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const outFile = path.join(here, '..', 'src', 'content', 'catalogue.json');

const now = new Date().toISOString();
const tagBySlug = new Map(seedTags.map((t, i) => [t.slug, { id: i + 1, ...t }]));

// Any tag referenced by a simulation but missing from the tag list is created
// here, so a typo in a seed file surfaces as a visible tag rather than a crash.
for (const sim of seedSimulations) {
  for (const slug of sim.tags || []) {
    if (!tagBySlug.has(slug)) {
      tagBySlug.set(slug, { id: tagBySlug.size + 1, slug, name: slug, description: '' });
    }
  }
}

const simulations = seedSimulations.map((sim, i) => ({
  ...sim,
  id: i + 1,
  version: 1,
  createdAt: now,
  updatedAt: now,
  sortOrder: sim.sortOrder || (i + 1) * 10,
  tags: (sim.tags || []).map((slug) => {
    const t = tagBySlug.get(slug);
    return { slug: t.slug, name: t.name, description: t.description || '' };
  }),
}));

const counts = new Map();
for (const sim of simulations) {
  for (const t of sim.tags) counts.set(t.slug, (counts.get(t.slug) || 0) + 1);
}

const categories = seedCategories.map((c, i) => ({
  id: i + 1,
  description: '',
  parentSlug: null,
  sortOrder: (i + 1) * 10,
  ...c,
  count: simulations.filter((s) => s.category === c.slug).length,
}));

const tags = [...tagBySlug.values()]
  .map((t) => ({ ...t, count: counts.get(t.slug) || 0 }))
  .sort((a, b) => b.count - a.count || a.slug.localeCompare(b.slug));

const bundle = { generatedAt: now, categories, tags, simulations };

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(bundle));

const kb = (fs.statSync(outFile).size / 1024).toFixed(0);
console.log(`Wrote ${simulations.length} simulations, ${categories.length} categories, ${tags.length} tags -> src/content/catalogue.json (${kb} kB)`);
