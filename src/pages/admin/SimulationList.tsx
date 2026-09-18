import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import type { SimulationSummary } from '../../lib/types';
import { TYPE_LABELS } from '../../lib/types';
import { formatDate } from '../../lib/format';

export function AdminSimulationList() {
  const [items, setItems] = useState<SimulationSummary[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = () => {
    api.simulations({ q, status, sort: 'recent' }).then((r) => setItems(r.items)).catch((e) => setMessage(e.message));
  };

  useEffect(() => { const t = window.setTimeout(load, 180); return () => window.clearTimeout(t); }, [q, status]);

  const act = async (fn: () => Promise<unknown>, note: string) => {
    setBusy(true);
    setMessage(null);
    try { await fn(); setMessage(note); load(); }
    catch (err) { setMessage((err as Error).message); }
    finally { setBusy(false); }
  };

  const move = async (index: number, delta: number) => {
    const next = [...items];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    await api.reorder(next.map((s) => s.id));
  };

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <h1>シミュレーション</h1>
        <Link className="btn btn-primary" to="/admin/simulations/new">新規作成</Link>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input type="search" placeholder="検索" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 320 }} />
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ maxWidth: 200 }}>
          <option value="">公開中と下書き</option>
          <option value="published">公開中のみ</option>
          <option value="draft">下書きのみ</option>
          <option value="archived">アーカイブ済み</option>
        </select>
      </div>

      {message && <div className="notice">{message}</div>}

      <div className="panel">
        <table className="data">
          <thead>
            <tr>
              <th>タイトル</th>
              <th>カテゴリ</th>
              <th>タイプ</th>
              <th>状態</th>
              <th className="num">版</th>
              <th className="num">更新</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((s, i) => (
              <tr key={s.id}>
                <td>
                  <Link to={`/admin/simulations/${s.id}`}>{s.title}</Link>
                  <div className="mono" style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>{s.slug}</div>
                </td>
                <td>{s.category}</td>
                <td>{TYPE_LABELS[s.type]}</td>
                <td><span className={`pill pill-${s.status}`}>{s.status}</span></td>
                <td className="num">{s.version}</td>
                <td className="num" style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>{formatDate(s.updatedAt)}</td>
                <td>
                  <div className="btn-row">
                    <Link className="btn btn-sm" to={`/s/${s.slug}`}>表示</Link>
                    {s.status === 'published' ? (
                      <button className="btn btn-sm" disabled={busy} onClick={() => act(() => api.setStatus(s.id, 'unpublish'), `${s.title} を下書きに戻しました`)}>非公開</button>
                    ) : (
                      <button className="btn btn-sm" disabled={busy} onClick={() => act(() => api.setStatus(s.id, 'publish'), `${s.title} を公開しました`)}>公開</button>
                    )}
                    <button className="btn btn-sm" disabled={busy} onClick={() => act(() => api.duplicateSimulation(s.id), `${s.title} を複製しました`)}>複製</button>
                    <button className="btn btn-sm" onClick={() => move(i, -1)} aria-label="上へ">↑</button>
                    <button className="btn btn-sm" onClick={() => move(i, 1)} aria-label="下へ">↓</button>
                    <button
                      className="btn btn-sm btn-danger" disabled={busy}
                      onClick={() => {
                        if (window.confirm(`${s.title} を削除します。取り消せません。`)) {
                          act(() => api.deleteSimulation(s.id), `${s.title} を削除しました`);
                        }
                      }}
                    >削除</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <div className="empty">該当するものがありません。</div>}
      </div>
    </div>
  );
}
