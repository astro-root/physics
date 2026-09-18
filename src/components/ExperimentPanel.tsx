import { useEffect, useRef, useState } from 'react';
import type { ExperimentDefinition, Simulation } from '../lib/types';
import { runSandboxedCompute } from '../sandbox/useSimulationRuntime';
import { download, toCsv } from '../lib/format';

interface Props {
  simulation: Simulation;
  experiment: ExperimentDefinition;
  scalars: Record<string, number>;
}

interface AnalysisResult {
  error?: string;
  fit?: { slope: number; intercept: number; r2: number; slopeError: number };
  points?: [number, number][];
  result?: { label: string; value: number; uncertainty?: number; unit?: string };
  xLabel?: string;
  yLabel?: string;
}

export function ExperimentPanel({ simulation, experiment, scalars }: Props) {
  const [rows, setRows] = useState<Record<string, number | string>[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const record = () => {
    const row: Record<string, number | string> = {};
    for (const m of experiment.measurements) {
      row[m.key] = m.source === 'readout' && m.from ? Number(scalars[m.from] ?? 0) : '';
    }
    setRows((prev) => [...prev, row]);
    setMessage(null);
  };

  const update = (index: number, key: string, value: string) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [key]: value === '' ? '' : Number(value) } : r)));
  };

  const analyse = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await runSandboxedCompute(experiment.analysisCode, { rows });
      setAnalysis(result);
      if (result?.error) setMessage(result.error);
    } catch (err) {
      setMessage((err as Error).message);
      setAnalysis(null);
    } finally {
      setBusy(false);
    }
  };

  const exportRows = () => {
    const keys = experiment.measurements.map((m) => m.key);
    download(
      `${simulation.slug}-measurements.csv`,
      toCsv([keys, ...rows.map((r) => keys.map((k) => r[k] ?? ''))]),
      'text/csv;charset=utf-8',
    );
  };

  const theory = experiment.theory;
  const measured = analysis?.result?.value;
  const relError = theory && measured !== undefined && theory.value !== 0
    ? Math.abs((measured - theory.value) / theory.value) * 100
    : null;

  return (
    <section className="panel" style={{ marginTop: 16 }} aria-labelledby="experiment-head">
      <div className="panel-head">
        <h2 id="experiment-head">実験</h2>
        <div className="btn-row">
          <button className="btn btn-sm btn-primary" onClick={record}>現在の値を記録</button>
          <button className="btn btn-sm" onClick={() => { setRows([]); setAnalysis(null); }}>表を消去</button>
          <button className="btn btn-sm" onClick={exportRows} disabled={!rows.length}>CSV</button>
        </div>
      </div>
      <div className="panel-body grid" style={{ gap: 18 }}>
        <div>
          <h3>目的</h3>
          <p>{experiment.objective}</p>
        </div>

        {experiment.conditions.length > 0 && (
          <div>
            <h3>条件</h3>
            <ul>{experiment.conditions.map((c, i) => <li key={i}>{c}</li>)}</ul>
          </div>
        )}

        {experiment.procedure.length > 0 && (
          <div>
            <h3>手順</h3>
            <ol>{experiment.procedure.map((c, i) => <li key={i}>{c}</li>)}</ol>
          </div>
        )}

        <div>
          <h3>測定値</h3>
          {rows.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>
              条件を設定してシミュレーションを走らせ、「現在の値を記録」で 1 行ずつ表に取り込みます。
            </p>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  {experiment.measurements.map((m) => (
                    <th key={m.key} className="num">{m.label}{m.unit ? ` [${m.unit}]` : ''}</th>
                  ))}
                  <th style={{ width: 60 }} />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    <td className="mono">{i + 1}</td>
                    {experiment.measurements.map((m) => (
                      <td key={m.key} className="num">
                        <input
                          type="number" step="any" value={String(row[m.key] ?? '')}
                          aria-label={`${i + 1} 行目の ${m.label}`}
                          onChange={(e) => update(i, m.key, e.target.value)}
                          style={{ textAlign: 'right', padding: '3px 6px' }}
                        />
                      </td>
                    ))}
                    <td>
                      <button className="btn btn-sm" onClick={() => setRows((prev) => prev.filter((_, k) => k !== i))} aria-label={`${i + 1} 行目を削除`}>削除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="btn-row">
          <button className="btn btn-primary" onClick={analyse} disabled={busy || rows.length < 2}>
            {busy ? '解析中…' : '解析する'}
          </button>
        </div>

        {message && <div className="notice error" role="alert">{message}</div>}

        {analysis && !analysis.error && (
          <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,260px)', gap: 16 }}>
            <FitPlot analysis={analysis} />
            <div>
              <h3>結果</h3>
              {analysis.result && (
                <div className="readouts" style={{ gridTemplateColumns: '1fr' }}>
                  <div className="readout">
                    <div className="name">{analysis.result.label}（実験値）</div>
                    <div className="value">
                      {analysis.result.value.toFixed(5)}
                      {analysis.result.uncertainty !== undefined && Number.isFinite(analysis.result.uncertainty)
                        ? ` ± ${analysis.result.uncertainty.toFixed(5)}` : ''}
                      <span className="unit">{analysis.result.unit}</span>
                    </div>
                  </div>
                  {theory && (
                    <div className="readout">
                      <div className="name">{theory.label}（理論値）</div>
                      <div className="value">{theory.value}<span className="unit">{theory.unit}</span></div>
                    </div>
                  )}
                  {relError !== null && (
                    <div className="readout">
                      <div className="name">相対誤差</div>
                      <div className="value" style={{ color: relError < 2 ? 'var(--green)' : relError < 8 ? 'var(--amber)' : 'var(--rose)' }}>
                        {relError.toFixed(2)}<span className="unit">%</span>
                      </div>
                    </div>
                  )}
                  {analysis.fit && (
                    <div className="readout">
                      <div className="name">決定係数 r²</div>
                      <div className="value">{analysis.fit.r2.toFixed(5)}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/** Scatter of the analysed points with the fitted line drawn over it. */
function FitPlot({ analysis }: { analysis: AnalysisResult }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    const points = analysis.points || [];
    if (!canvas || points.length < 2) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = 240;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    const pad = { l: 52, r: 12, t: 12, b: 28 };
    const xmin = Math.min(...xs, 0);
    const xmax = Math.max(...xs) * 1.05;
    const ymin = Math.min(...ys, 0);
    const ymax = Math.max(...ys) * 1.05;
    const X = (v: number) => pad.l + ((v - xmin) / (xmax - xmin || 1)) * (w - pad.l - pad.r);
    const Y = (v: number) => h - pad.b - ((v - ymin) / (ymax - ymin || 1)) * (h - pad.t - pad.b);

    ctx.strokeStyle = 'rgba(120,150,175,0.18)';
    ctx.beginPath();
    for (let i = 0; i <= 4; i++) {
      const py = Y(ymin + ((ymax - ymin) * i) / 4);
      ctx.moveTo(pad.l, py); ctx.lineTo(w - pad.r, py);
    }
    ctx.stroke();

    if (analysis.fit) {
      ctx.strokeStyle = '#ffb454';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(X(xmin), Y(analysis.fit.intercept + analysis.fit.slope * xmin));
      ctx.lineTo(X(xmax), Y(analysis.fit.intercept + analysis.fit.slope * xmax));
      ctx.stroke();
    }
    ctx.fillStyle = '#5ac8fa';
    for (const [x, y] of points) {
      ctx.beginPath(); ctx.arc(X(x), Y(y), 4, 0, 2 * Math.PI); ctx.fill();
    }
    ctx.fillStyle = '#7d93a6';
    ctx.font = '11px "IBM Plex Mono", monospace';
    ctx.fillText(analysis.xLabel || 'x', w / 2, h - 8);
    ctx.save();
    ctx.translate(12, h / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText(analysis.yLabel || 'y', 0, 0);
    ctx.restore();
  }, [analysis]);

  return (
    <div className="chart-wrap">
      <div className="chart-title"><span>最小二乗フィット</span></div>
      <canvas ref={ref} style={{ height: 240 }} role="img" aria-label="測定点と最小二乗直線" />
    </div>
  );
}
