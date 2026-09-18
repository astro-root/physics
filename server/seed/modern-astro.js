import { sim, range, toggle, choice, read, timeGraph, xyGraph } from './common.js';

export const modernAstro = [
  sim({
    slug: 'lorenz-attractor',
    title: 'ローレンツ・アトラクタ',
    titleEn: 'Lorenz attractor',
    category: 'chaos',
    shortDescription: '対流を単純化した3変数系。決定論的なのに予測できない軌道を描きます。',
    description:
      'ローレンツ方程式を RK4 で積分します。初期値をわずかにずらした二本目の軌道（橙）を並べると、' +
      'しばらく重なったあと突然分岐し、どちらの翼にいるかが完全に食い違います。\n\n' +
      'ρ を 1 から上げていくと、固定点 → 周期解 → カオスと振る舞いが変わります。ρ = 28 が古典的なカオス領域です。',
    physicsTopics: ['カオス', 'ストレンジアトラクタ', '初期値鋭敏性', '非線形系'],
    formulas: [
      { text: 'ẋ = σ(y − x)' },
      { text: 'ẏ = x(ρ − z) − y' },
      { text: 'ż = xy − βz' },
    ],
    tags: ['chaos', 'nonlinear', '3d', 'numerical-simulation', 'university-physics'],
    difficulty: 4,
    targetLevel: 'undergraduate',
    parameterDefinitions: [
      range('sigma', 'σ', 10, 0.5, 30, 0.1, { unit: '' }),
      range('rho', 'ρ', 28, 0.5, 60, 0.1, { unit: '' }),
      range('beta', 'β', 2.667, 0.1, 6, 0.005, { unit: '' }),
      toggle('twin', '摂動した軌道を並べる', true, { restart: true }),
      range('yaw', '視点の回転', 0.7, -3.14, 3.14, 0.02, { unit: 'rad' }),
      range('pitch', '視点の傾き', 0.3, -1.4, 1.4, 0.02, { unit: 'rad' }),
    ],
    displayDefinitions: [
      read('t', '時間', '', 2),
      read('x', 'x', '', 4),
      read('y', 'y', '', 4),
      read('z', 'z', '', 4),
      read('separation', '双子との距離', '', 6),
      read('lyapunov', '分離の指数増加率（目安）', '', 4),
    ],
    graphDefinitions: [
      xyGraph('xz', 'x–z 断面', { key: 'x', label: 'x', unit: '' }, [{ key: 'z', label: 'z', color: '#5ac8fa' }]),
      timeGraph('x-t', 'x の時間変化', [{ key: 'x', label: 'x', color: '#5ac8fa' }]),
      timeGraph('sep', '双子との距離', [{ key: 'separation', label: 'd', color: '#ff8fa3' }]),
    ],
    runtimeOptions: { dt: 1 / 4000, speed: 1 },
    simulationCode: `
return {
  meta: { integrator: 'RK4' },
  init(p) {
    const y0 = [1, 1, 20];
    return { y: y0.slice(), twin: [1 + 1e-6, 1, 20], trail: [], trailTwin: [] };
  },
  step(s, dt, p) {
    const f = (t, y) => [
      p.sigma * (y[1] - y[0]),
      y[0] * (p.rho - y[2]) - y[1],
      y[0] * y[1] - p.beta * y[2],
    ];
    s.y = PL.rk4(f, 0, s.y, dt);
    if (p.twin) s.twin = PL.rk4(f, 0, s.twin, dt);
    return s;
  },
  sample(s, p, t) {
    s.trail.push(s.y.slice()); if (s.trail.length > 4000) s.trail.shift();
    if (p.twin) { s.trailTwin.push(s.twin.slice()); if (s.trailTwin.length > 4000) s.trailTwin.shift(); }
    const sep = PL.vec.dist(s.y, s.twin);
    const scalars = {
      t, x: s.y[0], y: s.y[1], z: s.y[2],
      separation: p.twin ? sep : 0,
      lyapunov: t > 0.5 && sep > 0 ? Math.log(sep / 1e-6) / t : 0,
    };
    return { draw: { trail: s.trail, trailTwin: s.trailTwin, head: s.y, twin: p.twin, yaw: p.yaw, pitch: p.pitch }, scalars, series: scalars };
  },
};`,
    rendererCode: `
const d = frame.draw;
const view = helpers.view({ xmin: -32, xmax: 32, ymin: -32, ymax: 32 }, { pad: 8 });
const opts = { yaw: d.yaw, pitch: d.pitch };
const P = (q) => { const r = helpers.project3D([q[0], q[2] - 27, q[1]], opts); return [view.x(r[0]), view.y(r[1]), r[2]]; };
const line = (trail, base) => {
  for (let i = 1; i < trail.length; i++) {
    const a = P(trail[i - 1]), b = P(trail[i]);
    const f = i / trail.length;
    ctx.strokeStyle = base.replace('ALPHA', (0.05 + 0.75 * f).toFixed(3));
    ctx.lineWidth = 0.6 + 1.4 * f;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }
};
line(d.trail, 'rgba(90,200,250,ALPHA)');
if (d.twin) line(d.trailTwin, 'rgba(255,180,84,ALPHA)');
const h = P(d.head);
ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(h[0], h[1], 3.5, 0, 2 * Math.PI); ctx.fill();`,
  }),

  sim({
    slug: 'logistic-map-bifurcation',
    title: 'ロジスティック写像と分岐図',
    titleEn: 'Logistic map and bifurcation diagram',
    category: 'chaos',
    type: 'model',
    shortDescription: '周期倍化からカオスへ。ファイゲンバウム定数を数値的に確かめます。',
    description:
      'x_{n+1} = r x_n (1 − x_n) を r を掃引しながら反復し、過渡を捨てたあとの到達点を打点して分岐図を描きます。' +
      'r ≈ 3 で 2 周期、3.449 で 4 周期、3.544 で 8 周期…と周期倍化が続き、r ≈ 3.5699 でカオスに入ります。\n\n' +
      '分岐点の間隔比は普遍定数 δ ≈ 4.669（ファイゲンバウム定数）に収束します。拡大範囲を狭めると自己相似構造が見えます。',
    physicsTopics: ['ロジスティック写像', '周期倍化', '分岐', 'カオス', '普遍性'],
    formulas: [
      { text: 'x_{n+1} = r x_n (1 − x_n)' },
      { text: 'δ = lim (r_n − r_{n−1}) / (r_{n+1} − r_n) ≈ 4.6692' },
    ],
    tags: ['chaos', 'nonlinear', 'bifurcation', 'model', 'university-physics'],
    difficulty: 3,
    targetLevel: 'undergraduate',
    parameterDefinitions: [
      range('rMin', 'r の下限', 2.5, 0, 3.9, 0.001, { unit: '', restart: true }),
      range('rMax', 'r の上限', 4, 2.5, 4, 0.001, { unit: '', restart: true }),
      range('transient', '捨てる反復回数', 400, 50, 3000, 50, { unit: '回', restart: true }),
      range('keep', '打点する回数', 160, 20, 600, 10, { unit: '回', restart: true }),
      range('probeR', '時系列を見る r', 3.7, 0, 4, 0.001, { unit: '' }),
    ],
    displayDefinitions: [
      read('progress', '掃引の進捗', '%', 1),
      read('probeR', '時系列の r', '', 4),
      read('probeValue', 'x_n', '', 5),
      read('estimatedPeriod', '検出した周期', '', 0),
      read('lyapunov', 'リアプノフ指数', '', 4),
    ],
    graphDefinitions: [
      timeGraph('series', '時系列 x_n', [{ key: 'probeValue', label: 'x_n', color: '#ffb454' }], { maxPoints: 600 }),
    ],
    runtimeOptions: { dt: 1 / 120, maxSubsteps: 12 },
    simulationCode: `
return {
  meta: { kind: 'iterated map' },
  init(p) {
    return { col: 0, cols: 720, points: [], probe: 0.4, lyap: 0, n: 0, recent: [] };
  },
  step(s, dt, p) {
    // Advance the bifurcation sweep a few columns per frame.
    for (let c = 0; c < 4 && s.col < s.cols; c++, s.col++) {
      const r = p.rMin + ((p.rMax - p.rMin) * s.col) / (s.cols - 1);
      let x = 0.5;
      for (let i = 0; i < p.transient; i++) x = r * x * (1 - x);
      const col = [];
      for (let i = 0; i < p.keep; i++) { x = r * x * (1 - x); col.push(x); }
      s.points.push([r, col]);
    }
    // Probe series and running Lyapunov exponent.
    s.probe = p.probeR * s.probe * (1 - s.probe);
    s.lyap = (s.lyap * s.n + Math.log(Math.abs(p.probeR * (1 - 2 * s.probe)))) / (s.n + 1);
    s.n++;
    s.recent.push(s.probe); if (s.recent.length > 64) s.recent.shift();
    return s;
  },
  sample(s, p, t) {
    // Detect period by looking for a repeat within tolerance.
    let period = 0;
    const r = s.recent;
    for (let k = 1; k <= 16 && !period; k++) {
      if (r.length > 2 * k && Math.abs(r[r.length - 1] - r[r.length - 1 - k]) < 1e-6) period = k;
    }
    return {
      draw: { points: s.points, rMin: p.rMin, rMax: p.rMax, probeR: p.probeR },
      scalars: {
        progress: (100 * s.col) / s.cols, probeR: p.probeR, probeValue: s.probe,
        estimatedPeriod: period, lyapunov: s.lyap, t,
      },
      series: { t, probeValue: s.probe },
      done: s.col >= s.cols && s.n > 4000,
    };
  },
};`,
    rendererCode: `
const d = frame.draw;
const view = helpers.view({ xmin: d.rMin, xmax: d.rMax, ymin: 0, ymax: 1 }, { stretch: true, pad: 26 });
helpers.grid(view, (d.rMax - d.rMin) / 6, 0.2);
ctx.fillStyle = 'rgba(90,200,250,0.5)';
for (const [r, col] of d.points) {
  const px = view.x(r);
  for (const x of col) ctx.fillRect(px, view.y(x), 1, 1);
}
ctx.strokeStyle = '#ffb454'; ctx.lineWidth = 1.2;
ctx.beginPath(); ctx.moveTo(view.x(d.probeR), view.y(0)); ctx.lineTo(view.x(d.probeR), view.y(1)); ctx.stroke();
helpers.label('r', helpers.w / 2, helpers.h - 6, { align: 'center' });
helpers.label('x', 8, 16);`,
  }),

  sim({
    slug: 'time-dilation-light-clock',
    title: '光時計と時間の遅れ',
    titleEn: 'Light clock and time dilation',
    category: 'relativity',
    shortDescription: '動く光時計を静止系から見ると、光路が伸びた分だけ時間がゆっくり進みます。',
    description:
      '二枚の鏡の間を光が往復する「光時計」を、静止系と運動系の二つ並べて動かします。' +
      '光速はどちらの系でも同じなので、斜めに長くなった光路の分だけ動く時計は遅れます。\n\n' +
      '刻んだ回数の比がそのままローレンツ因子 γ = 1/√(1−β²) になり、β = 0.87 で約 2 倍、β = 0.99 で約 7 倍の差が出ます。',
    physicsTopics: ['時間の遅れ', 'ローレンツ因子', '光速不変', '特殊相対論'],
    formulas: [
      { text: 'γ = 1 / √(1 − v²/c²)' },
      { text: "Δt = γ Δt'" },
      { text: "L = L₀ / γ", note: '長さの収縮' },
    ],
    tags: ['relativity', 'special-relativity', 'time-dilation', 'high-school'],
    difficulty: 3,
    parameterDefinitions: [
      range('beta', '速度 β = v/c', 0.8, 0, 0.999, 0.001, { unit: '' }),
      range('clockHeight', '鏡の間隔', 1, 0.3, 2, 0.05, { unit: '光秒', restart: true }),
    ],
    displayDefinitions: [
      read('t', '静止系の時間', 's', 3),
      read('properTime', '運動する時計の固有時', 's', 3),
      read('gamma', 'ローレンツ因子 γ', '', 4),
      read('ticksRest', '静止時計の刻み', '', 0),
      read('ticksMoving', '運動時計の刻み', '', 0),
      read('contractedLength', '収縮後の長さ', '光秒', 4),
    ],
    graphDefinitions: [
      timeGraph('ticks', '刻んだ回数', [
        { key: 'ticksRest', label: '静止', color: '#5ac8fa' },
        { key: 'ticksMoving', label: '運動', color: '#ffb454' },
      ]),
      timeGraph('gamma', '固有時と座標時', [
        { key: 't', label: '座標時', color: '#5ac8fa' },
        { key: 'properTime', label: '固有時', color: '#ffb454' },
      ]),
    ],
    runtimeOptions: { dt: 1 / 2000, speed: 0.4 },
    simulationCode: `
return {
  meta: { units: 'c = 1, lengths in light-seconds' },
  init(p) {
    return { x: -3, restPhase: 0, movPhase: 0, ticksRest: 0, ticksMoving: 0, tau: 0 };
  },
  step(s, dt, p) {
    const gamma = 1 / Math.sqrt(1 - p.beta * p.beta);
    s.x += p.beta * dt;
    if (s.x > 3.2) s.x = -3.2;
    // Rest clock: light crosses 2h per tick. Moving clock: same light speed,
    // but the path in this frame is longer by gamma, so it ticks slower.
    const restRate = 1 / (2 * p.clockHeight);
    s.restPhase += restRate * dt;
    s.movPhase += (restRate / gamma) * dt;
    s.tau += dt / gamma;
    while (s.restPhase >= 1) { s.restPhase -= 1; s.ticksRest++; }
    while (s.movPhase >= 1) { s.movPhase -= 1; s.ticksMoving++; }
    return s;
  },
  sample(s, p, t) {
    const gamma = 1 / Math.sqrt(1 - p.beta * p.beta);
    return {
      draw: { x: s.x, restPhase: s.restPhase, movPhase: s.movPhase, h: p.clockHeight, beta: p.beta, gamma },
      scalars: {
        t, properTime: s.tau, gamma,
        ticksRest: s.ticksRest, ticksMoving: s.ticksMoving,
        contractedLength: p.clockHeight / gamma,
      },
      series: { t, properTime: s.tau, ticksRest: s.ticksRest, ticksMoving: s.ticksMoving, gamma },
    };
  },
};`,
    rendererCode: `
const d = frame.draw;
const view = helpers.view({ xmin: -3.6, xmax: 3.6, ymin: -1.4, ymax: 2.6 }, { stretch: true, pad: 24 });
const clock = (cx, phase, color, label, tilt) => {
  const top = view.y(d.h), bot = view.y(0);
  ctx.strokeStyle = 'rgba(200,220,235,0.7)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(cx - 26, top); ctx.lineTo(cx + 26, top); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - 26, bot); ctx.lineTo(cx + 26, bot); ctx.stroke();
  const up = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
  const py = bot + (top - bot) * up;
  const px = cx + tilt * (up - 0.5) * 2;
  ctx.strokeStyle = color; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(cx - tilt, bot); ctx.lineTo(px, py); ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(px, py, 5, 0, 2 * Math.PI); ctx.fill();
  helpers.label(label, cx, top - 14, { align: 'center', color });
};
clock(view.x(-2), d.restPhase, helpers.theme.trace[0], '静止した光時計', 0);
clock(view.x(d.x), d.movPhase, helpers.theme.trace[1], '運動する光時計', 26 * d.beta);
helpers.label('β = ' + d.beta.toFixed(3) + '   γ = ' + d.gamma.toFixed(3), 12, helpers.h - 12, { color: helpers.theme.ink });`,
  }),

  sim({
    slug: 'relativity-calculator',
    title: '相対論計算機',
    titleEn: 'Relativity calculator',
    category: 'relativity',
    type: 'calculator',
    difficulty: 1,
    shortDescription: 'β・γ・エネルギー・運動量・ドップラー因子を一括で計算します。',
    description:
      '速度または運動エネルギーを入力すると、ローレンツ因子、相対論的運動量、全エネルギー、静止エネルギー、' +
      '時間の遅れ、長さの収縮、相対論的ドップラー因子をまとめて表示します。\n\n' +
      '加速器の粒子（例：LHC の陽子は γ ≈ 7000）や宇宙線の値を入れて桁感覚をつかむのに使えます。',
    physicsTopics: ['ローレンツ因子', '相対論的エネルギー', 'E=mc²', '相対論的ドップラー効果'],
    formulas: [
      { text: 'γ = 1/√(1−β²)' },
      { text: 'E = γmc²,  p = γmv' },
      { text: 'E² = (pc)² + (mc²)²' },
      { text: 'D = √((1+β)/(1−β))' },
    ],
    tags: ['relativity', 'calculator', 'special-relativity', 'high-school'],
    parameterDefinitions: [
      range('beta', '速度 β = v/c', 0.9, 0, 0.999999, 0.000001, { unit: '' }),
      choice('particle', '粒子', 'proton', [
        { value: 'electron', label: '電子' },
        { value: 'proton', label: '陽子' },
        { value: 'muon', label: 'ミューオン' },
        { value: 'custom', label: '自由入力' },
      ]),
      range('customMass', '静止質量（自由入力）', 1, 0.0001, 1000, 0.0001, { unit: 'GeV/c²' }),
      range('properDistance', '固有距離', 1, 0.001, 100000, 0.001, { unit: 'm' }),
    ],
    displayDefinitions: [
      read('gamma', 'ローレンツ因子 γ', '', 6),
      read('velocity', '速度', 'm/s', 0),
      read('restEnergy', '静止エネルギー', 'MeV', 4),
      read('totalEnergy', '全エネルギー', 'MeV', 4),
      read('kineticEnergy', '運動エネルギー', 'MeV', 4),
      read('momentum', '運動量', 'MeV/c', 4),
      read('contracted', '収縮後の長さ', 'm', 6),
      read('dopplerApproach', 'ドップラー因子（接近）', '', 5),
      read('dopplerRecede', 'ドップラー因子（後退）', '', 5),
    ],
    graphDefinitions: [
      xyGraph('gamma-beta', 'γ と β の関係', { key: 'sweepBeta', label: 'β', unit: '' }, [
        { key: 'sweepGamma', label: 'γ', color: '#5ac8fa' },
      ], { maxPoints: 400 }),
    ],
    runtimeOptions: { dt: 1 / 120, maxSubsteps: 4 },
    simulationCode: `
const MASSES = { electron: 0.51099895e-3, proton: 0.93827208, muon: 0.1056583745 }; // GeV/c^2
return {
  meta: { kind: 'calculator with a sweep for the gamma(beta) curve' },
  init(p) { return { sweep: 0 }; },
  step(s, dt, p) { if (s.sweep < 1) s.sweep = Math.min(1, s.sweep + 0.004); return s; },
  sample(s, p, t) {
    const m = (p.particle === 'custom' ? p.customMass : MASSES[p.particle]) * 1000; // MeV
    const g = 1 / Math.sqrt(1 - p.beta * p.beta);
    const b = 0.9995 * s.sweep;
    return {
      draw: { beta: p.beta, gamma: g, sweep: s.sweep },
      scalars: {
        gamma: g, velocity: p.beta * 299792458,
        restEnergy: m, totalEnergy: g * m, kineticEnergy: (g - 1) * m,
        momentum: g * m * p.beta,
        contracted: p.properDistance / g,
        dopplerApproach: Math.sqrt((1 + p.beta) / (1 - p.beta)),
        dopplerRecede: Math.sqrt((1 - p.beta) / (1 + p.beta)),
        sweepBeta: b, sweepGamma: 1 / Math.sqrt(1 - b * b),
      },
      series: { sweepBeta: b, sweepGamma: 1 / Math.sqrt(1 - b * b) },
      done: s.sweep >= 1,
    };
  },
};`,
    rendererCode: `
const d = frame.draw;
const view = helpers.view({ xmin: 0, xmax: 1, ymin: 0, ymax: 12 }, { stretch: true, pad: 34 });
helpers.grid(view, 0.1, 2);
ctx.strokeStyle = helpers.theme.trace[0]; ctx.lineWidth = 2;
ctx.beginPath();
for (let i = 0; i <= 300; i++) {
  const b = (i / 300) * 0.9995;
  const g = 1 / Math.sqrt(1 - b * b);
  if (g > 12) break;
  i ? ctx.lineTo(view.x(b), view.y(g)) : ctx.moveTo(view.x(b), view.y(g));
}
ctx.stroke();
const gy = Math.min(d.gamma, 12);
ctx.strokeStyle = helpers.theme.trace[1]; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.4;
ctx.beginPath(); ctx.moveTo(view.x(d.beta), view.y(0)); ctx.lineTo(view.x(d.beta), view.y(gy)); ctx.lineTo(view.x(0), view.y(gy)); ctx.stroke();
ctx.setLineDash([]);
ctx.fillStyle = helpers.theme.trace[1];
ctx.beginPath(); ctx.arc(view.x(d.beta), view.y(gy), 5, 0, 2 * Math.PI); ctx.fill();
helpers.label('β', helpers.w / 2, helpers.h - 8, { align: 'center' });
helpers.label('γ', 10, 18);
helpers.label('γ = ' + d.gamma.toFixed(4), view.x(d.beta) + 8, view.y(gy) - 10, { color: helpers.theme.ink });`,
  }),

  sim({
    slug: 'quantum-tunneling',
    title: '波束のトンネル効果',
    titleEn: 'Quantum tunnelling of a wave packet',
    category: 'quantum',
    shortDescription: 'シュレーディンガー方程式を解き、障壁を透過する確率を数値的に測ります。',
    description:
      '1 次元の時間依存シュレーディンガー方程式を Visscher の実部・虚部を半ステップずらす陽的スキームで解きます。' +
      'このスキームはユニタリではありませんが、保存量 |ψ|² の離散版を厳密に保存するため長時間でも安定です。\n\n' +
      'ガウス波束を障壁に当てると、一部が反射し一部が透過します。エネルギーが障壁高さより低くても透過確率は 0 になりません。' +
      '透過率・反射率は領域ごとの確率密度の積分としてリアルタイムに表示され、合計は 1 に保たれます。',
    physicsTopics: ['トンネル効果', '波動関数', '波束', 'シュレーディンガー方程式'],
    formulas: [
      { text: 'iħ ∂ψ/∂t = −(ħ²/2m) ∂²ψ/∂x² + V(x)ψ' },
      { text: 'T ≈ exp(−2κa),  κ = √(2m(V₀−E))/ħ' },
      { text: '∫|ψ|²dx = 1' },
    ],
    tags: ['quantum', 'tunnelling', 'wave-function', 'numerical-simulation', 'university-physics'],
    difficulty: 5,
    targetLevel: 'undergraduate',
    parameterDefinitions: [
      range('energy', '入射エネルギー E', 0.5, 0.05, 3, 0.01, { unit: '（V₀ 単位）', restart: true }),
      range('barrierHeight', '障壁の高さ V₀', 1, 0.1, 5, 0.05, { unit: '', restart: true }),
      range('barrierWidth', '障壁の幅 a', 0.6, 0.05, 3, 0.01, { unit: '', restart: true }),
      range('packetWidth', '波束の幅 σ', 1.2, 0.3, 4, 0.05, { unit: '', restart: true }),
      choice('potential', 'ポテンシャル', 'barrier', [
        { value: 'barrier', label: '矩形障壁' },
        { value: 'well', label: '井戸' },
        { value: 'step', label: '階段' },
        { value: 'double', label: '二重障壁' },
      ], { restart: true }),
    ],
    displayDefinitions: [
      read('t', '時間', '', 3),
      read('norm', '規格化 ∫|ψ|²', '', 6),
      read('transmitted', '透過確率', '', 5),
      read('reflected', '反射確率', '', 5),
      read('inBarrier', '障壁内の確率', '', 5),
      read('meanX', '期待値 ⟨x⟩', '', 3),
      read('analyticT', '定常解の透過率（参考）', '', 5),
    ],
    graphDefinitions: [
      timeGraph('probs', '確率の分配', [
        { key: 'transmitted', label: '透過', color: '#8ce99a' },
        { key: 'reflected', label: '反射', color: '#ff8fa3' },
        { key: 'norm', label: '合計', color: '#7d93a6' },
      ]),
      timeGraph('x', '期待値 ⟨x⟩', [{ key: 'meanX', label: '⟨x⟩', color: '#5ac8fa' }]),
    ],
    runtimeOptions: { dt: 1 / 4000, speed: 0.4 },
    simulationCode: `
// Natural units: hbar = 1, m = 1.
const N = 1200, XMIN = -40, XMAX = 40;
const DX = (XMAX - XMIN) / (N - 1);
return {
  meta: { integrator: "Visscher staggered real/imaginary explicit scheme" },
  init(p) {
    const V = new Float64Array(N);
    const a = p.barrierWidth;
    for (let i = 0; i < N; i++) {
      const x = XMIN + i * DX;
      if (p.potential === 'barrier') V[i] = Math.abs(x) < a / 2 ? p.barrierHeight : 0;
      else if (p.potential === 'well') V[i] = Math.abs(x) < a / 2 ? -p.barrierHeight : 0;
      else if (p.potential === 'step') V[i] = x > 0 ? p.barrierHeight : 0;
      else V[i] = (Math.abs(x - a) < a / 3 || Math.abs(x + a) < a / 3) ? p.barrierHeight : 0;
    }
    const k0 = Math.sqrt(2 * p.energy * p.barrierHeight);
    const x0 = -14, s0 = p.packetWidth;
    const re = new Float64Array(N), im = new Float64Array(N);
    let norm = 0;
    for (let i = 0; i < N; i++) {
      const x = XMIN + i * DX;
      const env = Math.exp(-((x - x0) ** 2) / (2 * s0 * s0));
      re[i] = env * Math.cos(k0 * x);
      im[i] = env * Math.sin(k0 * x);
      norm += (re[i] * re[i] + im[i] * im[i]) * DX;
    }
    const f = 1 / Math.sqrt(norm);
    for (let i = 0; i < N; i++) { re[i] *= f; im[i] *= f; }
    return { re, im, V, k0 };
  },
  step(s, dt, p) {
    const { re, im, V } = s;
    // Visscher's staggered scheme:
    //   dRe/dt = -(1/2) d2Im/dx2 + V Im
    //   dIm/dt =  (1/2) d2Re/dx2 - V Re
    // Updating Re first and then using the *new* Re for Im makes the pair
    // time-reversible and keeps the discrete norm Re^2 + Im(t-)Im(t+) constant.
    const tmp = s.reTmp || (s.reTmp = new Float64Array(N));
    for (let i = 1; i < N - 1; i++) {
      const lapIm = (im[i + 1] - 2 * im[i] + im[i - 1]) / (DX * DX);
      tmp[i] = re[i] + dt * (-0.5 * lapIm + V[i] * im[i]);
    }
    tmp[0] = 0; tmp[N - 1] = 0;
    for (let i = 0; i < N; i++) re[i] = tmp[i];
    for (let i = 1; i < N - 1; i++) {
      const lapRe = (re[i + 1] - 2 * re[i] + re[i - 1]) / (DX * DX);
      im[i] = im[i] + dt * (0.5 * lapRe - V[i] * re[i]);
    }
    im[0] = 0; im[N - 1] = 0;
    return s;
  },
  sample(s, p, t) {
    const dens = new Float64Array(N);
    let norm = 0, meanX = 0, left = 0, right = 0, inside = 0;
    const a = p.barrierWidth;
    for (let i = 0; i < N; i++) {
      const x = XMIN + i * DX;
      const d = s.re[i] * s.re[i] + s.im[i] * s.im[i];
      dens[i] = d;
      norm += d * DX;
      meanX += x * d * DX;
      if (x < -a / 2) left += d * DX;
      else if (x > a / 2) right += d * DX;
      else inside += d * DX;
    }
    const k = Math.sqrt(2 * p.energy * p.barrierHeight);
    const E = p.energy * p.barrierHeight;
    let analytic = 0;
    if (E < p.barrierHeight) {
      const kap = Math.sqrt(2 * (p.barrierHeight - E));
      analytic = 1 / (1 + (p.barrierHeight ** 2 * Math.sinh(kap * a) ** 2) / (4 * E * (p.barrierHeight - E)));
    } else {
      const k2 = Math.sqrt(2 * (E - p.barrierHeight));
      analytic = 1 / (1 + (p.barrierHeight ** 2 * Math.sin(k2 * a) ** 2) / (4 * E * (E - p.barrierHeight)));
    }
    const step = 3;
    const curve = [];
    for (let i = 0; i < N; i += step) curve.push([XMIN + i * DX, dens[i], s.re[i], s.im[i], s.V[i]]);
    return {
      draw: { curve, vMax: Math.max(p.barrierHeight, 0.5), xmin: XMIN, xmax: XMAX, a },
      scalars: {
        t, norm, transmitted: right, reflected: left, inBarrier: inside,
        meanX: meanX / (norm || 1), analyticT: analytic,
      },
      series: { t, norm, transmitted: right, reflected: left, meanX: meanX / (norm || 1) },
    };
  },
};`,
    rendererCode: `
const d = frame.draw;
let maxD = 1e-9;
for (const c of d.curve) maxD = Math.max(maxD, c[1]);
const view = helpers.view({ xmin: d.xmin, xmax: d.xmax, ymin: -0.35, ymax: 1.15 }, { stretch: true, pad: 24 });
// Potential.
ctx.fillStyle = 'rgba(125,147,166,0.22)';
ctx.beginPath(); ctx.moveTo(view.x(d.xmin), view.y(0));
for (const c of d.curve) ctx.lineTo(view.x(c[0]), view.y(Math.min(1, c[4] / d.vMax) * 0.85));
ctx.lineTo(view.x(d.xmax), view.y(0)); ctx.closePath(); ctx.fill();
// Real and imaginary parts.
const trace = (idx, color, scale) => {
  ctx.strokeStyle = color; ctx.lineWidth = 1.2;
  ctx.beginPath();
  d.curve.forEach((c, i) => {
    const y = view.y(c[idx] * scale);
    i ? ctx.lineTo(view.x(c[0]), y) : ctx.moveTo(view.x(c[0]), y);
  });
  ctx.stroke();
};
const s = 0.5 / Math.sqrt(maxD);
trace(2, 'rgba(90,200,250,0.55)', s);
trace(3, 'rgba(255,180,84,0.55)', s);
// Probability density, filled.
ctx.fillStyle = 'rgba(140,233,154,0.35)';
ctx.beginPath(); ctx.moveTo(view.x(d.xmin), view.y(0));
for (const c of d.curve) ctx.lineTo(view.x(c[0]), view.y((c[1] / maxD) * 0.9));
ctx.lineTo(view.x(d.xmax), view.y(0)); ctx.closePath(); ctx.fill();
ctx.strokeStyle = '#8ce99a'; ctx.lineWidth = 1.8;
ctx.beginPath();
d.curve.forEach((c, i) => { const y = view.y((c[1] / maxD) * 0.9); i ? ctx.lineTo(view.x(c[0]), y) : ctx.moveTo(view.x(c[0]), y); });
ctx.stroke();
helpers.label('緑＝|ψ|²  青＝Re ψ  橙＝Im ψ  灰＝ポテンシャル', 12, helpers.h - 10);`,
  }),

  sim({
    slug: 'radioactive-decay',
    title: '放射性崩壊と半減期',
    titleEn: 'Radioactive decay and half-life',
    category: 'nuclear-particle',
    shortDescription: '個々の原子核をモンテカルロで崩壊させ、指数則と統計ゆらぎを比べます。',
    description:
      '各時間刻みで、まだ崩壊していない原子核が確率 λΔt で崩壊するとして乱数で判定します。' +
      '多数の核を扱えば N(t) = N₀e^{−λt} に一致しますが、残りが少なくなるとゆらぎが目立つようになります。\n\n' +
      '親核 → 娘核 → 安定核の崩壊系列にも切り替えられ、娘核の量が一度増えてから減る「過渡平衡」が観察できます。',
    physicsTopics: ['放射性崩壊', '半減期', '崩壊定数', '崩壊系列', '統計ゆらぎ'],
    formulas: [
      { text: 'dN/dt = −λN' },
      { text: 'N(t) = N₀ e^{−λt}' },
      { text: 'T₁/₂ = ln2 / λ' },
      { text: '不確かさ ΔN ≈ √N' },
    ],
    tags: ['nuclear', 'monte-carlo', 'statistical-physics', 'high-school'],
    parameterDefinitions: [
      range('initial', '初期の原子核数 N₀', 5000, 50, 50000, 50, { unit: '個', restart: true }),
      range('halfLife', '半減期 T₁/₂', 3, 0.2, 30, 0.1, { unit: 's', restart: true }),
      toggle('chain', '崩壊系列（親→娘→安定）', false, { restart: true }),
      range('daughterHalfLife', '娘核の半減期', 8, 0.2, 60, 0.1, { unit: 's', restart: true }),
      range('seed', '乱数シード', 5, 1, 999, 1, { restart: true }),
    ],
    displayDefinitions: [
      read('t', '経過時間', 's', 2),
      read('parent', '親核の数', '個', 0),
      read('daughter', '娘核の数', '個', 0),
      read('stable', '安定核の数', '個', 0),
      read('theory', '理論値 N₀e^{−λt}', '個', 1),
      read('activity', '放射能', '崩壊/s', 1),
      read('deviation', '理論とのずれ', '個', 1),
    ],
    graphDefinitions: [
      timeGraph('decay', '残存数', [
        { key: 'parent', label: '親核（実測）', color: '#5ac8fa' },
        { key: 'theory', label: '指数則', color: '#7d93a6' },
        { key: 'daughter', label: '娘核', color: '#ffb454' },
      ]),
      timeGraph('activity', '放射能', [{ key: 'activity', label: 'A', color: '#ff8fa3' }]),
    ],
    runtimeOptions: { dt: 1 / 200, speed: 1, maxSubsteps: 40 },
    simulationCode: `
return {
  meta: { kind: 'Monte Carlo decay with a seeded PRNG' },
  init(p) {
    return {
      rnd: PL.rng(p.seed), parent: p.initial, daughter: 0, stable: 0,
      decaysThisSecond: 0, window: 0, activity: 0, grid: [],
    };
  },
  step(s, dt, p) {
    const lam = Math.LN2 / p.halfLife;
    const lam2 = Math.LN2 / p.daughterHalfLife;
    // Binomial draw approximated by summing Bernoulli trials for small N,
    // and by a normal approximation for large N (exact enough, much faster).
    const decay = (n, rate) => {
      if (n <= 0) return 0;
      const q = 1 - Math.exp(-rate * dt);
      if (n < 400) {
        let k = 0;
        for (let i = 0; i < n; i++) if (s.rnd() < q) k++;
        return k;
      }
      const mean = n * q;
      const sd = Math.sqrt(n * q * (1 - q));
      return Math.max(0, Math.min(n, Math.round(s.rnd.normal(mean, sd))));
    };
    const d1 = decay(s.parent, lam);
    s.parent -= d1;
    if (p.chain) {
      s.daughter += d1;
      const d2 = decay(s.daughter, lam2);
      s.daughter -= d2;
      s.stable += d2;
    } else {
      s.stable += d1;
    }
    s.decaysThisSecond += d1;
    s.window += dt;
    if (s.window >= 0.25) { s.activity = s.decaysThisSecond / s.window; s.decaysThisSecond = 0; s.window = 0; }
    return s;
  },
  sample(s, p, t) {
    const theory = p.initial * Math.exp((-Math.LN2 * t) / p.halfLife);
    const scalars = {
      t, parent: s.parent, daughter: s.daughter, stable: s.stable,
      theory, activity: s.activity, deviation: s.parent - theory,
    };
    return {
      draw: { parent: s.parent, daughter: s.daughter, stable: s.stable, total: p.initial, chain: p.chain, theory },
      scalars, series: scalars,
      done: s.parent === 0 && s.daughter === 0,
    };
  },
};`,
    rendererCode: `
const d = frame.draw;
const w = helpers.w, h = helpers.h;
// Grid of nuclei, coloured by species.
const cols = 80;
const rows = Math.ceil(400 / cols);
const shown = 400;
const cw = Math.min((w - 40) / cols, 8);
const px = (w - cols * cw) / 2;
const py = h * 0.12;
const fracP = d.parent / d.total, fracD = d.daughter / d.total;
for (let i = 0; i < shown; i++) {
  const f = i / shown;
  const x = px + (i % cols) * cw, y = py + Math.floor(i / cols) * cw;
  ctx.fillStyle = f < fracP ? '#5ac8fa' : f < fracP + fracD ? '#ffb454' : 'rgba(125,147,166,0.35)';
  ctx.beginPath(); ctx.arc(x + cw / 2, y + cw / 2, cw * 0.36, 0, 2 * Math.PI); ctx.fill();
}
// Stacked bar of the populations.
const barY = py + rows * cw + 30, barH = 26, barW = w - 60;
let cursor = 30;
const seg = (frac, color, label) => {
  const wpx = barW * frac;
  ctx.fillStyle = color; ctx.fillRect(cursor, barY, wpx, barH);
  if (wpx > 44) helpers.label(label, cursor + 6, barY + 17, { color: '#0b1016' });
  cursor += wpx;
};
seg(fracP, '#5ac8fa', '親核');
if (d.chain) seg(fracD, '#ffb454', '娘核');
seg(1 - fracP - (d.chain ? fracD : 0), 'rgba(125,147,166,0.4)', '安定');
helpers.label('残存 ' + d.parent + ' 個（理論 ' + d.theory.toFixed(0) + ' 個）', 30, barY + barH + 22, { color: helpers.theme.ink });`,
  }),

  sim({
    slug: 'galaxy-rotation-curve',
    title: '銀河回転曲線とダークマター',
    titleEn: 'Galaxy rotation curve and dark matter',
    category: 'galaxies',
    type: 'model',
    shortDescription: '見えている物質だけでは説明できない平坦な回転曲線を、ハローを足して再現します。',
    description:
      'バルジ＋指数円盤の質量分布から期待される回転速度と、ダークマターハロー（NFW 型）を加えた場合の回転速度を比較します。' +
      '観測される回転曲線は外側でも平坦なままで、可視物質だけの予想（ケプラー的に落ちる曲線）とは合いません。\n\n' +
      'ハロー質量を 0 にすると曲線は外側で落ち始め、観測点（誤差棒付き）から外れていきます。' +
      '合わせ込んでみると、必要な暗黒物質量が可視質量の数倍になることが分かります。',
    physicsTopics: ['銀河回転曲線', 'ダークマター', '質量分布', '重力'],
    formulas: [
      { text: 'v(r) = √(G M(<r) / r)' },
      { text: 'ρ_NFW(r) = ρ₀ / [(r/r_s)(1+r/r_s)²]' },
      { text: 'Σ_disk(r) = Σ₀ e^{−r/h}' },
    ],
    tags: ['astrophysics', 'galaxies', 'dark-matter', 'model', 'university-physics'],
    difficulty: 3,
    targetLevel: 'undergraduate',
    parameterDefinitions: [
      range('diskMass', '円盤質量', 6, 0.1, 30, 0.1, { unit: '10¹⁰ M☉' }),
      range('scaleLength', '円盤のスケール長 h', 3, 0.5, 10, 0.1, { unit: 'kpc' }),
      range('bulgeMass', 'バルジ質量', 1, 0, 10, 0.05, { unit: '10¹⁰ M☉' }),
      range('haloMass', 'ハロー質量', 60, 0, 300, 1, { unit: '10¹⁰ M☉' }),
      range('haloScale', 'ハローのスケール半径 r_s', 12, 1, 60, 0.5, { unit: 'kpc' }),
      toggle('showObs', '観測点を表示', true),
    ],
    displayDefinitions: [
      read('vFlat', '外側の回転速度', 'km/s', 1),
      read('vVisible', '可視物質のみ（30 kpc）', 'km/s', 1),
      read('darkFraction', '暗黒物質の割合（<30 kpc）', '', 3),
      read('chi2', '観測点との χ²', '', 3),
      read('enclosedMass', '30 kpc 内の全質量', '10¹⁰ M☉', 2),
    ],
    graphDefinitions: [
      xyGraph('curve', '回転曲線', { key: 'r', label: '半径', unit: 'kpc' }, [
        { key: 'vTotal', label: '全体', color: '#5ac8fa' },
        { key: 'vVis', label: '可視物質のみ', color: '#ffb454' },
      ], { maxPoints: 300 }),
    ],
    runtimeOptions: { dt: 1 / 60, maxSubsteps: 4 },
    simulationCode: `
// Units: kpc, 1e10 Msun, km/s.  G = 4.30091e-6 kpc (km/s)^2 / Msun
const G = 4.30091e-6 * 1e10;
return {
  meta: { kind: 'static mass model with a sweep' },
  init(p) {
    // Reference "observations": a flat curve with scatter, as real galaxies show.
    const rnd = PL.rng(17);
    const obs = [];
    for (let r = 2; r <= 30; r += 2) obs.push([r, 190 + rnd.normal(0, 7), 10]);
    return { scan: 0, obs };
  },
  step(s, dt, p) { s.scan = Math.min(1, s.scan + 0.02); return s; },
  sample(s, p, t) {
    const h = p.scaleLength;
    const mDisk = (r) => p.diskMass * (1 - Math.exp(-r / h) * (1 + r / h));
    const mBulge = (r) => (p.bulgeMass * r * r) / ((r + 0.6) * (r + 0.6));
    const mHalo = (r) => {
      const x = r / p.haloScale;
      const f = (y) => Math.log(1 + y) - y / (1 + y);
      return (p.haloMass * f(x)) / f(30 / p.haloScale || 1);
    };
    const v = (r, withHalo) => {
      const m = mDisk(r) + mBulge(r) + (withHalo ? mHalo(r) : 0);
      return Math.sqrt((G * m) / r);
    };
    const curve = [];
    for (let i = 1; i <= 120; i++) {
      const r = (i / 120) * 32;
      curve.push([r, v(r, true), v(r, false)]);
    }
    let chi2 = 0;
    for (const [r, vo, sig] of s.obs) chi2 += ((v(r, true) - vo) / sig) ** 2;
    const mvis = mDisk(30) + mBulge(30);
    const idx = Math.min(119, Math.floor(s.scan * 119));
    return {
      draw: { curve, obs: s.obs, showObs: p.showObs },
      scalars: {
        vFlat: v(30, true), vVisible: v(30, false),
        darkFraction: mHalo(30) / (mvis + mHalo(30)),
        chi2: chi2 / s.obs.length, enclosedMass: mvis + mHalo(30),
        r: curve[idx][0], vTotal: curve[idx][1], vVis: curve[idx][2],
      },
      series: { r: curve[idx][0], vTotal: curve[idx][1], vVis: curve[idx][2] },
      done: s.scan >= 1,
    };
  },
};`,
    rendererCode: `
const d = frame.draw;
const view = helpers.view({ xmin: 0, xmax: 32, ymin: 0, ymax: 300 }, { stretch: true, pad: 34 });
helpers.grid(view, 4, 50);
const plot = (idx, color, dash) => {
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.setLineDash(dash || []);
  ctx.beginPath();
  d.curve.forEach((c, i) => (i ? ctx.lineTo(view.x(c[0]), view.y(c[idx])) : ctx.moveTo(view.x(c[0]), view.y(c[idx]))));
  ctx.stroke(); ctx.setLineDash([]);
};
plot(2, '#ffb454', [5, 4]);
plot(1, '#5ac8fa');
if (d.showObs) {
  ctx.strokeStyle = '#dbe6f0'; ctx.fillStyle = '#dbe6f0'; ctx.lineWidth = 1.2;
  for (const [r, v, sig] of d.obs) {
    ctx.beginPath(); ctx.moveTo(view.x(r), view.y(v - sig)); ctx.lineTo(view.x(r), view.y(v + sig)); ctx.stroke();
    ctx.beginPath(); ctx.arc(view.x(r), view.y(v), 3, 0, 2 * Math.PI); ctx.fill();
  }
}
helpers.label('半径 [kpc]', helpers.w / 2, helpers.h - 8, { align: 'center' });
helpers.label('回転速度 [km/s]', 10, 18);
helpers.label('橙＝可視物質のみ、青＝ハローを含む', 12, 34, { color: helpers.theme.muted });`,
  }),

  sim({
    slug: 'cosmic-expansion',
    title: '宇宙膨張とフリードマン方程式',
    titleEn: 'Cosmic expansion and the Friedmann equation',
    category: 'cosmology',
    shortDescription: 'Ωm と ΩΛ を変えて、宇宙の過去と未来のスケール因子を積分します。',
    description:
      'フリードマン方程式 (ȧ/a)² = H₀²[Ω_m a⁻³ + Ω_r a⁻⁴ + Ω_k a⁻² + Ω_Λ] を RK4 で前後に積分し、' +
      'スケール因子 a(t) の履歴と未来を描きます。\n\n' +
      'Ω_Λ = 0 の物質優勢宇宙では膨張が減速し、Ω が十分大きければ再収縮します。' +
      '観測値（Ω_m ≈ 0.31、Ω_Λ ≈ 0.69）では、約 70 億年前に減速から加速へ転じた点が現れます。',
    physicsTopics: ['宇宙膨張', 'フリードマン方程式', 'ハッブル定数', 'ダークエネルギー', '赤方偏移'],
    formulas: [
      { text: '(ȧ/a)² = H₀²[Ω_m a⁻³ + Ω_r a⁻⁴ + Ω_k a⁻² + Ω_Λ]' },
      { text: '1 + z = 1/a' },
      { text: 'Ω_k = 1 − Ω_m − Ω_r − Ω_Λ' },
    ],
    tags: ['astrophysics', 'cosmology', 'dark-energy', 'model', 'university-physics'],
    difficulty: 4,
    targetLevel: 'undergraduate',
    parameterDefinitions: [
      range('H0', 'ハッブル定数 H₀', 67.7, 50, 90, 0.1, { unit: 'km/s/Mpc', restart: true }),
      range('omegaM', '物質 Ω_m', 0.31, 0, 3, 0.01, { unit: '', restart: true }),
      range('omegaL', 'ダークエネルギー Ω_Λ', 0.69, 0, 2, 0.01, { unit: '', restart: true }),
      range('omegaR', '放射 Ω_r', 0.00009, 0, 0.01, 0.00001, { unit: '', restart: true }),
    ],
    displayDefinitions: [
      read('age', '現在の宇宙年齢', '億年', 2),
      read('omegaK', '曲率 Ω_k', '', 4),
      read('fate', '将来（1膨張継続/2再収縮）', '', 0),
      read('accelToday', '現在の加速度 q₀', '', 4),
      read('turnover', '加速に転じた時刻', '億年前', 2),
      read('futureScale', '1000 億年後の a', '', 3),
    ],
    graphDefinitions: [
      xyGraph('a-t', 'スケール因子 a(t)', { key: 'timeGyr', label: '時刻（現在を 0 とする）', unit: '億年' }, [
        { key: 'scale', label: 'a', color: '#5ac8fa' },
      ], { maxPoints: 1200 }),
    ],
    runtimeOptions: { dt: 1 / 60, maxSubsteps: 4 },
    simulationCode: `
const GYR_PER_INV_H = 977.79; // (km/s/Mpc)^-1 in Gyr
return {
  meta: { integrator: 'RK4 integrated backwards and forwards from a = 1' },
  init(p) {
    const ok = 1 - p.omegaM - p.omegaL - p.omegaR;
    const H0 = 1 / (GYR_PER_INV_H / p.H0); // per Gyr
    const E = (a) => {
      const v = p.omegaM / (a * a * a) + p.omegaR / (a ** 4) + ok / (a * a) + p.omegaL;
      return v;
    };
    const track = [];
    // Backwards from today to a -> 0.
    let a = 1, t = 0;
    const dt = -0.002;
    for (let i = 0; i < 40000 && a > 1e-3; i++) {
      const f = (tt, y) => [y[0] * H0 * Math.sqrt(Math.max(1e-12, E(y[0])))];
      a = PL.rk4(f, t, [a], dt)[0];
      t += dt;
      if (i % 20 === 0) track.unshift([t, a]);
    }
    const age = -t;
    // Forwards into the future.
    a = 1; t = 0;
    let collapsing = false;
    for (let i = 0; i < 60000 && t < 100; i++) {
      const e = E(a);
      if (e <= 0) { collapsing = true; break; }
      const f = (tt, y) => [y[0] * H0 * Math.sqrt(Math.max(0, E(y[0])))];
      a = PL.rk4(f, t, [a], 0.002)[0];
      t += 0.002;
      if (i % 20 === 0) track.push([t, a]);
    }
    return { track, age, collapsing, ok, H0, scan: 0 };
  },
  step(s, dt, p) { s.scan = Math.min(1, s.scan + 0.01); return s; },
  sample(s, p, t) {
    const q0 = p.omegaM / 2 + p.omegaR - p.omegaL;
    // Deceleration parameter q(a) = 0 marks the switch to acceleration.
    let turnover = 0;
    for (const [tt, a] of s.track) {
      const q = (p.omegaM / (2 * a ** 3) + p.omegaR / a ** 4 - p.omegaL) /
        (p.omegaM / a ** 3 + p.omegaR / a ** 4 + s.ok / (a * a) + p.omegaL);
      if (q < 0) { turnover = -tt; break; }
    }
    const idx = Math.min(s.track.length - 1, Math.floor(s.scan * (s.track.length - 1)));
    const last = s.track[s.track.length - 1];
    return {
      draw: { track: s.track, age: s.age, collapsing: s.collapsing },
      scalars: {
        age: s.age * 10, omegaK: s.ok, fate: s.collapsing ? 2 : 1,
        accelToday: q0, turnover: turnover * 10,
        futureScale: last ? last[1] : 1,
        timeGyr: s.track[idx][0] * 10, scale: s.track[idx][1],
      },
      series: { timeGyr: s.track[idx][0] * 10, scale: s.track[idx][1] },
      done: s.scan >= 1,
    };
  },
};`,
    rendererCode: `
const d = frame.draw;
const tmin = d.track[0][0], tmax = d.track[d.track.length - 1][0];
let amax = 0;
for (const p0 of d.track) amax = Math.max(amax, p0[1]);
const view = helpers.view({ xmin: tmin, xmax: tmax, ymin: 0, ymax: Math.min(amax, 6) }, { stretch: true, pad: 34 });
helpers.grid(view, (tmax - tmin) / 8, Math.min(amax, 6) / 6);
// "Now" marker.
ctx.strokeStyle = 'rgba(219,230,240,0.5)'; ctx.setLineDash([4, 4]);
ctx.beginPath(); ctx.moveTo(view.x(0), view.y(0)); ctx.lineTo(view.x(0), view.y(Math.min(amax, 6))); ctx.stroke();
ctx.setLineDash([]);
helpers.label('現在', view.x(0) + 6, 18, { color: helpers.theme.ink });
ctx.strokeStyle = helpers.theme.trace[0]; ctx.lineWidth = 2.2;
ctx.beginPath();
d.track.forEach((p0, i) => (i ? ctx.lineTo(view.x(p0[0]), view.y(p0[1])) : ctx.moveTo(view.x(p0[0]), view.y(p0[1]))));
ctx.stroke();
ctx.fillStyle = '#ffb454';
ctx.beginPath(); ctx.arc(view.x(0), view.y(1), 5, 0, 2 * Math.PI); ctx.fill();
helpers.label('時間 [10億年]', helpers.w / 2, helpers.h - 8, { align: 'center' });
helpers.label('スケール因子 a', 10, 18);
helpers.label('宇宙年齢 ' + (d.age * 10).toFixed(1) + ' 億年', 12, 34, { color: helpers.theme.muted });`,
  }),
];
