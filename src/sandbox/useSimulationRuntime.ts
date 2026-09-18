import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildSandboxDocument } from './sandbox-doc';
import type { ParameterDefinition, Simulation } from '../lib/types';

export interface SeriesBuffer {
  keys: string[];
  data: Record<string, number[]>;
  length: number;
  version: number;
}

export interface Frame {
  t: number;
  steps: number;
  scalars: Record<string, number>;
  running: boolean;
  budgetExceeded?: boolean;
}

const MAX_POINTS = 6000;

export function defaultParams(defs: ParameterDefinition[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const d of defs) out[d.key] = d.default;
  return out;
}

/**
 * Owns one sandboxed simulation. The heavy telemetry (graph series) is kept in
 * refs so that 60 Hz frames do not trigger 60 React renders a second; only the
 * readout snapshot is pushed into state, and only ~12 times a second.
 */
export function useSimulationRuntime(sim: Simulation | null) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const seriesRef = useRef<SeriesBuffer>({ keys: [], data: {}, length: 0, version: 0 });
  const latestRef = useRef<Frame | null>(null);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [running, setRunning] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useState<Record<string, unknown>>(() =>
    sim ? defaultParams(sim.parameterDefinitions) : {},
  );

  const srcDoc = useMemo(() => buildSandboxDocument(), []);

  const post = useCallback((message: unknown) => {
    frameRef.current?.contentWindow?.postMessage(message, '*');
  }, []);

  const resetSeries = useCallback(() => {
    seriesRef.current = { keys: [], data: {}, length: 0, version: seriesRef.current.version + 1 };
  }, []);

  // Load (or reload) the model whenever the simulation changes.
  const load = useCallback(
    (nextParams?: Record<string, unknown>) => {
      if (!sim) return;
      setError(null);
      setReady(false);
      resetSeries();
      post({
        type: 'load',
        code: sim.simulationCode,
        rendererCode: sim.rendererCode,
        params: nextParams ?? params,
        options: sim.runtimeOptions || {},
      });
    },
    [sim, params, post, resetSeries],
  );

  useEffect(() => {
    if (!sim) return;
    const next = defaultParams(sim.parameterDefinitions);
    setParams(next);
    setRunning(false);
    const timer = window.setTimeout(() => {
      post({
        type: 'load',
        code: sim.simulationCode,
        rendererCode: sim.rendererCode,
        params: next,
        options: sim.runtimeOptions || {},
      });
    }, 60);
    return () => window.clearTimeout(timer);
    // Reloading on slug/version is what we want: editing code in admin bumps version.
  }, [sim?.slug, sim?.version, sim?.simulationCode, sim?.rendererCode, post]);

  // Receive telemetry.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!frameRef.current || event.source !== frameRef.current.contentWindow) return;
      const msg = event.data || {};
      switch (msg.type) {
        case 'ready':
          setReady(true);
          setError(null);
          break;
        case 'frame': {
          latestRef.current = {
            t: msg.t, steps: msg.steps, scalars: msg.scalars || {},
            running: msg.running, budgetExceeded: msg.budgetExceeded,
          };
          if (msg.series) {
            const buf = seriesRef.current;
            for (const [key, value] of Object.entries(msg.series as Record<string, number>)) {
              if (typeof value !== 'number' || !Number.isFinite(value)) continue;
              if (!buf.data[key]) { buf.data[key] = []; buf.keys.push(key); }
              const arr = buf.data[key];
              arr.push(value);
              if (arr.length > MAX_POINTS) arr.shift();
            }
            buf.length = Math.max(...Object.values(buf.data).map((a) => a.length), 0);
            buf.version++;
          }
          if (msg.done) setRunning(false);
          break;
        }
        case 'error':
          setError(`${msg.stage}: ${msg.message}`);
          setRunning(false);
          break;
        default:
          break;
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Throttled readout updates.
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      if (now - last > 80 && latestRef.current) {
        last = now;
        setFrame({ ...latestRef.current });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => () => post({ type: 'dispose' }), [post]);

  const setParam = useCallback(
    (key: string, value: unknown) => {
      setParams((prev) => {
        const next = { ...prev, [key]: value };
        const def = sim?.parameterDefinitions.find((d) => d.key === key);
        if (def?.restart) {
          resetSeries();
          post({ type: 'params', values: next, hard: true });
        } else {
          post({ type: 'params', values: next });
        }
        return next;
      });
    },
    [post, sim, resetSeries],
  );

  const controls = useMemo(
    () => ({
      run: () => { setRunning(true); post({ type: 'run' }); },
      pause: () => { setRunning(false); post({ type: 'pause' }); },
      toggle: () => {
        setRunning((was) => { post({ type: was ? 'pause' : 'run' }); return !was; });
      },
      reset: () => {
        setRunning(false);
        resetSeries();
        post({ type: 'reset', params });
      },
      step: (count = 30) => { setRunning(false); post({ type: 'step', count }); },
      restoreDefaults: () => {
        if (!sim) return;
        const next = defaultParams(sim.parameterDefinitions);
        setParams(next);
        resetSeries();
        post({ type: 'params', values: next, hard: true });
      },
    }),
    [post, params, resetSeries, sim],
  );

  return { frameRef, srcDoc, params, setParam, setParams, frame, running, ready, error, controls, seriesRef, reload: load };
}

/**
 * One-shot evaluation inside the same sandbox (used by experiment analysis).
 * Spins up a hidden iframe, runs the snippet, and tears it down. A timeout
 * guarantees the promise settles even if the snippet loops forever.
 */
export function runSandboxedCompute(code: string, input: unknown, timeoutMs = 4000): Promise<any> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.style.cssText = 'position:absolute;width:0;height:0;border:0;visibility:hidden';
    iframe.srcdoc = buildSandboxDocument();
    const id = Math.random().toString(36).slice(2);

    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      window.clearTimeout(timer);
      iframe.remove();
    };
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error('解析コードが時間内に終わりませんでした。'));
    }, timeoutMs);

    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) return;
      const msg = event.data || {};
      if (msg.type === 'host-ready') {
        iframe.contentWindow?.postMessage({ type: 'compute', id, code, input }, '*');
      } else if (msg.type === 'computed' && msg.id === id) {
        cleanup();
        resolve(msg.result);
      } else if (msg.type === 'error') {
        cleanup();
        reject(new Error(msg.message));
      }
    };

    window.addEventListener('message', onMessage);
    document.body.appendChild(iframe);
  });
}
