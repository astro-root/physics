import { json } from './util.js';
import { getDb } from './db.js';

export function tagsFor(simulationId) {
  return getDb()
    .prepare(
      `SELECT t.slug, t.name FROM tags t
       JOIN simulation_tags st ON st.tag_id = t.id
       WHERE st.simulation_id = ? ORDER BY t.name`,
    )
    .all(simulationId);
}

/** Row → public API object. `full` includes executable code and definitions. */
export function serializeSimulation(row, { full = false } = {}) {
  if (!row) return null;
  const base = {
    id: row.id,
    slug: row.slug,
    title: row.title,
    titleEn: row.title_en,
    shortDescription: row.short_description,
    category: row.category_slug,
    type: row.type,
    difficulty: row.difficulty,
    targetLevel: row.target_level,
    physicsTopics: json(row.physics_topics, []),
    tags: tagsFor(row.id),
    thumbnail: row.thumbnail,
    status: row.status,
    version: row.version,
    author: row.author,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (!full) return base;
  return {
    ...base,
    description: row.description,
    formulas: json(row.formulas, []),
    simulationCode: row.simulation_code,
    rendererCode: row.renderer_code,
    parameterDefinitions: json(row.parameter_definitions, []),
    graphDefinitions: json(row.graph_definitions, []),
    displayDefinitions: json(row.display_definitions, []),
    runtimeOptions: json(row.runtime_options, {}),
    experiment: json(row.experiment, null),
    sortOrder: row.sort_order,
  };
}

export function serializeVersion(row) {
  return {
    id: row.id,
    version: row.version,
    summary: row.summary,
    changedAt: row.changed_at,
    changedBy: row.changed_by_email || 'unknown',
  };
}
