/**
 * Builds the HTML document that runs author-supplied simulation code.
 *
 * Isolation model (see README → Security):
 *   - The document is loaded into an iframe with `sandbox="allow-scripts"` and no
 *     `allow-same-origin`, so it gets an opaque origin: no cookies, no storage,
 *     no access to the parent DOM, no credentialed requests.
 *   - Its CSP is `default-src 'none'` with scripts limited to the inline
 *     bootstrap and blob: workers. `'unsafe-eval'` is required in `script-src`
 *     because the whole execution model is `new Function('PL', code)` — that
 *     is how author-supplied simulation/renderer/compute code is turned into
 *     a callable function, in both this host document and the worker. Without
 *     it, every `new Function(...)` call is blocked by the browser (a CSP
 *     violation, not a JS error) and no simulation can ever initialize. This
 *     is safe here because `'unsafe-eval'` only lifts the eval restriction;
 *     it does not grant network access (`connect-src 'none'`), DOM access
 *     (opaque sandboxed origin, no `allow-same-origin`), or storage access.
 *     `connect-src 'none'` blocks fetch/XHR/WebSocket outright, so author code
 *     cannot call the API or any third party.
 *   - The physics step function runs in a Web Worker, one more hop away from the
 *     renderer and the canvas, and can be terminated at any time.
 *   - The parent only ever receives structured-clone data over postMessage and
 *     validates `event.source` before trusting a frame.
 */

import coreSource from '../lib/physics-core.js?raw';

/** The core is injected as text, so its ESM export statement has to go. */
const CORE_AS_EXPRESSION = `(function(){${coreSource.replace(/^export\s+default\s+PhysicsCore;?\s*$/m, '')}
return PhysicsCore;})()`;

