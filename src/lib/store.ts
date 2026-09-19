import type {
  Category, Problem, Simulation, SimulationSummary, Tag, VersionSummary,
} from './types';

/**
 * The static (free) data layer.
 *
 * The published catalogue is a JSON bundle baked at build time, so the site is
 * a pile of static files and costs nothing to host. Anything an administrator
 * creates in the browser lives in an overlay in localStorage and can be
 * exported as JSON to commit back into the repository.
 */

interface Bundle {
  generatedAt: string;
  categories: Category[];
  tags: Tag[];
  simulations: Simulation[];
}

interface Overlay {
  simulations: Record<string, Simulation>;   // by id
  deleted: number[];
  categories: Category[];
  tags: Tag[];
  versions: Record<string, (VersionSummary & { snapshot: Simulation })[]>;
  nextId: number;
  admin: boolean;
}

const OVERLAY_KEY = 'dynamis:overlay:v1';

const emptyOverlay = (): Overlay => ({
  simulations: {}, deleted: [], categories: [], tags: [], versions: {}, nextId: 10001, admin: false,
});

let bundlePromise: Promise<Bundle> | null = null;

/** Loaded on demand so the landing page does not pay for the catalogue. */
function loadBundle(): Promise<Bundle> {
  if (!bundlePromise) {
    bundlePromise = import('../content/catalogue.json').then((m) => (m.default ?? m) as unknown as Bundle);
  }
  return bundlePromise;
}

function readOverlay(): Overlay {
  try {
    const raw = localStorage.getItem(OVERLAY_KEY);
    if (!raw) return emptyOverlay();
    return { ...emptyOverlay(), ...JSON.parse(raw) };
  } catch {
    return emptyOverlay();
  }
}

function writeOverlay(next: Overlay) {
  try {
    localStorage.setItem(OVERLAY_KEY, JSON.stringify(next));
  } catch {
    throw new Error('ブラウザの保存領域に書き込めませんでした。容量が上限に達している可能性があります。');
  }
}

function mutate(fn: (o: Overlay) => void) {
  const o = readOverlay();
  fn(o);
  writeOverlay(o);
  return o;
}

function slugify(input: string): string {
  const ascii = input
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return ascii || `item-${Date.now().toString(36)}`;
}

/** Bundle merged with the local overlay: what the UI actually sees. */
async function allSimulations(): Promise<Simulation[]> {
  const bundle = await loadBundle();
  const o = readOverlay();
  const byId = new Map<number, Simulation>();
  for (const s of bundle.simulations) byId.set(s.id, s);
  for (const s of Object.values(o.simulations)) byId.set(s.id, s);
  for (const id of o.deleted) byId.delete(id);
  return [...byId.values()];
}

