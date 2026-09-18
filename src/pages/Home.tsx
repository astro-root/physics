import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import type { Category, SimulationSummary, Tag } from '../lib/types';
import { TYPE_LABELS, LEVEL_LABELS } from '../lib/types';

const SORTS = [
  { value: 'recent', label: '更新が新しい順' },
  { value: 'title', label: '名前順' },
  { value: 'difficulty', label: 'やさしい順' },
  { value: 'created', label: '追加が新しい順' },
];

export function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<SimulationSummary[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const q = searchParams.get('q') || '';
  const category = searchParams.get('category') || '';
  const type = searchParams.get('type') || '';
  const level = searchParams.get('level') || '';
  const difficulty = searchParams.get('difficulty') || '';
  const sort = searchParams.get('sort') || 'recent';
  const tagMode = (searchParams.get('tagMode') as 'and' | 'or') || 'and';
  const selectedTags = useMemo(
    () => (searchParams.get('tags') || '').split(',').filter(Boolean),
    [searchParams],
  );

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    value ? next.set(key, value) : next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const toggleTag = (slug: string) => {
    const next = selectedTags.includes(slug)
      ? selectedTags.filter((t) => t !== slug)
      : [...selectedTags, slug];
    setParam('tags', next.join(','));
  };

  useEffect(() => {
    Promise.all([api.categories(), api.tags()])
      .then(([c, t]) => { setCategories(c.items); setTags(t.items); })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const handle = window.setTimeout(() => {
      api
        .simulations({
          q, category, type, level, sort, tagMode,
          tags: selectedTags,
          difficulty: difficulty ? Number(difficulty) : undefined,
        })
        .then((r) => { if (!cancelled) { setItems(r.items); setError(null); } })
        .catch((err) => { if (!cancelled) setError(err.message); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 180);
    return () => { cancelled = true; window.clearTimeout(handle); };
  }, [q, category, type, level, difficulty, sort, tagMode, selectedTags]);

  const topTags = tags.filter((t) => (t.count ?? 0) > 0).slice(0, 26);
  const parents = categories.filter((c) => !c.parentSlug);

  return (
    <div className="grid" style={{ gap: 22 }}>
      <section>
        <h1>カタログ</h1>
        <p style={{ color: 'var(--ink-dim)' }}>
          力学から宇宙論まで、ブラウザ上でパラメータを動かしながら計算できるシミュレーション・可視化・実験のカタログです。
          結果は CSV / JSON で書き出せます。
        </p>
      </section>

      <section className="panel">
        <div className="panel-body grid" style={{ gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 2fr) repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
            <label className="field" style={{ margin: 0 }}>
              <span className="label">キーワード</span>
              <input
                type="text" value={q} placeholder="振り子、軌道、トンネル効果…"
                onChange={(e) => setParam('q', e.target.value)}
              />
            </label>
            <label className="field" style={{ margin: 0 }}>
              <span className="label">カテゴリ</span>
              <select value={category} onChange={(e) => setParam('category', e.target.value)}>
                <option value="">すべて</option>
                {parents.map((c) => (
                  <optgroup key={c.slug} label={c.name}>
                    <option value={c.slug}>{c.name}（全体）</option>
                    {categories.filter((s) => s.parentSlug === c.slug).map((s) => (
                      <option key={s.slug} value={s.slug}>{s.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="field" style={{ margin: 0 }}>
              <span className="label">タイプ</span>
              <select value={type} onChange={(e) => setParam('type', e.target.value)}>
                <option value="">すべて</option>
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="field" style={{ margin: 0 }}>
              <span className="label">対象レベル</span>
              <select value={level} onChange={(e) => setParam('level', e.target.value)}>
                <option value="">すべて</option>
                {Object.entries(LEVEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="field" style={{ margin: 0 }}>
              <span className="label">難易度（以下）</span>
              <select value={difficulty} onChange={(e) => setParam('difficulty', e.target.value)}>
                <option value="">すべて</option>
                {[1, 2, 3, 4, 5].map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
            <label className="field" style={{ margin: 0 }}>
              <span className="label">並び順</span>
              <select value={sort} onChange={(e) => setParam('sort', e.target.value)}>
                {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <span className="label" style={{ margin: 0, fontSize: '0.82rem', color: 'var(--ink-dim)' }}>タグ</span>
              <div className="btn-row">
                <button
                  className="btn btn-sm" aria-pressed={tagMode === 'and'}
                  onClick={() => setParam('tagMode', 'and')}
                  style={tagMode === 'and' ? { borderColor: 'var(--cyan)' } : undefined}
                >すべて含む</button>
                <button
                  className="btn btn-sm" aria-pressed={tagMode === 'or'}
                  onClick={() => setParam('tagMode', 'or')}
                  style={tagMode === 'or' ? { borderColor: 'var(--cyan)' } : undefined}
                >いずれか</button>
                {selectedTags.length > 0 && (
                  <button className="btn btn-sm" onClick={() => setParam('tags', '')}>タグを解除</button>
                )}
              </div>
            </div>
            <div className="tag-row">
              {topTags.map((t) => (
                <button
                  key={t.slug} className="tag" aria-pressed={selectedTags.includes(t.slug)}
                  onClick={() => toggleTag(t.slug)} title={t.description}
                >
                  {t.name}<span style={{ color: 'var(--muted)' }}>{t.count}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {error && <div className="notice error" role="alert">{error}</div>}

      <section aria-live="polite">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <h2>{loading ? '検索中…' : `${items.length} 件`}</h2>
        </div>
        {!loading && items.length === 0 ? (
          <div className="empty">
            条件に合うものがありません。キーワードを短くするか、タグの条件を「いずれか」に切り替えてみてください。
          </div>
        ) : (
          <div className="card-grid">
            {items.map((s) => <SimulationCard key={s.slug} item={s} />)}
          </div>
        )}
      </section>
    </div>
  );
}

export function SimulationCard({ item }: { item: SimulationSummary }) {
  return (
    <Link className="card" to={`/s/${item.slug}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'start' }}>
        <h3>{item.title}</h3>
        <span className="pill">{TYPE_LABELS[item.type]}</span>
      </div>
      <p>{item.shortDescription}</p>
      <div className="tag-row">
        {item.tags.slice(0, 4).map((t) => <span className="tag" key={t.slug}>{t.name}</span>)}
      </div>
      <div className="card-meta">
        <span className="difficulty" aria-label={`難易度 ${item.difficulty} / 5`}>
          {[1, 2, 3, 4, 5].map((n) => <i key={n} className={n <= item.difficulty ? 'on' : ''} />)}
        </span>
        <span>{LEVEL_LABELS[item.targetLevel]}</span>
        {item.status !== 'published' && <span className={`pill pill-${item.status}`}>{item.status}</span>}
      </div>
    </Link>
  );
}
