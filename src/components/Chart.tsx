import { useEffect, useRef, type MutableRefObject } from 'react';
import type { GraphDefinition } from '../lib/types';
import type { SeriesBuffer } from '../sandbox/useSimulationRuntime';
import { TRACE_COLORS } from '../lib/format';

interface Props {
  definition: GraphDefinition;
  seriesRef: MutableRefObject<SeriesBuffer>;
}

/**
 * A small canvas plotter. Reading straight from the telemetry ref inside its own
 * animation frame keeps 60 Hz data off the React render path entirely.
 */
export function Chart({ definition, seriesRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let lastVersion = -1;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const buf = seriesRef.current;
      if (buf.version === lastVersion) return;
      lastVersion = buf.version;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const xs = buf.data[definition.x.key] || [];
      const traces = definition.y
        .map((y, i) => ({ ...y, values: buf.data[y.key] || [], color: y.color || TRACE_COLORS[i % TRACE_COLORS.length] }))
        .filter((t) => t.values.length > 1);
      if (!xs.length || !traces.length) {
        ctx.fillStyle = '#5f7383';
        ctx.font = '12px "IBM Plex Sans", sans-serif';
        ctx.fillText('データ待機中', 10, 20);
        return;
      }

      const pad = { l: 46, r: 10, t: 8, b: 20 };
      const n = Math.min(xs.length, ...traces.map((t) => t.values.length));
      const limit = definition.maxPoints || n;
      const start = Math.max(0, n - limit);

      let xmin = Infinity; let xmax = -Infinity; let ymin = Infinity; let ymax = -Infinity;
      for (let i = start; i < n; i++) {
        xmin = Math.min(xmin, xs[i]); xmax = Math.max(xmax, xs[i]);
        for (const t of traces) { ymin = Math.min(ymin, t.values[i]); ymax = Math.max(ymax, t.values[i]); }
      }
      if (!Number.isFinite(xmin) || xmax === xmin) xmax = xmin + 1;
      if (!Number.isFinite(ymin) || ymax === ymin) { ymax = ymin + 1; ymin -= 1; }
      const yPad = (ymax - ymin) * 0.08;
      ymin -= yPad; ymax += yPad;

      const X = (v: number) => pad.l + ((v - xmin) / (xmax - xmin)) * (w - pad.l - pad.r);
      const Y = (v: number) => h - pad.b - ((v - ymin) / (ymax - ymin)) * (h - pad.t - pad.b);

      // Grid and axis labels.
      ctx.strokeStyle = 'rgba(120,150,175,0.16)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.font = '10px "IBM Plex Mono", monospace';
      ctx.fillStyle = '#6e8496';
      for (let i = 0; i <= 4; i++) {
        const yv = ymin + ((ymax - ymin) * i) / 4;
        const py = Y(yv);
        ctx.moveTo(pad.l, py); ctx.lineTo(w - pad.r, py);
        const label = Math.abs(yv) >= 1e5 || (Math.abs(yv) < 1e-3 && yv !== 0) ? yv.toExponential(1) : yv.toFixed(2);
        ctx.fillText(label, 3, py + 3);
      }
      for (let i = 0; i <= 4; i++) {
        const xv = xmin + ((xmax - xmin) * i) / 4;
        const px = X(xv);
        ctx.moveTo(px, pad.t); ctx.lineTo(px, h - pad.b);
      }
      ctx.stroke();
      ctx.fillStyle = '#6e8496';
      ctx.fillText(xmin.toFixed(2), pad.l, h - 6);
      ctx.textAlign = 'right';
      ctx.fillText(xmax.toFixed(2), w - pad.r, h - 6);
      ctx.textAlign = 'left';

      // Traces.
      for (const t of traces) {
        ctx.strokeStyle = t.color;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        for (let i = start; i < n; i++) {
          const px = X(xs[i]); const py = Y(t.values[i]);
          i === start ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.stroke();
        if (definition.mode !== 'time') {
          ctx.fillStyle = t.color;
          ctx.beginPath(); ctx.arc(X(xs[n - 1]), Y(t.values[n - 1]), 3, 0, 2 * Math.PI); ctx.fill();
        }
      }
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [definition, seriesRef]);

  return <canvas ref={canvasRef} role="img" aria-label={`${definition.title} のグラフ`} />;
}