async function allCategories(): Promise<Category[]> {
  const bundle = await loadBundle();
  const o = readOverlay();
  const bySlug = new Map<string, Category>();
  for (const c of [...bundle.categories, ...o.categories]) bySlug.set(c.slug, c);
  const sims = await allSimulations();
  return [...bySlug.values()]
    .map((c) => ({ ...c, count: sims.filter((s) => s.category === c.slug && s.status === 'published').length }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

async function allTags(): Promise<Tag[]> {
  const bundle = await loadBundle();
  const o = readOverlay();
  const bySlug = new Map<string, Tag>();
  for (const t of [...bundle.tags, ...o.tags]) bySlug.set(t.slug, t);
  const sims = await allSimulations();
  for (const s of sims) {
    for (const t of s.tags) if (!bySlug.has(t.slug)) bySlug.set(t.slug, { slug: t.slug, name: t.name });
  }
  return [...bySlug.values()]
    .map((t) => ({
      ...t,
      count: sims.filter((s) => s.status === 'published' && s.tags.some((x) => x.slug === t.slug)).length,
    }))
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0) || a.slug.localeCompare(b.slug));
}

function summarize(s: Simulation): SimulationSummary {
  const { id, slug, title, titleEn, shortDescription, category, type, difficulty, targetLevel,
    physicsTopics, tags, thumbnail, status, version, author, createdAt, updatedAt } = s;
  return {
    id, slug, title, titleEn, shortDescription, category, type, difficulty, targetLevel,
    physicsTopics, tags, thumbnail, status, version, author, createdAt, updatedAt,
  };
}

export interface Query {
  q?: string; category?: string; tags?: string[]; tagMode?: 'and' | 'or';
  type?: string; difficulty?: number; level?: string; sort?: string; status?: string;
}

/** Client-side search. With a catalogue this size, scanning is instant. */
export async function querySimulations(query: Query = {}) {
  const sims = await allSimulations();
  const categories = await allCategories();
  const isAdmin = readOverlay().admin;

  const childrenOf = (slug: string) =>
    [slug, ...categories.filter((c) => c.parentSlug === slug).map((c) => c.slug)];

  let items = sims.filter((s) => {
    if (query.status) { if (s.status !== query.status) return false; }
    else if (isAdmin) { if (s.status === 'archived') return false; }
    else if (s.status !== 'published') return false;

    if (query.category && !childrenOf(query.category).includes(s.category)) return false;
    if (query.type && s.type !== query.type) return false;
    if (query.level && s.targetLevel !== query.level) return false;
    if (query.difficulty && s.difficulty > query.difficulty) return false;

    const wanted = query.tags?.filter(Boolean) ?? [];
    if (wanted.length) {
      const have = new Set(s.tags.map((t) => t.slug));
      const ok = query.tagMode === 'or' ? wanted.some((t) => have.has(t)) : wanted.every((t) => have.has(t));
      if (!ok) return false;
    }

    if (query.q) {
      const needle = query.q.trim().toLowerCase();
      const hay = [
        s.title, s.titleEn, s.shortDescription, s.description, s.category,
        ...s.physicsTopics, ...s.tags.map((t) => t.name), ...s.tags.map((t) => t.slug),
      ].join(' ').toLowerCase();
      if (!needle.split(/\s+/).every((word) => hay.includes(word))) return false;
    }
    return true;
  });

  const sort = query.sort || 'recent';
  items = items.sort((a, b) => {
    if (sort === 'title') return a.title.localeCompare(b.title, 'ja');
    if (sort === 'difficulty') return a.difficulty - b.difficulty || a.sortOrder - b.sortOrder;
    if (sort === 'created') return b.createdAt.localeCompare(a.createdAt) || a.sortOrder - b.sortOrder;
    if (sort === 'recent') return b.updatedAt.localeCompare(a.updatedAt) || a.sortOrder - b.sortOrder;
    return a.sortOrder - b.sortOrder;
  });

  return { items: items.map(summarize), total: items.length };
}

export async function getSimulation(slug: string): Promise<Simulation> {
  const sims = await allSimulations();
  const found = sims.find((s) => s.slug === slug);
  if (!found) throw Object.assign(new Error('見つかりませんでした。'), { status: 404 });
  if (found.status !== 'published' && !readOverlay().admin) {
    throw Object.assign(new Error('見つかりませんでした。'), { status: 404 });
  }
  return found;
}

export async function getCategories() { return { items: await allCategories() }; }
export async function getTags() { return { items: await allTags() }; }

// --------------------------------------------------------------- validation

const BANNED: [RegExp, string][] = [
  [/\bfetch\s*\(/, '通信（fetch）はサンドボックスで禁止されています。'],
  [/XMLHttpRequest/, '通信（XMLHttpRequest）はサンドボックスで禁止されています。'],
  [/\bimportScripts\s*\(/, '外部スクリプトの読み込みはできません。'],
  [/\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b/, '保存領域にはアクセスできません。'],
  [/\bdocument\b|\bwindow\b/, 'DOM にはアクセスできません（描画コードでのみ ctx を使ってください）。'],
];

export function validateDraft(draft: any): { ok: boolean; problems: Problem[] } {
  const problems: Problem[] = [];
  const push = (level: Problem['level'], where: string, message: string) => problems.push({ level, where, message });

  if (!draft.title?.trim()) push('error', 'title', 'タイトルが空です。');
  if (!draft.category) push('error', 'category', 'カテゴリを選んでください。');
  if (!draft.shortDescription?.trim()) push('warning', 'shortDescription', '一行説明があるとカードが読みやすくなります。');

  let model: any = null;
  try {
    // eslint-disable-next-line no-new-func
    model = new Function('PL', '"use strict";\n' + (draft.simulationCode || ''))({});
  } catch (err) {
    push('error', 'simulationCode', `構文エラー: ${(err as Error).message}`);
  }
  if (model) {
    if (typeof model.init !== 'function') push('error', 'simulationCode', 'init(params) が必要です。');
    if (typeof model.step !== 'function') push('error', 'simulationCode', 'step(state, dt, params) が必要です。');
    if (typeof model.sample !== 'function') push('warning', 'simulationCode', 'sample() がないと読み取り値もグラフも出ません。');
  }
  for (const [re, message] of BANNED) {
    if (re.test(draft.simulationCode || '')) push('warning', 'simulationCode', message);
  }
  try {
    // eslint-disable-next-line no-new-func
    new Function('ctx', 'frame', 'params', 'helpers', draft.rendererCode || '');
  } catch (err) {
    push('error', 'rendererCode', `構文エラー: ${(err as Error).message}`);
  }

  const scalarKeys = new Set<string>();
  for (const d of draft.displayDefinitions || []) {
    if (!d.key) push('error', 'displayDefinitions', 'key のない読み取り値があります。');
    scalarKeys.add(d.key);
  }
  for (const p of draft.parameterDefinitions || []) {
    if (!p.key) push('error', 'parameterDefinitions', 'key のないパラメータがあります。');
    if (p.type === 'range' && (p.min === undefined || p.max === undefined)) {
      push('error', 'parameterDefinitions', `${p.key}: range には min と max が要ります。`);
    }
  }
  for (const g of draft.graphDefinitions || []) {
    if (!g.id || !g.x?.key || !g.y?.length) push('error', 'graphDefinitions', 'グラフには id・x.key・y が必要です。');
  }

  return { ok: !problems.some((p) => p.level === 'error'), problems };
}

// ------------------------------------------------------------------- writes

function nowIso() { return new Date().toISOString(); }

function normalize(draft: any, base: Simulation | null, id: number, version: number): Simulation {
  return {
    id,
    slug: (draft.slug || slugify(draft.titleEn || draft.title || '')).trim(),
    title: draft.title || '',
    titleEn: draft.titleEn || '',
    shortDescription: draft.shortDescription || '',
    description: draft.description || '',
    category: draft.category || 'mechanics',
    type: draft.type || 'simulation',
    difficulty: Number(draft.difficulty) || 2,
    targetLevel: draft.targetLevel || 'high-school',
    physicsTopics: draft.physicsTopics || [],
    formulas: draft.formulas || [],
    tags: (draft.tags || []).map((t: any) =>
      typeof t === 'string' ? { slug: t, name: t } : { slug: t.slug, name: t.name || t.slug }),
    simulationCode: draft.simulationCode || '',
    rendererCode: draft.rendererCode || '',
    parameterDefinitions: draft.parameterDefinitions || [],
    graphDefinitions: draft.graphDefinitions || [],
    displayDefinitions: draft.displayDefinitions || [],
    runtimeOptions: draft.runtimeOptions || {},
    experiment: draft.experiment ?? null,
    thumbnail: draft.thumbnail || '',
    status: draft.status || base?.status || 'draft',
    sortOrder: draft.sortOrder ?? base?.sortOrder ?? 99999,
    version,
    author: draft.author || 'るーと',
    createdAt: base?.createdAt || nowIso(),
    updatedAt: nowIso(),
  };
}

async function saveSimulation(draft: any, id?: number): Promise<Simulation> {
  const sims = await allSimulations();
  const base = id ? sims.find((s) => s.id === id) || null : null;
  const o = readOverlay();
  const newId = id ?? o.nextId;

  let slug = (draft.slug || slugify(draft.titleEn || draft.title || '')).trim();
  while (sims.some((s) => s.slug === slug && s.id !== newId)) slug = `${slug}-2`;

  const record = normalize({ ...draft, slug }, base, newId, (base?.version ?? 0) + 1);

  mutate((ov) => {
    ov.simulations[String(newId)] = record;
    ov.deleted = ov.deleted.filter((d) => d !== newId);
    if (!id) ov.nextId = newId + 1;
    const list = ov.versions[String(newId)] || [];
    list.unshift({
      id: list.length + 1,
      version: record.version,
      summary: draft.versionSummary || '',
      changedAt: record.updatedAt,
      changedBy: 'ローカル編集',
      snapshot: record,
    });
    ov.versions[String(newId)] = list.slice(0, 50);
  });

  return record;
}

export const localStore = {
  isAdmin: () => readOverlay().admin,
  setAdmin: (on: boolean) => { mutate((o) => { o.admin = on; }); },

  querySimulations,
  getSimulation,
  getCategories,
  getTags,
  validateDraft,

  createSimulation: (draft: any) => saveSimulation(draft),
  updateSimulation: (id: number, draft: any) => saveSimulation(draft, id),

  async deleteSimulation(id: number) {
    mutate((o) => {
      delete o.simulations[String(id)];
      if (!o.deleted.includes(id)) o.deleted.push(id);
    });
    return { deleted: String(id) };
  },

  async duplicateSimulation(id: number) {
    const sims = await allSimulations();
    const src = sims.find((s) => s.id === id);
    if (!src) throw new Error('複製元が見つかりません。');
    return saveSimulation({
      ...src, id: undefined, slug: `${src.slug}-copy`, title: `${src.title}（複製）`, status: 'draft',
    });
  },

  async setStatus(id: number, action: 'publish' | 'unpublish' | 'archive') {
    const sims = await allSimulations();
    const src = sims.find((s) => s.id === id);
    if (!src) throw new Error('見つかりません。');
    if (action === 'publish') {
      const check = validateDraft(src);
      if (!check.ok) throw Object.assign(new Error('検証に通らないため公開できません。'), { data: check });
    }
    const status = action === 'publish' ? 'published' : action === 'archive' ? 'archived' : 'draft';
    return saveSimulation({ ...src, status, versionSummary: `状態を ${status} に変更` }, id);
  },

  async reorder(order: number[]) {
    const sims = await allSimulations();
    for (let i = 0; i < order.length; i++) {
      const src = sims.find((s) => s.id === order[i]);
      if (src && src.sortOrder !== (i + 1) * 10) {
        // eslint-disable-next-line no-await-in-loop
        await saveSimulation({ ...src, sortOrder: (i + 1) * 10, versionSummary: '並び替え' }, src.id);
      }
    }
    return { ok: true as const };
  },

  async versions(id: number) {
    const list = readOverlay().versions[String(id)] || [];
    return { items: list.map(({ snapshot, ...rest }) => rest) };
  },
  async version(id: number, version: number) {
    const found = (readOverlay().versions[String(id)] || []).find((v) => v.version === version);
    if (!found) throw new Error('その版は残っていません。');
    return found;
  },
  async restoreVersion(id: number, version: number) {
    const found = (readOverlay().versions[String(id)] || []).find((v) => v.version === version);
    if (!found) throw new Error('その版は残っていません。');
    // Restoring brings back the *content* of an old version (title, code,
    // parameters, ...). It must not also revert the current publish state:
    // e.g. restoring the very first (draft) version of an already-published
    // simulation should not silently unpublish it. `status` is therefore
    // deliberately left out of the snapshot spread so `saveSimulation` falls
    // back to the simulation's current status.
    const { status: _restoredStatus, ...content } = found.snapshot as any;
    return saveSimulation({ ...content, versionSummary: `版 ${version} を復元` }, id);
  },

  async createTag(body: any) {
    const tag: Tag = { id: Date.now(), slug: body.slug || slugify(body.name), name: body.name, description: body.description || '' };
    mutate((o) => { o.tags.push(tag); });
    return tag;
  },
  async updateTag(id: number, body: any) {
    const after = mutate((o) => {
      const i = o.tags.findIndex((t) => t.id === id);
      if (i >= 0) o.tags[i] = { ...o.tags[i], ...body };
    });
    const updated = after.tags.find((t) => t.id === id);
    if (!updated) throw new Error('この構成では、同梱タグの名前は seed ファイル側で変更してください。');
    return updated;
  },
  async deleteTag(id: number) {
    mutate((o) => { o.tags = o.tags.filter((t) => t.id !== id); });
    return { deleted: String(id) };
  },

  async createCategory(body: any) {
    const category: Category = {
      id: Date.now(), slug: body.slug || slugify(body.name), name: body.name,
      description: body.description || '', parentSlug: body.parentSlug ?? null, sortOrder: body.sortOrder ?? 999,
    };
    mutate((o) => { o.categories.push(category); });
    return category;
  },
  async updateCategory(id: number, body: any) {
    const after = mutate((o) => {
      const i = o.categories.findIndex((c) => c.id === id);
      if (i >= 0) o.categories[i] = { ...o.categories[i], ...body };
    });
    const updated = after.categories.find((c) => c.id === id);
    if (!updated) throw new Error('この構成では、同梱カテゴリは seed ファイル側で変更してください。');
    return updated;
  },
  async deleteCategory(id: number) {
    const sims = await allSimulations();
    const o = readOverlay();
    const target = o.categories.find((c) => c.id === id);
    if (target && sims.some((s) => s.category === target.slug)) {
      throw Object.assign(new Error('このカテゴリは使用中のため削除できません。'), { status: 409 });
    }
    mutate((ov) => { ov.categories = ov.categories.filter((c) => c.id !== id); });
    return { deleted: String(id) };
  },

  async dashboard() {
    const sims = await allSimulations();
    const categories = await allCategories();
    const tags = await allTags();
    const o = readOverlay();
    const recent = [...sims].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6);
    return {
      simulations: sims.length,
      published: sims.filter((s) => s.status === 'published').length,
      drafts: sims.filter((s) => s.status === 'draft').length,
      experiments: sims.filter((s) => s.type === 'experiment').length,
      categories: categories.length,
      tags: tags.length,
      versions: Object.values(o.versions).reduce((n, v) => n + v.length, 0),
      users: 1,
      localEdits: Object.keys(o.simulations).length + o.deleted.length,
      recentlyUpdated: recent.map(summarize),
      recentlyCreated: [...sims].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6).map(summarize),
      byCategory: categories.map((c) => ({ slug: c.slug, name: c.name, n: c.count ?? 0 })),
    };
  },

  /** Everything the browser is holding, ready to be committed into the repo. */
  async exportOverlay() {
    const o = readOverlay();
    return {
      exportedAt: nowIso(),
      simulations: Object.values(o.simulations),
      deleted: o.deleted,
      categories: o.categories,
      tags: o.tags,
    };
  },

  async importOverlay(json: any) {
    mutate((o) => {
      for (const s of json.simulations || []) o.simulations[String(s.id)] = s;
      o.deleted = [...new Set([...o.deleted, ...(json.deleted || [])])];
      o.categories = [...o.categories, ...(json.categories || [])];
      o.tags = [...o.tags, ...(json.tags || [])];
      o.nextId = Math.max(o.nextId, ...(json.simulations || []).map((s: Simulation) => s.id + 1), 10001);
    });
  },

  clearOverlay() {
    const admin = readOverlay().admin;
    writeOverlay({ ...emptyOverlay(), admin });
  },
};
