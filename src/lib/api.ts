import type {
  Category, Simulation, SimulationSummary, Tag, User, VersionSummary, Problem,
} from './types';
import { localStore } from './store';

/**
 * Two deployment shapes share one interface.
 *
 *  - static (default): the catalogue is a JSON bundle in the build and every
 *    query runs in the browser. Deploys to Vercel's free tier as plain static
 *    files: no database, no functions, nothing to pay for.
 *  - server: the Express + SQLite backend under server/, for when several
 *    people need to edit the same catalogue from different machines.
 *
 * Set VITE_DATA_MODE=server to switch.
 */
export const DATA_MODE: 'static' | 'server' =
  import.meta.env.VITE_DATA_MODE === 'server' ? 'server' : 'static';

const LOCAL_PASSPHRASE = import.meta.env.VITE_ADMIN_PASSPHRASE || 'dynamis';
const LOCAL_USER: User = { id: 0, email: 'local-admin', displayName: 'ローカル管理者', role: 'admin' };

const base = '/api';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(base + path, {
    credentials: 'include',
    headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
    ...init,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message = (data && data.error) || `Request failed (${res.status})`;
    throw Object.assign(new Error(message), { status: res.status, data });
  }
  return data as T;
}

export interface SimulationQuery {
  q?: string; category?: string; tags?: string[]; tagMode?: 'and' | 'or';
  type?: string; difficulty?: number; level?: string; sort?: string; status?: string;
}

function toQueryString(query: SimulationQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === '' || value === null) continue;
    params.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

const isStatic = DATA_MODE === 'static';

export const api = {
  mode: DATA_MODE,

  // ------------------------------------------------------------------ auth
  me: (): Promise<{ user: User | null }> =>
    isStatic
      ? Promise.resolve({ user: localStore.isAdmin() ? LOCAL_USER : null })
      : request('/auth/me'),

  login: (email: string, password: string): Promise<{ user: User }> => {
    if (!isStatic) {
      return request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    }
    if (password !== LOCAL_PASSPHRASE) return Promise.reject(new Error('合言葉が違います。'));
    localStore.setAdmin(true);
    return Promise.resolve({ user: LOCAL_USER });
  },

  register: (email: string, password: string, displayName?: string): Promise<{ user: User }> =>
    isStatic
      ? Promise.reject(new Error('この構成にアカウント登録はありません。閲覧に登録は不要です。'))
      : request('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, displayName }) }),

  logout: (): Promise<{ ok: true }> => {
    if (isStatic) { localStore.setAdmin(false); return Promise.resolve({ ok: true as const }); }
    return request('/auth/logout', { method: 'POST' });
  },

  users: (): Promise<{ items: User[] }> =>
    isStatic ? Promise.resolve({ items: [LOCAL_USER] }) : request('/auth/users'),

  setRole: (id: number, role: string): Promise<{ ok: true }> =>
    isStatic
      ? Promise.reject(new Error('この構成には権限の概念がありません（編集はこのブラウザの中だけです）。'))
      : request(`/auth/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),

  // ----------------------------------------------------------- simulations
  simulations: (query: SimulationQuery = {}): Promise<{ items: SimulationSummary[]; total: number }> =>
    isStatic ? localStore.querySimulations(query) : request(`/simulations${toQueryString(query)}`),

  simulation: (slug: string): Promise<Simulation> =>
    isStatic ? localStore.getSimulation(slug) : request(`/simulations/${slug}`),

  createSimulation: (body: any): Promise<Simulation> =>
    isStatic ? localStore.createSimulation(body) : request('/simulations', { method: 'POST', body: JSON.stringify(body) }),

  updateSimulation: (id: number, body: any): Promise<Simulation> =>
    isStatic ? localStore.updateSimulation(id, body) : request(`/simulations/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  deleteSimulation: (id: number): Promise<{ deleted: string }> =>
    isStatic ? localStore.deleteSimulation(id) : request(`/simulations/${id}`, { method: 'DELETE' }),

  duplicateSimulation: (id: number): Promise<Simulation> =>
    isStatic ? localStore.duplicateSimulation(id) : request(`/simulations/${id}/duplicate`, { method: 'POST' }),

  setStatus: (id: number, action: 'publish' | 'unpublish' | 'archive'): Promise<SimulationSummary> =>
    isStatic
      ? (localStore.setStatus(id, action) as unknown as Promise<SimulationSummary>)
      : request(`/simulations/${id}/${action}`, { method: 'POST' }),

  validate: (body: any): Promise<{ ok: boolean; problems: Problem[] }> =>
    isStatic
      ? Promise.resolve(localStore.validateDraft(body))
      : request('/simulations/validate', { method: 'POST', body: JSON.stringify(body) }),

  reorder: (order: number[]): Promise<{ ok: true }> =>
    isStatic ? localStore.reorder(order) : request('/simulations/reorder', { method: 'POST', body: JSON.stringify({ order }) }),

  versions: (id: number): Promise<{ items: VersionSummary[] }> =>
    isStatic ? localStore.versions(id) : request(`/simulations/${id}/versions`),

  version: (id: number, version: number): Promise<VersionSummary & { snapshot: Simulation }> =>
    isStatic ? localStore.version(id, version) : request(`/simulations/${id}/versions/${version}`),

  restoreVersion: (id: number, version: number): Promise<Simulation> =>
    isStatic ? localStore.restoreVersion(id, version) : request(`/simulations/${id}/versions/${version}/restore`, { method: 'POST' }),

  // -------------------------------------------------------------- taxonomy
  categories: (): Promise<{ items: Category[] }> => (isStatic ? localStore.getCategories() : request('/categories')),
  createCategory: (body: any): Promise<Category> =>
    isStatic ? localStore.createCategory(body) : request('/categories', { method: 'POST', body: JSON.stringify(body) }),
  updateCategory: (id: number, body: any): Promise<Category> =>
    isStatic ? localStore.updateCategory(id, body) : request(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteCategory: (id: number): Promise<{ deleted: string }> =>
    isStatic ? localStore.deleteCategory(id) : request(`/categories/${id}`, { method: 'DELETE' }),

  tags: (): Promise<{ items: Tag[] }> => (isStatic ? localStore.getTags() : request('/tags')),
  createTag: (body: any): Promise<Tag> =>
    isStatic ? localStore.createTag(body) : request('/tags', { method: 'POST', body: JSON.stringify(body) }),
  updateTag: (id: number, body: any): Promise<Tag> =>
    isStatic ? localStore.updateTag(id, body) : request(`/tags/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteTag: (id: number): Promise<{ deleted: string }> =>
    isStatic ? localStore.deleteTag(id) : request(`/tags/${id}`, { method: 'DELETE' }),

  dashboard: (): Promise<any> => (isStatic ? localStore.dashboard() : request('/stats/dashboard')),
};
