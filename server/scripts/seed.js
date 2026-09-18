/**
 * Idempotent seeding: creates the bootstrap admin, the taxonomy and the shipped
 * simulations. Re-running it updates seeded rows in place and leaves anything
 * an administrator created untouched.
 */
import { getDb } from '../db.js';
import { config } from '../config.js';
import { hashPassword } from '../auth.js';
import { upsertSimulation } from '../routes/simulations.js';
import { simulationInput } from '../validate.js';
import { seedCategories, seedTags, seedSimulations } from '../seed/index.js';

async function main() {
  const db = getDb();

  // --- bootstrap administrator -------------------------------------------
  const existingAdmin = db.prepare("SELECT id, email FROM users WHERE role = 'admin' LIMIT 1").get();
  if (!existingAdmin) {
    if (config.adminPassword.length < 8) throw new Error('ADMIN_PASSWORD must be at least 8 characters.');
    const hash = await hashPassword(config.adminPassword);
    db.prepare('INSERT INTO users (email, display_name, password_hash, role) VALUES (?, ?, ?, ?)')
      .run(config.adminEmail.toLowerCase(), 'Administrator', hash, 'admin');
    console.log(`Created administrator ${config.adminEmail}`);
  } else {
    console.log(`Administrator already present: ${existingAdmin.email}`);
  }

  // --- categories ---------------------------------------------------------
  const upCat = db.prepare(
    `INSERT INTO categories (slug, name, description, parent_slug, sort_order)
     VALUES (@slug, @name, @description, @parentSlug, @sortOrder)
     ON CONFLICT(slug) DO UPDATE SET
       name = excluded.name, description = excluded.description,
       parent_slug = excluded.parent_slug, sort_order = excluded.sort_order`,
  );
  db.transaction(() => {
    for (const c of seedCategories) {
      upCat.run({ description: '', parentSlug: null, sortOrder: 0, ...c });
    }
  })();

  // --- tags ---------------------------------------------------------------
  const upTag = db.prepare(
    `INSERT INTO tags (slug, name, description) VALUES (@slug, @name, @description)
     ON CONFLICT(slug) DO UPDATE SET name = excluded.name, description = excluded.description`,
  );
  db.transaction(() => { for (const t of seedTags) upTag.run(t); })();

  // --- simulations --------------------------------------------------------
  const author = db.prepare("SELECT id, email FROM users WHERE role = 'admin' ORDER BY id LIMIT 1").get();
  let created = 0;
  let updated = 0;
  for (const raw of seedSimulations) {
    const parsed = simulationInput.parse({ ...raw, slug: raw.slug });
    const existing = db.prepare('SELECT * FROM simulations WHERE slug = ?').get(raw.slug);
    db.transaction(() => upsertSimulation(db, parsed, author, existing || null))();
    existing ? updated++ : created++;
  }

  const counts = db.prepare(
    `SELECT (SELECT COUNT(*) FROM simulations) AS sims,
            (SELECT COUNT(*) FROM simulations WHERE status='published') AS published,
            (SELECT COUNT(*) FROM categories) AS cats,
            (SELECT COUNT(*) FROM tags) AS tags`,
  ).get();
  console.log(`Simulations: ${created} created, ${updated} updated.`);
  console.log(`Catalogue now holds ${counts.sims} simulations (${counts.published} published), ${counts.cats} categories, ${counts.tags} tags.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
