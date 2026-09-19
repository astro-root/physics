import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import type { Simulation } from '../lib/types';
import { TYPE_LABELS, LEVEL_LABELS } from '../lib/types';
import { SimulationWorkbench } from '../components/SimulationWorkbench';
import { useAuth } from '../lib/auth';

export function SimulationPage() {
  const { slug = '' } = useParams();
  const { isAdmin } = useAuth();
  const [sim, setSim] = useState<Simulation | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSim(null);
    setError(null);
    api.simulation(slug).then(setSim).catch((err) => setError(err.message));
  }, [slug]);

  if (error) {
    return (
      <div className="empty">
        <p>{error}</p>
        <Link to="/catalog">カタログに戻る</Link>
      </div>
    );
  }
  if (!sim) return <div className="empty">読み込んでいます…</div>;

  return (
    <article className="grid" style={{ gap: 18 }}>
      <header>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
          <span className="pill">{TYPE_LABELS[sim.type]}</span>
          <span className="pill">{LEVEL_LABELS[sim.targetLevel]}</span>
          {sim.status !== 'published' && <span className={`pill pill-${sim.status}`}>{sim.status}</span>}
          {isAdmin && <Link className="btn btn-sm" to={`/admin/simulations/${sim.id}`}>編集</Link>}
        </div>
        <h1>{sim.title}</h1>
        {sim.titleEn && <p className="mono" style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{sim.titleEn}</p>}
        <p style={{ color: 'var(--ink-dim)' }}>{sim.shortDescription}</p>
        <div className="tag-row">
          {sim.tags.map((t) => (
            <Link className="tag" key={t.slug} to={`/catalog?tags=${t.slug}`}>{t.name}</Link>
          ))}
        </div>
      </header>

      <SimulationWorkbench simulation={sim} />

      <section className="panel">
        <div className="panel-head"><h2>解説</h2></div>
        <div className="panel-body">
          {sim.description.split('\n\n').map((para, i) => (
            <p key={i} style={{ whiteSpace: 'pre-wrap' }}>{para}</p>
          ))}
          {sim.formulas.length > 0 && (
            <>
              <h3>式</h3>
              <ul className="mono" style={{ listStyle: 'none', padding: 0 }}>
                {sim.formulas.map((f, i) => (
                  <li key={i} style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                    {f.text}
                    {f.note && <span style={{ color: 'var(--muted)', fontFamily: 'var(--sans)', marginLeft: 10 }}>{f.note}</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
          {sim.physicsTopics.length > 0 && (
            <p style={{ color: 'var(--muted)', fontSize: '0.86rem' }}>
              扱う内容：{sim.physicsTopics.join('・')}
            </p>
          )}
          <p style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>
            バージョン {sim.version} ・ 作成 {sim.author}
          </p>
        </div>
      </section>
    </article>
  );
}
