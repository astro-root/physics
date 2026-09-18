import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import type { Category, Problem, Simulation, Tag, VersionSummary } from '../../lib/types';
import { CodeEditor } from '../../components/CodeEditor';
import { SimulationWorkbench } from '../../components/SimulationWorkbench';
import { formatDate } from '../../lib/format';

const STARTER_SIMULATION = `// このコードは隔離された Web Worker の中で実行されます。
// 使えるのは PL（数値計算ライブラリ）だけです。DOM も通信もありません。
const { rk4 } = PL;

return {
  meta: { integrator: 'RK4' },

  // パラメータから初期状態を作って返します。
  init(p) {
    return { y: [0, p.v0] };
  },

  // dt だけ時間を進めます。新しい状態を返すか、state を直接書き換えます。
  step(s, dt, p) {
    const deriv = (t, y) => [y[1], -p.g];
    s.y = rk4(deriv, 0, s.y, dt);
    return s;
  },

  // 描画用のデータ、読み取り値、グラフ用の系列を返します。
  sample(s, p, t) {
    const scalars = { t, x: s.y[0], v: s.y[1] };
    return { draw: { x: s.y[0] }, scalars, series: scalars };
  },
};
`;

const STARTER_RENDERER = `// ctx: CanvasRenderingContext2D, frame: sample() の戻り値, helpers: 描画補助
const d = frame.draw;
const view = helpers.view({ xmin: -5, xmax: 5, ymin: -5, ymax: 5 });
helpers.grid(view);
helpers.axes(view);
ctx.fillStyle = helpers.theme.trace[0];
ctx.beginPath();
ctx.arc(view.x(0), view.y(d.x), 8, 0, 2 * Math.PI);
ctx.fill();
`;

const EMPTY: any = {
  title: '', titleEn: '', slug: '', shortDescription: '', description: '',
  category: 'mechanics', type: 'simulation', difficulty: 2, targetLevel: 'high-school',
  physicsTopics: [], formulas: [], tags: [],
  simulationCode: STARTER_SIMULATION, rendererCode: STARTER_RENDERER,
  parameterDefinitions: [
    { key: 'v0', label: '初速', type: 'range', default: 0, min: -20, max: 20, step: 0.1, unit: 'm/s' },
    { key: 'g', label: '重力加速度', type: 'range', default: 9.81, min: 0, max: 30, step: 0.01, unit: 'm/s²' },
  ],
  graphDefinitions: [
    { id: 'x-t', title: '位置 x–t', mode: 'time', x: { key: 't', label: '時間', unit: 's' }, y: [{ key: 'x', label: 'x', color: '#5ac8fa' }] },
  ],
  displayDefinitions: [
    { key: 't', label: '時間', unit: 's', precision: 3 },
    { key: 'x', label: '位置', unit: 'm', precision: 3 },
  ],
  runtimeOptions: { dt: 1 / 1000 },
  experiment: null,
  status: 'draft', sortOrder: 0, author: 'るーと', thumbnail: '', versionSummary: '',
};

type TabId = 'meta' | 'code' | 'controls' | 'experiment' | 'preview' | 'versions';