const WORKER_RUNTIME = String.raw`
const PL = __CORE__;
self.PL = PL;

let model = null;
let params = {};
let state = null;
let t = 0;
let steps = 0;
let running = false;
let timer = null;
let speed = 1;
let dt = 1 / 600;
let maxSubsteps = 400;
let budgetMs = 20;          // hard cap on physics time per animation tick
let frameInterval = 16;
let lastError = null;

function fail(stage, err) {
  running = false;
  if (timer) { clearInterval(timer); timer = null; }
  lastError = String((err && err.stack) || err);
  post({ type: 'error', stage, message: String((err && err.message) || err) });
}

function post(msg) { self.postMessage(msg); }

function buildModel(code) {
  // Author code is a function body evaluated *inside the worker*, which lives in
  // an opaque origin with no network and no DOM. It receives only PL.
  const factory = new Function('PL', '"use strict";\n' + code);
  const m = factory(PL);
  if (!m || typeof m.init !== 'function' || typeof m.step !== 'function') {
    throw new Error('Simulation code must return an object with init() and step().');
  }
  return m;
}

function sample() {
  const out = (model.sample ? model.sample(state, params, t) : {}) || {};
  return {
    type: 'frame',
    t,
    steps,
    running,
    draw: out.draw === undefined ? state : out.draw,
    scalars: out.scalars || {},
    series: out.series || null,
    done: !!out.done,
  };
}

function reset(nextParams) {
  if (nextParams) params = nextParams;
  t = 0;
  steps = 0;
  state = model.init(params);
  post(sample());
}

/** True only for a finite JS number; recurses through plain objects/arrays
 *  so a NaN or Infinity buried inside "state" is still caught. Author state
 *  can be any shape, so this stays generic rather than assuming a schema. */
function isFiniteDeep(value, depth) {
  if (depth > 6) return true; // don't chase pathological structures forever
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every((v) => isFiniteDeep(v, depth + 1));
  if (value && typeof value === 'object') {
    return Object.values(value).every((v) => isFiniteDeep(v, depth + 1));
  }
  return true; // strings, booleans, null, undefined, functions: not our concern
}

function advance() {
  const start = Date.now();
  const target = (frameInterval / 1000) * speed;
  let simulated = 0;
  let n = 0;
  while (simulated < target && n < maxSubsteps) {
    const next = model.step(state, dt, params, t);
    if (next !== undefined && next !== null) state = next;
    t += dt;
    simulated += dt;
    steps++;
    n++;
    if ((n & 31) === 0 && Date.now() - start > budgetMs) break;
    if ((n & 63) === 0 && !isFiniteDeep(state, 0)) {
      throw new Error('Simulation state became non-finite (NaN/Infinity) -- likely a numerically unstable step at these parameter values.');
    }
  }
  if (!isFiniteDeep(state, 0)) {
    throw new Error('Simulation state became non-finite (NaN/Infinity) -- likely a numerically unstable step at these parameter values.');
  }
  const frame = sample();
  frame.budgetExceeded = Date.now() - start > budgetMs;
  // Report "done" as no-longer-running *in the same frame that announces it*,
  // rather than flipping "running" only after sample() has already captured
  // the old value. Otherwise the frame that says done:true also (incorrectly)
  // says running:true, and the host's hang-watchdog treats "no more frames
  // after this one" -- which is the correct behaviour once a run finishes --
  // as a hang, and kills the worker.
  if (frame.done) {
    running = false;
    frame.running = false;
    if (timer) { clearInterval(timer); timer = null; }
  }
  post(frame);
}

function startLoop() {
  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    if (!running) return;
    try { advance(); } catch (err) { fail('step', err); }
  }, frameInterval);
}

self.onmessage = (event) => {
  const msg = event.data || {};
  try {
    switch (msg.type) {
      case 'init': {
        params = msg.params || {};
        dt = msg.options && msg.options.dt ? msg.options.dt : 1 / 600;
        maxSubsteps = (msg.options && msg.options.maxSubsteps) || 400;
        speed = (msg.options && msg.options.speed) || 1;
        model = buildModel(msg.code);
        reset(params);
        post({ type: 'ready', meta: model.meta || null });
        break;
      }
      case 'params': {
        params = Object.assign({}, params, msg.values);
        if (msg.hard) {
          reset(params);
        } else {
          // A "soft" (non-restart) parameter change should not restart the
          // run from t=0: only "restart"-flagged parameters ask for that
          // (see setParam in useSimulationRuntime.ts). Previously this branch
          // only avoided the reset when the simulation itself implemented
          // onParams -- but none of the shipped simulations do, so in
          // practice *every* slider drag silently reset every run to t=0.
          // Swap the params in place and let the model react to them on the
          // next step() call; call onParams() too when a simulation does
          // provide it, so it can react immediately rather than next tick.
          if (model.onParams) model.onParams(state, params);
          post(sample());
        }
        break;
      }
      case 'run': running = true; startLoop(); break;
      case 'pause': running = false; post(sample()); break;
      case 'reset': running = false; reset(msg.params); break;
      case 'step': {
        running = false;
        const n = msg.count || 1;
        for (let i = 0; i < n; i++) {
          const next = model.step(state, dt, params, t);
          if (next !== undefined && next !== null) state = next;
          t += dt; steps++;
        }
        post(sample());
        break;
      }
      case 'speed': speed = msg.value; break;
      case 'compute': {
        // One-shot evaluation used by calculators and experiment analysis.
        const fn = new Function('PL', 'input', '"use strict";\n' + msg.code);
        post({ type: 'computed', id: msg.id, result: fn(PL, msg.input) });
        break;
      }
      default: break;
    }
  } catch (err) {
    fail(msg.type || 'unknown', err);
  }
};
`;

