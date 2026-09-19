import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { localStore } from '../../lib/store';
import { download, formatDate } from '../../lib/format';

export function AdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { api.dashboard().then(setData).catch((e) => setError(e.message)); }, []);

  if (error) return <div className="notice error">{error}</div>;
  if (!data) return <div className="empty">読み込んでいます…</div>;

  const stats = [
    ['シミュレーション', data.simulations],
    ['公開中', data.published],
    ['下書き', data.drafts],
    ['実験', data.experiments],
    ['カテゴリ', data.categories],
    ['タグ', data.tags],
    ['バージョン履歴', data.versions],
    ['ユーザー', data.users],
  ] as [string, number][];

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h1>ダッシュボード</h1>
        <Link className="btn btn-primary" to="/admin/simulations/new">新しいシミュレーション</Link>
      </div>

      {api.mode === 'static' && <LocalEdits count={data.localEdits ?? 0} />}

      <div className="stat-grid">
        {stats.map(([label, n]) => (
          <div className="stat" key={label}>
            <div className="n">{n}</div>
            <div className="k">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <RecentList title="最近更新" items={data.recentlyUpdated} field="updatedAt" />
        <RecentList title="最近作成" items={data.recentlyCreated} field="createdAt" />
      </div>

      <section className="panel">
        <div className="panel-head"><h2>カテゴリ別の件数</h2></div>
        <div className="panel-body" style={{ padding: 0 }}>
          <table className="data">
            <thead><tr><th>カテゴリ</th><th className="num">件数</th></tr></thead>
            <tbody>
              {data.byCategory.filter((c: any) => c.n > 0).map((c: any) => (
                <tr key={c.slug}>
                  <td><Link to={`/catalog?category=${c.slug}`}>{c.name}</Link></td>
                  <td className="num">{c.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function RecentList({ title, items, field }: { title: string; items: any[]; field: string }) {
  return (
    <section className="panel">
      <div className="panel-head"><h2>{title}</h2></div>
      <div className="panel-body" style={{ padding: 0 }}>
        <table className="data">
          <tbody>
            {items.map((s) => (
              <tr key={s.id}>
                <td>
                  <Link to={`/admin/simulations/${s.id}`}>{s.title}</Link>
                  <span className={`pill pill-${s.status}`} style={{ marginLeft: 8 }}>{s.status}</span>
                </td>
                <td className="num" style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>{formatDate(s[field])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * In the static deployment, edits live in this browser only. This panel is the
 * bridge back to the repository: export the overlay, drop it into
 * server/seed (or import it on another machine), rebuild, redeploy.
 */
function LocalEdits({ count }: { count: number }) {
  const [message, setMessage] = useState<string | null>(null);

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>このブラウザの編集内容</h2>
        <span className="mono" style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>{count} 件</span>
      </div>
      <div className="panel-body">
        <div className="local-banner">
          この構成ではサーバーがないため、ここで作ったシミュレーションは<strong>このブラウザの中だけ</strong>に保存されます。
          公開するには、書き出した JSON をリポジトリに取り込んで再デプロイしてください。
        </div>
        {message && <div className="notice" style={{ marginBottom: 12 }}>{message}</div>}
        <div className="btn-row">
          <button className="btn btn-primary" onClick={async () => {
            const data = await localStore.exportOverlay();
            download('dynamis-content.json', JSON.stringify(data, null, 2), 'application/json');
            setMessage('書き出しました。リポジトリの content/ に置いて再ビルドすると公開されます。');
          }}>JSON で書き出す</button>

          <label className="btn" style={{ cursor: 'pointer' }}>
            読み込む
            <input
              type="file" accept="application/json" style={{ display: 'none' }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  await localStore.importOverlay(JSON.parse(await file.text()));
                  setMessage('読み込みました。再読み込みすると反映されます。');
                } catch (err) {
                  setMessage((err as Error).message);
                }
              }}
            />
          </label>

          <button className="btn btn-danger" onClick={() => {
            if (!window.confirm('このブラウザの編集内容をすべて消します。書き出していない変更は失われます。')) return;
            localStore.clearOverlay();
            setMessage('消去しました。再読み込みすると同梱の内容だけになります。');
          }}>編集内容を消す</button>
        </div>
      </div>
    </section>
  );
}
