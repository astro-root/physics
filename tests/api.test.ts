import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';

// The server reads its configuration at import time, so the environment has to
// be prepared before anything under server/ is loaded.
const tmpDb = path.join(os.tmpdir(), `dynamis-test-${Date.now()}.db`);
process.env.DATABASE_FILE = tmpDb;
process.env.JWT_SECRET = 'test-secret-value-used-only-in-the-suite';
process.env.ADMIN_EMAIL = 'admin@test.local';
process.env.ADMIN_PASSWORD = 'admin-password-123';
process.env.NODE_ENV = 'test';

// The optional server stack may not be installed (the default static
// deployment does not need it), so these tests skip themselves rather than
// failing the suite on a front-end-only checkout.
const serverInstalled = fs.existsSync(new URL('../node_modules/express', import.meta.url));
const describeServer = serverInstalled ? describe : describe.skip;

let app: any;
let db: any;

const adminAgent = () => request.agent(app);

beforeAll(async () => {
  if (!serverInstalled) return;
  const { createApp } = await import('../server/app.js');
  const { getDb } = await import('../server/db.js');
  const { hashPassword } = await import('../server/auth.js');
  app = createApp();
  db = getDb();
  db.prepare('INSERT INTO categories (slug, name) VALUES (?, ?)').run('mechanics', 'Mechanics');
  db.prepare('INSERT INTO users (email, display_name, password_hash, role) VALUES (?, ?, ?, ?)')
    .run('admin@test.local', 'Admin', await hashPassword('admin-password-123'), 'admin');
  db.prepare('INSERT INTO users (email, display_name, password_hash, role) VALUES (?, ?, ?, ?)')
    .run('user@test.local', 'User', await hashPassword('user-password-123'), 'user');
});

afterAll(async () => {
  if (!serverInstalled) return;
  const { closeDb } = await import('../server/db.js');
  closeDb();
  for (const suffix of ['', '-wal', '-shm']) {
    if (fs.existsSync(tmpDb + suffix)) fs.unlinkSync(tmpDb + suffix);
  }
});

const sample = {
  title: 'テスト用シミュレーション',
  titleEn: 'Test simulation',
  category: 'mechanics',
  type: 'simulation',
  shortDescription: 'テスト',
  simulationCode: 'return { init: (p) => ({ x: 0 }), step: (s, dt) => { s.x += dt; return s; }, sample: (s, p, t) => ({ scalars: { t, x: s.x }, series: { t, x: s.x } }) };',
  rendererCode: 'ctx.fillRect(0, 0, 10, 10);',
  parameterDefinitions: [{ key: 'v0', label: 'v0', type: 'number', default: 1 }],
  tags: ['mechanics', 'テストタグ'],
};

describeServer('authentication', () => {
  it('rejects a wrong password without revealing which field was wrong', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@test.local', password: 'not-the-password' });
    expect(res.status).toBe(401);
    expect(res.body.error).not.toContain('password is');
  });

  it('signs an administrator in and reports the role', async () => {
    const agent = adminAgent();
    const res = await agent.post('/api/auth/login').send({ email: 'admin@test.local', password: 'admin-password-123' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('admin');
    const me = await agent.get('/api/auth/me');
    expect(me.body.user.email).toBe('admin@test.local');
  });

  it('never lets a registration request choose its own role', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'sneaky@test.local', password: 'password-123', role: 'admin' });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('user');
    const row = db.prepare('SELECT role FROM users WHERE email = ?').get('sneaky@test.local');
    expect(row.role).toBe('user');
  });

  it('treats a forged token as a guest', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not.a.real.token');
    expect(res.status).toBe(200);
    expect(res.body.user).toBeNull();
  });
});

describeServer('permissions', () => {
  it('refuses writes from a guest', async () => {
    const res = await request(app).post('/api/simulations').send(sample);
    expect(res.status).toBe(401);
  });

  it('refuses writes from a signed-in non-admin', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: 'user@test.local', password: 'user-password-123' });
    const res = await agent.post('/api/simulations').send(sample);
    expect(res.status).toBe(403);
  });

  it('checks the role against the database, not the token', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: 'admin@test.local', password: 'admin-password-123' });
    expect((await agent.get('/api/stats/dashboard')).status).toBe(200);
    // Demote in the database while the session cookie is still valid.
    db.prepare("UPDATE users SET role = 'user' WHERE email = ?").run('admin@test.local');
    expect((await agent.get('/api/stats/dashboard')).status).toBe(403);
    db.prepare("UPDATE users SET role = 'admin' WHERE email = ?").run('admin@test.local');
  });
});

