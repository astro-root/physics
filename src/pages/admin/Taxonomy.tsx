import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { Category, Tag } from '../../lib/types';

export function AdminTags() {
  const [items, setItems] = useState<Tag[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const load = () => api.tags().then((r) => setItems(r.items)).catch((e) => setMessage(e.message));
  useEffect(() => { load(); }, []);

  const run = async (fn: () => Promise<unknown>, note: string) => {
    try { await fn(); setMessage(note); load(); } catch (err) { setMessage((err as Error).message); }
  };

  return (
    <div className="grid" style={{ gap: 16 }}>
      <h1>タグ</h1>
      <p style={{ color: 'var(--ink-dim)' }}>
        タグはカテゴリとは独立しています。1 つのシミュレーションに何個でも付けられ、カタログの絞り込みに使われます。
      </p>
      {message && <div className="notice">{message}</div>}

      <section className="panel">
        <div className="panel-head"><h2>新しいタグ</h2></div>
        <div className="panel-body" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
          <label className="field" style={{ margin: 0, flex: '1 1 200px' }}>
            <span className="label">表示名</span>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field" style={{ margin: 0, flex: '2 1 280px' }}>
            <span className="label">説明</span>
            <input value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <button className="btn btn-primary" disabled={!name.trim()} onClick={() => run(async () => {
            await api.createTag({ name, description });
            setName(''); setDescription('');
          }, 'タグを作成しました')}>作成</button>
        </div>
      </section>

      <section className="panel">
        <table className="data">
          <thead><tr><th>表示名</th><th>スラッグ</th><th>説明</th><th className="num">使用数</th><th /></tr></thead>
          <tbody>
            {items.map((t) => (
              <TagRow key={t.id} tag={t} onSave={(patch) => run(() => api.updateTag(t.id!, patch), '更新しました')}
                onDelete={() => {
                  if (window.confirm(`${t.name} を削除します。付いているシミュレーションからも外れます。`)) {
                    run(() => api.deleteTag(t.id!), '削除しました');
                  }
                }} />
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function TagRow({ tag, onSave, onDelete }: { tag: Tag; onSave: (patch: any) => void; onDelete: () => void }) {
  const [name, setName] = useState(tag.name);
  const [slug, setSlug] = useState(tag.slug);
  const [description, setDescription] = useState(tag.description || '');
  const dirty = name !== tag.name || slug !== tag.slug || description !== (tag.description || '');
  return (
    <tr>
      <td><input value={name} onChange={(e) => setName(e.target.value)} aria-label="表示名" /></td>
      <td><input className="mono" value={slug} onChange={(e) => setSlug(e.target.value)} aria-label="スラッグ" /></td>
      <td><input value={description} onChange={(e) => setDescription(e.target.value)} aria-label="説明" /></td>
      <td className="num">{tag.count ?? 0}</td>
      <td>
        <div className="btn-row">
          <button className="btn btn-sm" disabled={!dirty} onClick={() => onSave({ name, slug, description })}>保存</button>
          <button className="btn btn-sm btn-danger" onClick={onDelete}>削除</button>
        </div>
      </td>
    </tr>
  );
}

export function AdminCategories() {
  const [items, setItems] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [parentSlug, setParentSlug] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const load = () => api.categories().then((r) => setItems(r.items)).catch((e) => setMessage(e.message));
  useEffect(() => { load(); }, []);

  const run = async (fn: () => Promise<unknown>, note: string) => {
    try { await fn(); setMessage(note); load(); } catch (err) { setMessage((err as Error).message); }
  };

  return (
    <div className="grid" style={{ gap: 16 }}>
      <h1>カテゴリ</h1>
      <p style={{ color: 'var(--ink-dim)' }}>
        カテゴリは 1 つのシミュレーションにつき 1 つだけで、分野の階層を表します。使われているカテゴリは削除できません。
      </p>
      {message && <div className="notice">{message}</div>}

      <section className="panel">
        <div className="panel-head"><h2>新しいカテゴリ</h2></div>
        <div className="panel-body" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
          <label className="field" style={{ margin: 0, flex: '1 1 200px' }}>
            <span className="label">名前</span>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field" style={{ margin: 0, flex: '1 1 200px' }}>
            <span className="label">親カテゴリ</span>
            <select value={parentSlug} onChange={(e) => setParentSlug(e.target.value)}>
              <option value="">（なし）</option>
              {items.filter((c) => !c.parentSlug).map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </label>
          <button className="btn btn-primary" disabled={!name.trim()} onClick={() => run(async () => {
            await api.createCategory({ name, parentSlug: parentSlug || null, sortOrder: items.length * 10 });
            setName('');
          }, 'カテゴリを作成しました')}>作成</button>
        </div>
      </section>

      <section className="panel">
        <table className="data">
          <thead><tr><th>名前</th><th>スラッグ</th><th>親</th><th className="num">順序</th><th className="num">公開数</th><th /></tr></thead>
          <tbody>
            {items.map((c) => (
              <CategoryRow
                key={c.id} category={c} all={items}
                onSave={(patch) => run(() => api.updateCategory(c.id!, patch), '更新しました')}
                onDelete={() => {
                  if (window.confirm(`${c.name} を削除します。`)) run(() => api.deleteCategory(c.id!), '削除しました');
                }}
              />
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function CategoryRow({ category, all, onSave, onDelete }: { category: Category; all: Category[]; onSave: (p: any) => void; onDelete: () => void }) {
  const [name, setName] = useState(category.name);
  const [slug, setSlug] = useState(category.slug);
  const [parent, setParent] = useState(category.parentSlug || '');
  const [order, setOrder] = useState(category.sortOrder);
  const dirty = name !== category.name || slug !== category.slug || parent !== (category.parentSlug || '') || order !== category.sortOrder;
  return (
    <tr>
      <td><input value={name} onChange={(e) => setName(e.target.value)} aria-label="名前" /></td>
      <td><input className="mono" value={slug} onChange={(e) => setSlug(e.target.value)} aria-label="スラッグ" /></td>
      <td>
        <select value={parent} onChange={(e) => setParent(e.target.value)} aria-label="親カテゴリ">
          <option value="">（なし）</option>
          {all.filter((c) => !c.parentSlug && c.slug !== category.slug).map((c) => (
            <option key={c.slug} value={c.slug}>{c.name}</option>
          ))}
        </select>
      </td>
      <td className="num"><input type="number" value={order} onChange={(e) => setOrder(Number(e.target.value))} aria-label="順序" style={{ width: 80, textAlign: 'right' }} /></td>
      <td className="num">{category.count ?? 0}</td>
      <td>
        <div className="btn-row">
          <button className="btn btn-sm" disabled={!dirty} onClick={() => onSave({ name, slug, description: category.description, parentSlug: parent || null, sortOrder: order })}>保存</button>
          <button className="btn btn-sm btn-danger" onClick={onDelete}>削除</button>
        </div>
      </td>
    </tr>
  );
}

export function AdminUsers() {
  const [items, setItems] = useState<any[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const load = () => api.users().then((r) => setItems(r.items)).catch((e) => setMessage(e.message));
  useEffect(() => { load(); }, []);

  return (
    <div className="grid" style={{ gap: 16 }}>
      <h1>ユーザー</h1>
      <p style={{ color: 'var(--ink-dim)' }}>
        権限はサーバー側で毎回データベースから読み直して判定されます。画面上でボタンを隠すだけの制御はしていません。
      </p>
      {message && <div className="notice">{message}</div>}
      <section className="panel">
        <table className="data">
          <thead><tr><th>メールアドレス</th><th>権限</th><th /></tr></thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.id}>
                <td className="mono">{u.email}</td>
                <td><span className="pill">{u.role}</span></td>
                <td>
                  <button className="btn btn-sm" onClick={async () => {
                    try {
                      await api.setRole(u.id, u.role === 'admin' ? 'user' : 'admin');
                      setMessage('権限を変更しました'); load();
                    } catch (err) { setMessage((err as Error).message); }
                  }}>
                    {u.role === 'admin' ? '管理者から外す' : '管理者にする'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
