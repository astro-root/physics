import { useMemo, useState } from 'react';
import type { DisplayDefinition, Simulation } from '../lib/types';
import { useSimulationRuntime } from '../sandbox/useSimulationRuntime';
import { Chart } from './Chart';
import { formatValue, toCsv, download } from '../lib/format';
import { ExperimentPanel } from './ExperimentPanel';

interface Props {
  simulation: Simulation;
  /** Admin preview renders a slimmer frame without the description column. */
  compact?: boolean;
}

/**
 * The full instrument: stage, transport, parameters, readouts, graphs and
 * (for experiment-type content) the measurement table.
 */
export function SimulationWorkbench({ simulation, compact = false }: Props) {
  const rt = useSimulationRuntime(simulation);
  const [speed, setSpeed] = useState(1);
  const scalars = rt.frame?.scalars || {};

  const readouts: DisplayDefinition[] = simulation.displayDefinitions.length
    ? simulation.displayDefinitions
    : Object.keys(scalars).slice(0, 8).map((key) => ({ key, label: key }));

  const exportCsv = () => {
    const buf = rt.seriesRef.current;
    if (!buf.keys.length) return;
    const keys = buf.keys;
    const rows: (string | number)[][] = [keys];
    const len = Math.max(...keys.map((k) => buf.data[k].length));
    for (let i = 0; i < len; i++) rows.push(keys.map((k) => buf.data[k][i] ?? ''));
    download(`${simulation.slug}-data.csv`, toCsv(rows), 'text/csv;charset=utf-8');
  };

  const exportJson = () => {
    const buf = rt.seriesRef.current;
    download(
      `${simulation.slug}-data.json`,
      JSON.stringify(
        {
          simulation: simulation.slug,
          version: simulation.version,
          exportedAt: new Date().toISOString(),
          parameters: rt.params,
          readouts: scalars,
          series: buf.data,
        },
        null,
        2,
      ),
      'application/json',
    );
  };

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="two-col">
        <div>
          <div className="stage">
            <iframe
              ref={rt.frameRef}
              title={`${simulation.title} の実行画面`}
              srcDoc={rt.srcDoc}
              sandbox="allow-scripts"
            />
          </div>

          <div className="transport" role="group" aria-label="実行コントロール">
            <span className={`status-dot ${rt.error ? 'error' : rt.running ? 'running' : ''}`} aria-hidden="true" />
            <button className="btn btn-primary" onClick={rt.controls.toggle} aria-pressed={rt.running}>
              {rt.running ? '一時停止' : '実行'}
            </button>
            <button className="btn" onClick={() => rt.controls.step(60)}>1 ステップ進める</button>
            <button className="btn" onClick={rt.controls.reset}>最初から</button>
            <label className="mono" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem' }}>
              <span style={{ color: 'var(--muted)' }}>速度</span>
              <input
                type="range" min={0.1} max={5} step={0.1} value={speed}
                style={{ width: 110 }}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setSpeed(v);
                  rt.frameRef.current?.contentWindow?.postMessage({ type: 'speed', value: v * (simulation.runtimeOptions?.speed ?? 1) }, '*');
                }}
                aria-label="実行速度"
              />
              <span>{speed.toFixed(1)}×</span>
            </label>
          </div>

          {rt.error && (
            <div className="notice error" role="alert" style={{ marginBottom: 12 }}>
              シミュレーションが停止しました — {rt.error}
            </div>
          )}
          {rt.frame?.budgetExceeded && !rt.error && (
            <div className="notice" style={{ marginBottom: 12 }}>
              1 フレームの計算時間が上限に達しています。実時間より遅く進んでいます。
            </div>
          )}

          <section className="panel" aria-labelledby="readouts-head">
            <div className="panel-head">
              <h2 id="readouts-head">測定値</h2>
              <div className="btn-row">
                <button className="btn btn-sm" onClick={exportCsv}>CSV</button>
                <button className="btn btn-sm" onClick={exportJson}>JSON</button>
              </div>
            </div>
            <div className="panel-body" style={{ padding: 0 }}>
              <div className="readouts">
                {readouts.map((d) => (
                  <div className="readout" key={d.key}>
                    <div className="name">{d.label}</div>
                    <div className="value">
                      {formatValue(scalars[d.key], d as any)}
                      {'unit' in d && d.unit ? <span className="unit">{d.unit}</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {simulation.graphDefinitions.length > 0 && (
            <div className="grid" style={{ marginTop: 16, gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))' }}>
              {simulation.graphDefinitions.map((g) => (
                <div className="chart-wrap" key={g.id}>
                  <div className="chart-title">
                    <span>{g.title}</span>
                    <span className="legend">
                      {g.y.map((y, i) => (
                        <span key={y.key}>
                          <i style={{ background: y.color || ['#5ac8fa', '#ffb454', '#8ce99a', '#ff8fa3'][i % 4] }} />
                          {y.label}
                        </span>
                      ))}
                    </span>
                  </div>
                  <Chart definition={g} seriesRef={rt.seriesRef} />
                </div>
              ))}
            </div>
          )}

          {simulation.experiment && (
            <ExperimentPanel
              simulation={simulation}
              experiment={simulation.experiment}
              scalars={scalars}
            />
          )}
        </div>

        <aside>
          <section className="panel" aria-labelledby="params-head">
            <div className="panel-head">
              <h2 id="params-head">パラメータ</h2>
              <button className="btn btn-sm" onClick={rt.controls.restoreDefaults}>初期値に戻す</button>
            </div>
            <div className="panel-body">
              {simulation.parameterDefinitions.length === 0 && (
                <p style={{ color: 'var(--muted)', margin: 0 }}>このシミュレーションに調整できるパラメータはありません。</p>
              )}
              {simulation.parameterDefinitions.map((def) => {
                const value = rt.params[def.key];
                const id = `param-${def.key}`;
                return (
                  <div className="field" key={def.key}>
                    <label className="label" htmlFor={id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span>{def.label}</span>
                      {def.type !== 'boolean' && (
                        <span className="mono" style={{ color: 'var(--ink)' }}>
                          {typeof value === 'number' ? Number(value).toPrecision(5).replace(/\.?0+$/, '') : String(value)}
                          {def.unit ? <span className="unit"> {def.unit}</span> : null}
                        </span>
                      )}
                    </label>
                    {def.type === 'range' && (
                      <input
                        id={id} type="range"
                        min={def.min} max={def.max} step={def.step}
                        value={Number(value)}
                        onChange={(e) => rt.setParam(def.key, Number(e.target.value))}
                      />
                    )}
                    {def.type === 'number' && (
                      <input
                        id={id} type="number" step={def.step ?? 'any'} value={Number(value)}
                        onChange={(e) => rt.setParam(def.key, Number(e.target.value))}
                      />
                    )}
                    {def.type === 'select' && (
                      <select id={id} value={String(value)} onChange={(e) => {
                        const opt = def.options?.find((o) => String(o.value) === e.target.value);
                        rt.setParam(def.key, opt ? opt.value : e.target.value);
                      }}>
                        {def.options?.map((o) => (
                          <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
                        ))}
                      </select>
                    )}
                    {def.type === 'boolean' && (
                      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          id={id} type="checkbox" checked={Boolean(value)}
                          onChange={(e) => rt.setParam(def.key, e.target.checked)}
                        />
                        <span style={{ color: 'var(--ink-dim)', fontSize: '0.85rem' }}>{Boolean(value) ? '有効' : '無効'}</span>
                      </label>
                    )}
                    {def.help && <div className="hint">{def.help}</div>}
                    {def.restart && <div className="hint">変更すると計算を最初からやり直します</div>}
                  </div>
                );
              })}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