describeServer('simulation lifecycle', () => {
  let agent: any;
  let created: any;

  beforeAll(async () => {
    agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: 'admin@test.local', password: 'admin-password-123' });
  });

  it('creates a draft with a generated slug and version 1', async () => {
    const res = await agent.post('/api/simulations').send(sample);
    expect(res.status).toBe(201);
    created = res.body;
    expect(created.status).toBe('draft');
    expect(created.version).toBe(1);
    expect(created.slug).toBeTruthy();
    expect(created.tags.map((t: any) => t.slug)).toContain('mechanics');
  });

  it('hides drafts from anonymous visitors', async () => {
    const list = await request(app).get('/api/simulations');
    expect(list.body.items.find((s: any) => s.slug === created.slug)).toBeUndefined();
    const direct = await request(app).get(`/api/simulations/${created.slug}`);
    expect(direct.status).toBe(404);
  });

  it('publishes, and then the public can read it', async () => {
    const res = await agent.post(`/api/simulations/${created.id}/publish`);
    expect(res.status).toBe(200);
    const direct = await request(app).get(`/api/simulations/${created.slug}`);
    expect(direct.status).toBe(200);
    expect(direct.body.simulationCode).toContain('init');
  });

  it('refuses to publish code that does not compile', async () => {
    const broken = await agent.post('/api/simulations').send({ ...sample, title: 'Broken', simulationCode: 'return {' });
    const res = await agent.post(`/api/simulations/${broken.body.id}/publish`);
    expect(res.status).toBe(400);
    expect(res.body.problems.length).toBeGreaterThan(0);
    await agent.delete(`/api/simulations/${broken.body.id}`);
  });

  it('records a version on every update and can restore an old one', async () => {
    const updated = await agent.put(`/api/simulations/${created.id}`).send({
      ...sample, slug: created.slug, title: '書き換え後', status: 'published', versionSummary: 'タイトル変更',
    });
    expect(updated.status).toBe(200);
    expect(updated.body.version).toBe(2);

    const versions = await agent.get(`/api/simulations/${created.id}/versions`);
    expect(versions.body.items.length).toBeGreaterThanOrEqual(2);
    expect(versions.body.items[0].changedBy).toBe('admin@test.local');

    const restored = await agent.post(`/api/simulations/${created.id}/versions/1/restore`);
    expect(restored.status).toBe(200);
    expect(restored.body.title).toBe(sample.title);
    // Restoring moves forward: it creates a new version rather than rewriting history.
    expect(restored.body.version).toBe(3);
  });

  it('duplicates as a draft with a distinct slug', async () => {
    const copy = await agent.post(`/api/simulations/${created.id}/duplicate`);
    expect(copy.status).toBe(201);
    expect(copy.body.slug).not.toBe(created.slug);
    expect(copy.body.status).toBe('draft');
    await agent.delete(`/api/simulations/${copy.body.id}`);
  });

  it('validates code and reports both errors and warnings', async () => {
    const res = await agent.post('/api/simulations/validate').send({
      ...sample,
      simulationCode: 'return { init(){ return {}; }, step(){ fetch("https://example.com"); } };',
    });
    expect(res.body.problems.some((p: any) => /Network access/i.test(p.message))).toBe(true);
  });

  it('finds the simulation by keyword and by tag', async () => {
    const byWord = await request(app).get('/api/simulations?q=test');
    expect(byWord.body.items.some((s: any) => s.slug === created.slug)).toBe(true);
    const byTag = await request(app).get('/api/simulations?tags=mechanics');
    expect(byTag.body.items.some((s: any) => s.slug === created.slug)).toBe(true);
    const missing = await request(app).get('/api/simulations?tags=mechanics,does-not-exist&tagMode=and');
    expect(missing.body.items.length).toBe(0);
  });

  it('unpublishes and deletes', async () => {
    expect((await agent.post(`/api/simulations/${created.id}/unpublish`)).status).toBe(200);
    expect((await agent.delete(`/api/simulations/${created.id}`)).status).toBe(200);
    expect((await request(app).get(`/api/simulations/${created.slug}`)).status).toBe(404);
  });
});

describeServer('taxonomy', () => {
  it('will not delete a category that is still in use', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: 'admin@test.local', password: 'admin-password-123' });
    const sim = await agent.post('/api/simulations').send(sample);
    const categories = await request(app).get('/api/categories');
    const mechanics = categories.body.items.find((c: any) => c.slug === 'mechanics');
    const res = await agent.delete(`/api/categories/${mechanics.id}`);
    expect(res.status).toBe(409);
    await agent.delete(`/api/simulations/${sim.body.id}`);
  });

  it('creates, renames and deletes a tag', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: 'admin@test.local', password: 'admin-password-123' });
    const created = await agent.post('/api/tags').send({ name: '一時タグ', description: '' });
    expect(created.status).toBe(201);
    const renamed = await agent.put(`/api/tags/${created.body.id}`).send({ name: '改名後', slug: 'renamed-tag' });
    expect(renamed.body.slug).toBe('renamed-tag');
    expect((await agent.delete(`/api/tags/${created.body.id}`)).status).toBe(200);
  });
});