export function AdminSimulationEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';
  const [draft, setDraft] = useState<any>(isNew ? EMPTY : null);
  const [tab, setTab] = useState<TabId>('meta');
  const [problems, setProblems] = useState<Problem[]>([]);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([api.categories(), api.tags()]).then(([c, t]) => { setCategories(c.items); setTags(t.items); });
  }, []);

  useEffect(() => {
    if (isNew) { setDraft(EMPTY); return; }
    // The admin list carries every status, so it is the cheapest way to turn an
    // id into a slug before fetching the full record.
    (async () => {
      const list = await api.simulations({ status: '' });
      const match = list.items.find((s) => String(s.id) === id);
      if (!match) { setMessage({ kind: 'error', text: 'このシミュレーションは見つかりませんでした。' }); return; }
      const full = await api.simulation(match.slug);
      setDraft({ ...full, tags: full.tags.map((t) => t.slug), versionSummary: '' });
      api.versions(full.id).then((r) => setVersions(r.items)).catch(() => undefined);
    })().catch((err) => setMessage({ kind: 'error', text: err.message }));
  }, [id, isNew]);

  const set = useCallback((patch: Record<string, unknown>) => setDraft((d: any) => ({ ...d, ...patch })), []);

  const previewSim = useMemo<Simulation | null>(() => {
    if (!draft) return null;
    return {
      ...draft,
      id: draft.id ?? 0,
      slug: draft.slug || 'preview',
      tags: (draft.tags || []).map((t: string) => ({ slug: t, name: t })),
      version: draft.version ?? 0,
    } as Simulation;
  }, [draft]);

  if (!draft) return <div className="empty">読み込んでいます…</div>;

  const validate = async () => {
    setBusy(true);
    try {
      const r = await api.validate(draft);
      setProblems(r.problems);
      setMessage(r.ok
        ? { kind: 'success', text: '検証に通りました。公開できます。' }
        : { kind: 'error', text: 'エラーが残っています。修正してください。' });
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message });
    } finally { setBusy(false); }
  };

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const saved = draft.id
        ? await api.updateSimulation(draft.id, draft)
        : await api.createSimulation(draft);
      setDraft({ ...saved, tags: saved.tags.map((t) => t.slug), versionSummary: '' });
      setMessage({ kind: 'success', text: `保存しました（バージョン ${saved.version}）。` });
      api.versions(saved.id).then((r) => setVersions(r.items)).catch(() => undefined);
      if (!draft.id) navigate(`/admin/simulations/${saved.id}`, { replace: true });
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message });
    } finally { setBusy(false); }
  };

  const setStatus = async (action: 'publish' | 'unpublish') => {
    if (!draft.id) { setMessage({ kind: 'error', text: '先に保存してください。' }); return; }
    setBusy(true);
    try {
      const r = await api.setStatus(draft.id, action);
      set({ status: r.status });
      setMessage({ kind: 'success', text: action === 'publish' ? '公開しました。' : '下書きに戻しました。' });
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message });
    } finally { setBusy(false); }
  };

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <h1>{draft.title || '新しいシミュレーション'}</h1>
          <div className="mono" style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>
            {draft.slug || '（保存時に自動生成）'} ・ <span className={`pill pill-${draft.status}`}>{draft.status}</span>
            {draft.version ? ` ・ 版 ${draft.version}` : ''}
          </div>
        </div>
        <div className="btn-row">
          <button className="btn" onClick={validate} disabled={busy}>検証</button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>保存</button>
          {draft.status === 'published'
            ? <button className="btn" onClick={() => setStatus('unpublish')} disabled={busy}>非公開にする</button>
            : <button className="btn" onClick={() => setStatus('publish')} disabled={busy}>公開する</button>}
        </div>
      </div>

      {message && <div className={`notice ${message.kind}`} role="status">{message.text}</div>}
      {problems.length > 0 && (
        <div className="problems">
          {problems.map((p, i) => (
            <div className={`problem ${p.level}`} key={i}>
              <strong>{p.where}</strong><span>{p.message}</span>
            </div>
          ))}
        </div>
      )}

      <div className="editor-tabs" role="tablist">
        {([
          ['meta', '基本情報'], ['code', 'コード'], ['controls', 'パラメータとグラフ'],
          ['experiment', '実験'], ['preview', 'プレビュー'], ['versions', 'バージョン'],
        ] as [TabId, string][]).map(([key, label]) => (
          <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      {tab === 'meta' && (
        <section className="panel"><div className="panel-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <label className="field"><span className="label">タイトル</span>
              <input value={draft.title} onChange={(e) => set({ title: e.target.value })} />
            </label>
            <label className="field"><span className="label">英語タイトル</span>
              <input value={draft.titleEn} onChange={(e) => set({ titleEn: e.target.value })} />
            </label>
            <label className="field"><span className="label">URL スラッグ</span>
              <input value={draft.slug} placeholder="空欄なら自動生成" onChange={(e) => set({ slug: e.target.value })} />
            </label>
            <label className="field"><span className="label">カテゴリ</span>
              <select value={draft.category} onChange={(e) => set({ category: e.target.value })}>
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>{c.parentSlug ? `　${c.name}` : c.name}</option>
                ))}
              </select>
            </label>
            <label className="field"><span className="label">タイプ</span>
              <select value={draft.type} onChange={(e) => set({ type: e.target.value })}>
                <option value="simulation">シミュレーション</option>
                <option value="experiment">実験</option>
                <option value="visualization">可視化</option>
                <option value="model">モデル</option>
                <option value="calculator">計算機</option>
              </select>
            </label>
            <label className="field"><span className="label">難易度 (1–5)</span>
              <input type="number" min={1} max={5} value={draft.difficulty} onChange={(e) => set({ difficulty: Number(e.target.value) })} />
            </label>
            <label className="field"><span className="label">対象レベル</span>
              <select value={draft.targetLevel} onChange={(e) => set({ targetLevel: e.target.value })}>
                <option value="middle-school">中学</option>
                <option value="high-school">高校</option>
                <option value="undergraduate">大学</option>
                <option value="graduate">大学院</option>
              </select>
            </label>
            <label className="field"><span className="label">作成者</span>
              <input value={draft.author} onChange={(e) => set({ author: e.target.value })} />
            </label>
          </div>

          <label className="field"><span className="label">一行説明</span>
            <input value={draft.shortDescription} onChange={(e) => set({ shortDescription: e.target.value })} />
          </label>
          <label className="field"><span className="label">解説（空行で段落が分かれます）</span>
            <textarea rows={8} value={draft.description} onChange={(e) => set({ description: e.target.value })} />
          </label>
          <label className="field"><span className="label">扱う内容（カンマ区切り）</span>
            <input
              value={(draft.physicsTopics || []).join(', ')}
              onChange={(e) => set({ physicsTopics: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
            />
          </label>

          <div className="field">
            <span className="label">タグ（クリックで付け外し／新しい語を入力しても作成できます）</span>
            <div className="tag-row" style={{ marginBottom: 8 }}>
              {tags.map((t) => {
                const on = (draft.tags || []).includes(t.slug);
                return (
                  <button
                    key={t.slug} type="button" className="tag" aria-pressed={on}
                    onClick={() => set({ tags: on ? draft.tags.filter((x: string) => x !== t.slug) : [...draft.tags, t.slug] })}
                  >{t.name}</button>
                );
              })}
            </div>
            <input
              placeholder="タグを追加して Enter"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const value = (e.target as HTMLInputElement).value.trim().toLowerCase();
                  if (value && !draft.tags.includes(value)) set({ tags: [...draft.tags, value] });
                  (e.target as HTMLInputElement).value = '';
                }
              }}
            />
          </div>

          <JsonField
            label="式（{ text, note } の配列）"
            value={draft.formulas}
            onChange={(v) => set({ formulas: v })}
          />
          <label className="field"><span className="label">この保存の変更点（バージョン履歴に残ります）</span>
            <input value={draft.versionSummary || ''} onChange={(e) => set({ versionSummary: e.target.value })} />
          </label>
        </div></section>
      )}

      {tab === 'code' && (
        <div className="grid" style={{ gap: 14 }}>
          <section className="panel">
            <div className="panel-head">
              <h2>シミュレーションコード（Worker 内で実行）</h2>
              <button className="btn btn-sm" onClick={() => set({ simulationCode: STARTER_SIMULATION })}>ひな形を入れる</button>
            </div>
            <CodeEditor label="シミュレーションコード" value={draft.simulationCode} onChange={(v) => set({ simulationCode: v })} />
          </section>
          <section className="panel">
            <div className="panel-head">
              <h2>描画コード（Canvas 2D）</h2>
              <button className="btn btn-sm" onClick={() => set({ rendererCode: STARTER_RENDERER })}>ひな形を入れる</button>
            </div>
            <CodeEditor label="描画コード" value={draft.rendererCode} onChange={(v) => set({ rendererCode: v })} height={360} />
          </section>
          <JsonField label="実行設定（dt, speed, maxSubsteps）" value={draft.runtimeOptions} onChange={(v) => set({ runtimeOptions: v })} height={120} />
        </div>
      )}

      {tab === 'controls' && (
        <div className="grid" style={{ gap: 14 }}>
          <JsonField label="パラメータ定義" value={draft.parameterDefinitions} onChange={(v) => set({ parameterDefinitions: v })} height={300} />
          <JsonField label="グラフ定義" value={draft.graphDefinitions} onChange={(v) => set({ graphDefinitions: v })} height={260} />
          <JsonField label="読み取り値の定義" value={draft.displayDefinitions} onChange={(v) => set({ displayDefinitions: v })} height={220} />
        </div>
      )}

      {tab === 'experiment' && (
        <div className="grid" style={{ gap: 14 }}>
          <div className="btn-row">
            <button className="btn" onClick={() => set({
              experiment: draft.experiment ? null : {
                objective: '', conditions: [], procedure: [],
                measurements: [{ key: 'x', label: '測定量', unit: '', source: 'readout', from: 't' }],
                analysisCode: 'const rows = input.rows;\nreturn { result: { label: "結果", value: rows.length } };',
                theory: null,
              },
            })}>
              {draft.experiment ? '実験モードを外す' : '実験モードを有効にする'}
            </button>
          </div>
          {draft.experiment && (
            <JsonField label="実験の定義（目的・条件・手順・測定項目・解析コード・理論値）" value={draft.experiment} onChange={(v) => set({ experiment: v })} height={420} />
          )}
        </div>
      )}

      {tab === 'preview' && previewSim && (
        <div>
          <div className="notice" style={{ marginBottom: 12 }}>
            公開せずに、いま編集中の内容をそのまま実行しています。保存も公開もされていません。
          </div>
          <SimulationWorkbench simulation={previewSim} compact />
        </div>
      )}

      {tab === 'versions' && (
        <section className="panel">
          <div className="panel-head"><h2>バージョン履歴</h2></div>
          <table className="data">
            <thead><tr><th className="num">版</th><th>変更点</th><th>変更者</th><th>日時</th><th /></tr></thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.id}>
                  <td className="num">{v.version}</td>
                  <td>{v.summary || '—'}</td>
                  <td className="mono" style={{ fontSize: '0.78rem' }}>{v.changedBy}</td>
                  <td style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{formatDate(v.changedAt)}</td>
                  <td>
                    <div className="btn-row">
                      <button className="btn btn-sm" onClick={async () => {
                        const r = await api.version(draft.id, v.version);
                        setDraft({ ...draft, ...r.snapshot, tags: (r.snapshot.tags || []).map((t: any) => t.slug || t), versionSummary: `版 ${v.version} を読み込み` });
                        setMessage({ kind: 'success', text: `版 ${v.version} を編集中の内容に読み込みました。保存すると新しい版になります。` });
                      }}>読み込む</button>
                      <button className="btn btn-sm" onClick={async () => {
                        if (!window.confirm(`版 ${v.version} を復元します。`)) return;
                        const restored = await api.restoreVersion(draft.id, v.version);
                        setDraft({ ...restored, tags: restored.tags.map((t) => t.slug), versionSummary: '' });
                        api.versions(draft.id).then((r) => setVersions(r.items));
                        setMessage({ kind: 'success', text: `版 ${v.version} を復元しました。` });
                      }}>復元</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {versions.length === 0 && <div className="empty">まだ履歴がありません。</div>}
        </section>
      )}
    </div>
  );
}

/**
 * Structured fields are edited as JSON with live parsing. The shapes are
 * validated server-side by the same schema the API uses, so a typo is caught
 * before it can reach a published page.
 */
function JsonField({ label, value, onChange, height = 200 }: { label: string; value: unknown; onChange: (v: any) => void; height?: number }) {
  const [text, setText] = useState(() => JSON.stringify(value ?? null, null, 2));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setText(JSON.stringify(value ?? null, null, 2)); }, [JSON.stringify(value)]);

  return (
    <section className="panel">
      <div className="panel-head">
        <h3>{label}</h3>
        {error ? <span style={{ color: 'var(--rose)', fontSize: '0.8rem' }}>{error}</span>
               : <span style={{ color: 'var(--green)', fontSize: '0.8rem' }}>JSON として正しい形式です</span>}
      </div>
      <CodeEditor
        label={label}
        language="json"
        height={height}
        value={text}
        onChange={(v) => {
          setText(v);
          try { onChange(JSON.parse(v)); setError(null); }
          catch (err) { setError((err as Error).message); }
        }}
      />
    </section>
  );
}