const HOST_SCRIPT = String.raw`
const PL = __CORE__;
const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
let renderer = null;
let worker = null;
let latest = null;
let dirty = false;
let dpr = 1;
let cssW = 0;
let cssH = 0;
let watchdog = null;

function toParent(msg) { parent.postMessage(msg, '*'); }

function sizeCanvas() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  cssW = canvas.clientWidth || 640;
  cssH = canvas.clientHeight || 400;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  dirty = true;
}

const theme = {
  bg: 'transparent',
  grid: 'rgba(120,150,175,0.16)',
  gridStrong: 'rgba(120,150,175,0.34)',
  ink: '#dbe6f0',
  muted: '#7d93a6',
  trace: ['#5ac8fa', '#ffb454', '#8ce99a', '#ff8fa3', '#c0a6ff', '#4ad9c0'],
  accent: '#5ac8fa',
};

function makeHelpers() {
  const h = {
    w: cssW, h: cssH, dpr, PL, theme,
    clear(color) {
      ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
      if (color) { ctx.fillStyle = color; ctx.fillRect(0, 0, cssW, cssH); }
      ctx.restore();
    },
    /** Map world coordinates to canvas pixels, preserving aspect ratio. */
    view(bounds, opts) {
      const pad = (opts && opts.pad) || 8;
      const flipY = !opts || opts.flipY !== false;
      const sx = (cssW - 2 * pad) / (bounds.xmax - bounds.xmin);
      const sy = (cssH - 2 * pad) / (bounds.ymax - bounds.ymin);
      const s = (opts && opts.stretch) ? null : Math.min(sx, sy);
      const scaleX = s === null ? sx : s;
      const scaleY = s === null ? sy : s;
      const ox = pad + (cssW - 2 * pad - scaleX * (bounds.xmax - bounds.xmin)) / 2;
      const oy = pad + (cssH - 2 * pad - scaleY * (bounds.ymax - bounds.ymin)) / 2;
      return {
        scaleX, scaleY,
        x: (x) => ox + (x - bounds.xmin) * scaleX,
        y: (y) => flipY ? cssH - oy - (y - bounds.ymin) * scaleY : oy + (y - bounds.ymin) * scaleY,
        len: (l) => l * scaleX,
        bounds,
      };
    },
    grid(view, stepX, stepY) {
      const b = view.bounds;
      ctx.save();
      ctx.lineWidth = 1;
      ctx.strokeStyle = theme.grid;
      ctx.beginPath();
      const sx = stepX || (b.xmax - b.xmin) / 10;
      const sy = stepY || sx;
      for (let x = Math.ceil(b.xmin / sx) * sx; x <= b.xmax; x += sx) {
        ctx.moveTo(view.x(x), view.y(b.ymin)); ctx.lineTo(view.x(x), view.y(b.ymax));
      }
      for (let y = Math.ceil(b.ymin / sy) * sy; y <= b.ymax; y += sy) {
        ctx.moveTo(view.x(b.xmin), view.y(y)); ctx.lineTo(view.x(b.xmax), view.y(y));
      }
      ctx.stroke();
      ctx.restore();
    },
    axes(view) {
      const b = view.bounds;
      ctx.save();
      ctx.strokeStyle = theme.gridStrong;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      if (b.ymin <= 0 && b.ymax >= 0) { ctx.moveTo(view.x(b.xmin), view.y(0)); ctx.lineTo(view.x(b.xmax), view.y(0)); }
      if (b.xmin <= 0 && b.xmax >= 0) { ctx.moveTo(view.x(0), view.y(b.ymin)); ctx.lineTo(view.x(0), view.y(b.ymax)); }
      ctx.stroke();
      ctx.restore();
    },
    arrow(x0, y0, x1, y1, size) {
      const a = Math.atan2(y1 - y0, x1 - x0);
      const s = size || 7;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - s * Math.cos(a - 0.4), y1 - s * Math.sin(a - 0.4));
      ctx.lineTo(x1 - s * Math.cos(a + 0.4), y1 - s * Math.sin(a + 0.4));
      ctx.closePath(); ctx.fill();
    },
    label(text, x, y, opts) {
      const o = opts || {};
      ctx.save();
      ctx.font = (o.font || '12px "IBM Plex Mono", ui-monospace, monospace');
      ctx.fillStyle = o.color || theme.muted;
      ctx.textAlign = o.align || 'left';
      ctx.textBaseline = o.baseline || 'alphabetic';
      ctx.fillText(text, x, y);
      ctx.restore();
    },
    /** Orthographic 3D projection with yaw/pitch, for the 3D-flavoured sims. */
    project3D(p, opts) {
      const o = opts || {};
      const yaw = o.yaw === undefined ? 0.6 : o.yaw;
      const pitch = o.pitch === undefined ? 0.35 : o.pitch;
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      const cp = Math.cos(pitch), sp = Math.sin(pitch);
      const x1 = p[0] * cy + p[2] * sy;
      const z1 = -p[0] * sy + p[2] * cy;
      const y1 = p[1] * cp - z1 * sp;
      const depth = p[1] * sp + z1 * cp;
      return [x1, y1, depth];
    },
    colorFor(i) { return theme.trace[i % theme.trace.length]; },
  };
  return h;
}

function render() {
  if (!renderer || !latest) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const helpers = makeHelpers();
  try {
    helpers.clear();
    renderer(ctx, latest, latest.params || {}, helpers);
  } catch (err) {
    toParent({ type: 'error', stage: 'render', message: String(err && err.message || err) });
    renderer = null;
  }
}

function tick() {
  if (dirty) { dirty = false; render(); }
  requestAnimationFrame(tick);
}

function startWorker(code, params, options) {
  if (worker) worker.terminate();
  const blob = new Blob([__WORKER_SOURCE__], { type: 'text/javascript' });
  worker = new Worker(URL.createObjectURL(blob));
  worker.onmessage = (event) => {
    const msg = event.data;
    if (msg.type === 'frame') {
      latest = msg;
      latest.params = currentParams;
      dirty = true;
      // Only arm the hang-watchdog while the simulation is actually expected
      // to keep producing frames. A paused or naturally-finished simulation
      // sends one last frame with running:false and then, correctly, sends
      // nothing further -- that is not a hang. Re-arming unconditionally here
      // used to fire a bogus "stopped responding" error a few seconds after
      // every pause/finish and permanently terminate the worker, so no
      // subsequent "run" press could ever do anything again.
      clearTimeout(watchdog);
      if (msg.running) {
        watchdog = setTimeout(() => {
          toParent({ type: 'error', stage: 'watchdog', message: 'Simulation stopped responding and was terminated.' });
          if (worker) { worker.terminate(); worker = null; }
        }, 5000);
      }
      // The parent only ever reads t/steps/scalars/series/running/done/
      // budgetExceeded (see useSimulationRuntime.ts) -- never "draw", which
      // is this frame's full render payload and, for data-heavy simulations,
      // can be hundreds of KB to over a MB per frame. Forwarding it to the
      // parent structured-clones that payload a second time for no reason,
      // every frame, at up to 60 fps. Strip it before relaying.
      if (msg.draw !== undefined) {
        const { draw: _draw, ...rest } = msg;
        toParent(rest);
        return;
      }
    }
    toParent(msg);
  };
  worker.onerror = (e) => toParent({ type: 'error', stage: 'worker', message: e.message || 'Worker failed to start.' });
  worker.postMessage({ type: 'init', code, params, options });
}

let currentParams = {};

window.addEventListener('message', (event) => {
  if (event.source !== parent) return;
  const msg = event.data || {};
  switch (msg.type) {
    case 'load':
      currentParams = msg.params || {};
      try {
        renderer = msg.rendererCode
          ? new Function('ctx', 'frame', 'params', 'helpers', '"use strict";\n' + msg.rendererCode)
          : null;
      } catch (err) {
        toParent({ type: 'error', stage: 'renderer-compile', message: String(err && err.message || err) });
        renderer = null;
      }
      startWorker(msg.code, currentParams, msg.options || {});
      break;
    case 'params':
      currentParams = Object.assign({}, currentParams, msg.values);
      if (worker) worker.postMessage(msg);
      break;
    case 'resize': sizeCanvas(); break;
    case 'dispose':
      if (worker) { worker.terminate(); worker = null; }
      clearTimeout(watchdog);
      break;
    case 'compute':
      if (!worker) startWorker('return { init(){return {}}, step(){} };', {}, {});
      worker.postMessage(msg);
      break;
    default:
      if (worker) worker.postMessage(msg);
      if (msg.type === 'pause' || msg.type === 'reset') clearTimeout(watchdog);
  }
});

window.addEventListener('resize', sizeCanvas);
canvas.addEventListener('pointermove', (e) => {
  const r = canvas.getBoundingClientRect();
  if (worker) worker.postMessage({ type: 'pointer', x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height, down: e.buttons > 0 });
  dirty = true;
});
canvas.addEventListener('pointerdown', (e) => {
  const r = canvas.getBoundingClientRect();
  if (worker) worker.postMessage({ type: 'pointer', x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height, down: true });
});

sizeCanvas();
requestAnimationFrame(tick);
toParent({ type: 'host-ready' });
`;

export function buildSandboxDocument(): string {
  const workerSource = WORKER_RUNTIME.replace('__CORE__', CORE_AS_EXPRESSION);
  const host = HOST_SCRIPT.replace('__CORE__', CORE_AS_EXPRESSION).replace(
    '__WORKER_SOURCE__',
    JSON.stringify(workerSource),
  );
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob:; worker-src blob:; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'">
<style>
  html,body { margin:0; height:100%; background:transparent; overflow:hidden; }
  #stage { display:block; width:100%; height:100%; touch-action:none; }
</style>
</head>
<body>
<canvas id="stage"></canvas>
<script>${host}<\/script>
</body>
</html>`;
}

export type SandboxMessage =
  | { type: 'host-ready' }
  | { type: 'ready'; meta: unknown }
  | {
      type: 'frame';
      t: number;
      steps: number;
      running: boolean;
      draw: unknown;
      scalars: Record<string, number>;
      series: Record<string, number> | null;
      done: boolean;
      budgetExceeded?: boolean;
    }
  | { type: 'computed'; id: string; result: unknown }
  | { type: 'error'; stage: string; message: string };
