import { sim, range, toggle, choice, read, timeGraph, xyGraph } from './common.js';

export const wavesThermal = [
  sim({
    slug: 'standing-waves-on-a-string',
    title: '弦の振動と定常波',
    titleEn: 'Standing waves on a string',
    category: 'waves-optics',
    shortDescription: '波動方程式を直接解いて、進行波の重ね合わせから定常波ができる過程を見ます。',
    description:
      '固定端の弦を波動方程式 ∂²y/∂t² = c² ∂²y/∂x² に従って時間発展させます（空間 2 次・時間 2 次の差分法）。' +
      '端で反射した波と入射波が重なり、駆動周波数が固有振動数 fₙ = nc/2L に一致したときだけ振幅が成長して定常波になります。\n\n' +
      '節と腹の位置、n 倍振動の形、共振からわずかに外れたときのビートを観察できます。',
    physicsTopics: ['波動方程式', '定常波', '固有振動', '共振', '反射'],
    formulas: [
      { text: '∂²y/∂t² = c² ∂²y/∂x²' },
      { text: 'c = √(T/µ)' },
      { text: 'fₙ = n c / 2L' },
    ],
    tags: ['waves', 'oscillation', 'resonance', 'numerical-simulation', 'high-school'],
    parameterDefinitions: [
      range('tension', '張力 T', 40, 1, 200, 0.5, { unit: 'N' }),
      range('density', '線密度 µ', 0.01, 0.001, 0.1, 0.001, { unit: 'kg/m' }),
      range('length', '弦の長さ L', 1, 0.2, 3, 0.01, { unit: 'm', restart: true }),
      range('driveFreq', '駆動周波数', 31.6, 1, 400, 0.1, { unit: 'Hz' }),
      range('driveAmp', '駆動振幅', 0.003, 0, 0.02, 0.0005, { unit: 'm' }),
      range('damping', '減衰', 0.6, 0, 8, 0.05, { unit: '1/s' }),
      toggle('freeRun', '駆動を切って自由振動', false),
    ],
    displayDefinitions: [
      read('t', '時間', 's', 3),
      read('waveSpeed', '波の速さ c', 'm/s', 2),
      read('f1', '基本振動数 f₁', 'Hz', 3),
      read('harmonic', '駆動 / f₁', '', 3),
      read('maxAmplitude', '最大振幅', 'm', 5),
      read('nodes', '節の数', '', 0),
      read('energy', '弦のエネルギー', 'mJ', 4),
    ],
    graphDefinitions: [
      xyGraph('shape', '弦の形', { key: 'x', label: 'x', unit: 'm' }, [{ key: 'y', label: 'y', color: '#5ac8fa' }], { maxPoints: 400 }),
      timeGraph('center', '中央の変位', [{ key: 'center', label: 'y(L/2)', color: '#ffb454' }]),
      timeGraph('amp', '最大振幅の成長', [{ key: 'maxAmplitude', label: '振幅', color: '#8ce99a' }]),
    ],
    runtimeOptions: { dt: 1 / 60000, speed: 1 },
    simulationCode: `
const N = 240;
return {
  meta: { integrator: 'explicit finite difference, CFL checked' },
  init(p) {
    return {
      y: new Array(N + 1).fill(0), yPrev: new Array(N + 1).fill(0),
      tAbs: 0, maxAmp: 0,
    };
  },
  step(s, dt, p) {
    const c = Math.sqrt(p.tension / p.density);
    const dx = p.length / N;
    // Courant number; clamp dt so the explicit scheme stays stable.
    const r = (c * dt) / dx;
    const r2 = Math.min(r * r, 0.9);
    const y = s.y, yp = s.yPrev;
    const next = new Array(N + 1);
    next[0] = p.freeRun ? 0 : p.driveAmp * Math.sin(2 * Math.PI * p.driveFreq * s.tAbs);
    next[N] = 0;
    const damp = p.damping * dt;
    for (let i = 1; i < N; i++) {
      next[i] = ((2 - 2 * r2) * y[i] + r2 * (y[i + 1] + y[i - 1]) - (1 - damp) * yp[i]) / (1 + damp);
    }
    s.yPrev = y; s.y = next; s.tAbs += dt;
    return s;
  },
  sample(s, p, t) {
    const c = Math.sqrt(p.tension / p.density);
    const f1 = c / (2 * p.length);
    let maxA = 0;
    for (const v of s.y) maxA = Math.max(maxA, Math.abs(v));
    s.maxAmp = Math.max(s.maxAmp * 0.999, maxA);
    // Count interior sign changes → nodes.
    let nodes = 0;
    for (let i = 1; i < N; i++) if (s.y[i] === 0 || s.y[i] * s.y[i + 1] < 0) nodes++;
    const dx = p.length / N;
    let energy = 0;
    for (let i = 1; i < N; i++) {
      const slope = (s.y[i + 1] - s.y[i]) / dx;
      const vel = (s.y[i] - s.yPrev[i]) / (1 / 60000);
      energy += 0.5 * p.tension * slope * slope * dx + 0.5 * p.density * vel * vel * dx;
    }
    const scalars = {
      t, waveSpeed: c, f1, harmonic: p.driveFreq / f1,
      maxAmplitude: maxA, nodes, energy: energy * 1000,
      center: s.y[Math.floor(N / 2)],
      x: 0, y: 0,
    };
    return { draw: { y: s.y, L: p.length, amp: Math.max(s.maxAmp, 1e-4) }, scalars, series: scalars };
  },
};`,
    rendererCode: `
const d = frame.draw;
const view = helpers.view({ xmin: 0, xmax: d.L, ymin: -d.amp * 1.6, ymax: d.amp * 1.6 }, { stretch: true, pad: 26 });
helpers.axes(view);
ctx.strokeStyle = 'rgba(200,220,235,0.4)'; ctx.lineWidth = 3;
for (const x of [0, d.L]) { ctx.beginPath(); ctx.moveTo(view.x(x), view.y(-d.amp * 1.4)); ctx.lineTo(view.x(x), view.y(d.amp * 1.4)); ctx.stroke(); }
// Envelope hint: draw a faint mirror of the current shape.
ctx.strokeStyle = 'rgba(90,200,250,0.2)'; ctx.lineWidth = 1;
ctx.beginPath();
d.y.forEach((v, i) => { const x = (i / (d.y.length - 1)) * d.L; i ? ctx.lineTo(view.x(x), view.y(-v)) : ctx.moveTo(view.x(x), view.y(-v)); });
ctx.stroke();
ctx.strokeStyle = helpers.theme.trace[0]; ctx.lineWidth = 2.2;
ctx.beginPath();
d.y.forEach((v, i) => { const x = (i / (d.y.length - 1)) * d.L; i ? ctx.lineTo(view.x(x), view.y(v)) : ctx.moveTo(view.x(x), view.y(v)); });
ctx.stroke();
ctx.fillStyle = helpers.theme.trace[1];
ctx.beginPath(); ctx.arc(view.x(0), view.y(d.y[0]), 5, 0, 2 * Math.PI); ctx.fill();
helpers.label('左端＝振動源、右端＝固定端', 12, helpers.h - 12);`,
  }),

  sim({
    slug: 'two-source-interference',
    title: '二波源の干渉',
    titleEn: 'Two-source interference',
    category: 'waves-optics',
    type: 'visualization',
    shortDescription: '水面波モデルで干渉縞をつくり、スクリーン上の強度分布を二重スリットの式と比べます。',
    description:
      '二つの同位相波源から出る円形波 A sin(kr − ωt)/√r を足し合わせ、瞬間の変位と時間平均強度を描きます。' +
      '強め合う位置は経路差が波長の整数倍になるところで、スクリーン上の明線間隔は Δy ≈ λL/d に一致します。\n\n' +
      '波長と波源間隔を変えると干渉縞の間隔が変わり、d < λ/2 では強め合う方向が中央の一本だけになります。',
    physicsTopics: ['干渉', '二重スリット', '経路差', '回折'],
    formulas: [
      { text: 'd sinθ = mλ', note: '強め合う条件' },
      { text: 'Δy = λL / d', note: 'スクリーン上の明線間隔' },
      { text: 'I ∝ cos²(πd sinθ / λ)' },
    ],
    tags: ['waves', 'optics', 'interference', 'visualization', '2d', 'high-school'],
    parameterDefinitions: [
      range('wavelength', '波長 λ', 0.5, 0.1, 2, 0.01, { unit: 'm' }),
      range('separation', '波源間隔 d', 2, 0.1, 6, 0.05, { unit: 'm' }),
      range('phase', '位相差', 0, 0, 6.283, 0.05, { unit: 'rad' }),
      choice('display', '表示', 'instant', [
        { value: 'instant', label: '瞬間の変位' },
        { value: 'intensity', label: '時間平均強度' },
      ]),
      toggle('screen', 'スクリーンの強度分布を表示', true),
    ],
    displayDefinitions: [
      read('wavelength', '波長', 'm', 3),
      read('separation', '波源間隔', 'm', 3),
      read('fringeSpacing', '明線間隔（スクリーン上）', 'm', 4),
      read('maxOrder', '観測できる次数', '', 0),
      read('centralAngle', '1次の回折角', '°', 2),
    ],
    graphDefinitions: [
      xyGraph('screen', 'スクリーン上の強度', { key: 'screenY', label: '位置', unit: 'm' }, [
        { key: 'intensity', label: '強度', color: '#ffb454' },
      ], { maxPoints: 260 }),
    ],
    runtimeOptions: { dt: 1 / 240, maxSubsteps: 8, speed: 1 },
    simulationCode: `
const NX = 150, NY = 110;
return {
  meta: { kind: 'analytic field, sampled on a grid' },
  init(p) { return { phase: 0, scan: 0, profile: [] }; },
  step(s, dt, p) {
    s.phase += dt * 2 * Math.PI * 1.2;
    if (s.scan < NY) s.scan++;
    return s;
  },
  sample(s, p, t) {
    const W = 12, H = 9;
    const k = (2 * Math.PI) / p.wavelength;
    const src = [[-W / 2 + 1, -p.separation / 2], [-W / 2 + 1, p.separation / 2]];
    const field = new Float32Array(NX * NY);
    for (let j = 0; j < NY; j++) {
      const y = -H / 2 + (H * j) / (NY - 1);
      for (let i = 0; i < NX; i++) {
        const x = -W / 2 + (W * i) / (NX - 1);
        let sum = 0, amp2 = 0;
        for (let m = 0; m < 2; m++) {
          const r = Math.max(0.15, Math.hypot(x - src[m][0], y - src[m][1]));
          const ph = m === 1 ? p.phase : 0;
          sum += Math.sin(k * r - s.phase + ph) / Math.sqrt(r);
        }
        if (p.display === 'intensity') {
          // Time-averaged intensity of the two-source sum.
          const r1 = Math.max(0.15, Math.hypot(x - src[0][0], y - src[0][1]));
          const r2 = Math.max(0.15, Math.hypot(x - src[1][0], y - src[1][1]));
          const a1 = 1 / Math.sqrt(r1), a2 = 1 / Math.sqrt(r2);
          amp2 = a1 * a1 + a2 * a2 + 2 * a1 * a2 * Math.cos(k * (r2 - r1) - p.phase);
          field[j * NX + i] = amp2;
        } else {
          field[j * NX + i] = sum;
        }
      }
    }
    // Screen profile at the right edge.
    const L = W - 1;
    const profile = [];
    for (let j = 0; j < 200; j++) {
      const y = -H / 2 + (H * j) / 199;
      const r1 = Math.hypot(L, y + p.separation / 2);
      const r2 = Math.hypot(L, y - p.separation / 2);
      profile.push([y, 2 + 2 * Math.cos(k * (r2 - r1) - p.phase)]);
    }
    const maxOrder = Math.floor(p.separation / p.wavelength);
    const sample = profile[Math.floor((s.scan * 200) / NY) % 200];
    const scalars = {
      wavelength: p.wavelength, separation: p.separation,
      fringeSpacing: (p.wavelength * L) / p.separation,
      maxOrder,
      centralAngle: p.separation > p.wavelength ? (Math.asin(p.wavelength / p.separation) * 180) / Math.PI : 90,
      screenY: sample[0], intensity: sample[1],
    };
    return {
      draw: { field: Array.from(field), NX, NY, W, H, src, profile, mode: p.display, screen: p.screen },
      scalars, series: { screenY: sample[0], intensity: sample[1] },
    };
  },
};`,
    rendererCode: `
const d = frame.draw;
const w = helpers.w, h = helpers.h;
const img = ctx.createImageData(d.NX, d.NY);
let maxV = 0;
for (const v of d.field) maxV = Math.max(maxV, Math.abs(v));
for (let i = 0; i < d.field.length; i++) {
  const v = d.field[i] / (maxV || 1);
  let r, g, b;
  if (d.mode === 'intensity') {
    const s = Math.pow(Math.max(0, v), 0.7);
    r = 20 + 235 * s; g = 30 + 170 * s; b = 40 + 60 * s;
  } else {
    r = v > 0 ? 40 + 215 * v : 12; g = 60 + 120 * Math.abs(v); b = v < 0 ? 40 - 215 * v : 26;
  }
  img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 235;
}
const off = document.createElement('canvas');
off.width = d.NX; off.height = d.NY;
off.getContext('2d').putImageData(img, 0, 0);
ctx.imageSmoothingEnabled = true;
const plotW = d.screen ? w * 0.74 : w;
ctx.drawImage(off, 0, 0, plotW, h);
// Sources.
for (const s of d.src) {
  const px = ((s[0] + d.W / 2) / d.W) * plotW;
  const py = ((s[1] + d.H / 2) / d.H) * h;
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(px, py, 5, 0, 2 * Math.PI); ctx.stroke();
}
if (d.screen) {
  const x0 = plotW + 12;
  ctx.strokeStyle = helpers.theme.gridStrong; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0, h); ctx.stroke();
  ctx.strokeStyle = helpers.theme.trace[1]; ctx.lineWidth = 1.8;
  ctx.beginPath();
  d.profile.forEach((pt, i) => {
    const py = ((pt[0] + d.H / 2) / d.H) * h;
    const px = x0 + (pt[1] / 4) * (w - x0 - 10);
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  });
  ctx.stroke();
  helpers.label('スクリーン', x0 + 6, 16, { color: helpers.theme.trace[1] });
}`,
  }),

  sim({
    slug: 'doppler-effect',
    title: 'ドップラー効果',
    titleEn: 'Doppler effect',
    category: 'waves-optics',
    shortDescription: '動く音源の波面を描き、観測される振動数の前後差と衝撃波の発生を見ます。',
    description:
      '一定間隔で放出された球面波が、音源の運動によって前方で詰まり後方で伸びる様子をそのまま描きます。' +
      '観測される振動数は f\u2032 = f (v ± v_o) / (v ∓ v_s) で計算され、数値的に数えた波面通過頻度と一致します。\n\n' +
      '音源速度を音速以上にすると波面の包絡線が円錐（マッハ錐）をつくり、衝撃波が現れます。',
    physicsTopics: ['ドップラー効果', '音波', '衝撃波', 'マッハ数'],
    formulas: [
      { text: "f' = f (v + v_o) / (v − v_s)" },
      { text: 'sin θ = v / v_s', note: 'マッハ錐の半頂角' },
    ],
    tags: ['waves', 'sound', 'doppler', '2d', 'high-school'],
    parameterDefinitions: [
      range('sourceSpeed', '音源の速さ', 120, 0, 600, 1, { unit: 'm/s' }),
      range('observerSpeed', '観測者の速さ', 0, -200, 200, 1, { unit: 'm/s' }),
      range('frequency', '音源の振動数', 2, 0.5, 8, 0.1, { unit: 'Hz' }),
      range('soundSpeed', '音速 v', 340, 100, 800, 1, { unit: 'm/s' }),
    ],
    displayDefinitions: [
      read('t', '時間', 's', 2),
      read('mach', 'マッハ数', '', 3),
      read('fFront', '前方で聞こえる振動数', 'Hz', 3),
      read('fBack', '後方で聞こえる振動数', 'Hz', 3),
      read('fObserver', '観測者が聞く振動数', 'Hz', 3),
      read('machAngle', 'マッハ錐の半頂角', '°', 2),
    ],
    graphDefinitions: [
      timeGraph('f', '観測される振動数', [
        { key: 'fObserver', label: '観測者', color: '#5ac8fa' },
        { key: 'fFront', label: '前方', color: '#ffb454' },
        { key: 'fBack', label: '後方', color: '#8ce99a' },
      ]),
    ],
    runtimeOptions: { dt: 1 / 600, speed: 1 },
    simulationCode: `
return {
  meta: { kind: 'wavefront emission model' },
  init(p) { return { x: -400, obs: 300, fronts: [], sinceEmit: 0, tAbs: 0 }; },
  step(s, dt, p) {
    s.x += p.sourceSpeed * dt;
    s.obs += p.observerSpeed * dt;
    if (s.x > 500) s.x = -500;
    s.tAbs += dt;
    s.sinceEmit += dt;
    if (s.sinceEmit >= 1 / p.frequency) {
      s.sinceEmit -= 1 / p.frequency;
      s.fronts.push({ x: s.x, y: 0, t: 0 });
    }
    for (const f of s.fronts) f.t += dt;
    s.fronts = s.fronts.filter((f) => f.t * p.soundSpeed < 900);
    return s;
  },
  sample(s, p, t) {
    const v = p.soundSpeed, vs = p.sourceSpeed, vo = p.observerSpeed;
    const mach = vs / v;
    const fFront = vs < v ? (p.frequency * v) / (v - vs) : Infinity;
    const fBack = (p.frequency * v) / (v + vs);
    const dir = Math.sign(s.obs - s.x) || 1;
    const fObs = vs < v ? (p.frequency * (v - dir * vo)) / (v - dir * vs) : 0;
    const scalars = {
      t, mach,
      fFront: Number.isFinite(fFront) ? fFront : 0,
      fBack, fObserver: fObs,
      machAngle: mach > 1 ? (Math.asin(1 / mach) * 180) / Math.PI : 0,
    };
    return {
      draw: { x: s.x, obs: s.obs, fronts: s.fronts.map((f) => ({ x: f.x, r: f.t * v })), mach },
      scalars, series: scalars,
    };
  },
};`,
    rendererCode: `
const d = frame.draw;
const view = helpers.view({ xmin: -520, xmax: 520, ymin: -300, ymax: 300 }, { pad: 8 });
for (const f of d.fronts) {
  const alpha = Math.max(0, 0.55 - f.r / 1600);
  ctx.strokeStyle = 'rgba(90,200,250,' + alpha.toFixed(3) + ')';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(view.x(f.x), view.y(0), view.len(f.r), 0, 2 * Math.PI); ctx.stroke();
}
if (d.mach > 1) {
  const a = Math.asin(1 / d.mach);
  ctx.strokeStyle = 'rgba(255,143,163,0.8)'; ctx.lineWidth = 1.6;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(view.x(d.x), view.y(0));
    ctx.lineTo(view.x(d.x - 900 * Math.cos(a)), view.y(s * 900 * Math.sin(a)));
    ctx.stroke();
  }
}
ctx.fillStyle = '#ffb454';
ctx.beginPath(); ctx.arc(view.x(d.x), view.y(0), 7, 0, 2 * Math.PI); ctx.fill();
ctx.fillStyle = '#8ce99a';
ctx.beginPath(); ctx.arc(view.x(d.obs), view.y(-160), 6, 0, 2 * Math.PI); ctx.fill();
helpers.label('観測者', view.x(d.obs) + 10, view.y(-160) + 4, { color: '#8ce99a' });
helpers.label('マッハ数 ' + d.mach.toFixed(2), 12, 20, { color: helpers.theme.ink });`,
  }),

  sim({
    slug: 'ideal-gas-kinetic-theory',
    title: '気体分子運動論',
    titleEn: 'Kinetic theory of an ideal gas',
    category: 'thermodynamics',
    shortDescription: '剛体球の弾性衝突から圧力・温度・マクスウェル分布が自然に現れます。',
    description:
      '二次元の箱に入れた剛体円板を弾性衝突させます。圧力は壁が受ける力積を時間平均して求め、' +
      '温度は平均運動エネルギーから T = ⟨E⟩/k_B（2 次元）として定義します。\n\n' +
      '最初に全粒子を同じ速さで出発させても、数千回の衝突を経て速さの分布はマクスウェル–ボルツマン分布に近づきます。' +
      'ヒストグラムに理論曲線を重ねて表示しているので、緩和の様子がそのまま見えます。PV と Nk_BT の比も監視できます。',
    physicsTopics: ['気体分子運動論', '理想気体', 'マクスウェル分布', '圧力', '等分配則'],
    formulas: [
      { text: 'PV = N k_B T' },
      { text: 'P = (1/A) Σ Δp / Δt', note: '壁への力積から' },
      { text: 'f(v) ∝ v exp(−mv²/2k_BT)', note: '2 次元のマクスウェル分布' },
    ],
    tags: ['thermodynamics', 'statistical-physics', 'kinetic-theory', 'monte-carlo', 'university-physics'],
    difficulty: 3,
    targetLevel: 'undergraduate',
    parameterDefinitions: [
      range('count', '粒子数 N', 220, 20, 600, 10, { unit: '個', restart: true }),
      range('speed', '初速の大きさ', 300, 50, 1200, 10, { unit: 'm/s', restart: true }),
      range('radius', '粒子半径', 0.006, 0.002, 0.02, 0.0005, { unit: 'm', restart: true }),
      range('boxWidth', '箱の幅', 1, 0.4, 2, 0.05, { unit: 'm' }),
      choice('start', '初期分布', 'uniform', [
        { value: 'uniform', label: '全粒子が同じ速さ' },
        { value: 'maxwell', label: 'マクスウェル分布から' },
        { value: 'corner', label: '片側に集める' },
      ], { restart: true }),
      range('seed', '乱数シード', 3, 1, 100, 1, { restart: true }),
    ],
    displayDefinitions: [
      read('t', '時間', 's', 3),
      read('temperature', '温度 T', 'K', 1),
      read('pressure', '圧力 P', 'Pa', 2),
      read('pvOverNkT', 'PV / Nk_BT', '', 3),
      read('meanSpeed', '平均の速さ', 'm/s', 1),
      read('rmsSpeed', '二乗平均平方根速さ', 'm/s', 1),
      read('collisions', '衝突回数', '', 0),
      read('energy', '全運動エネルギー', 'J', 8),
    ],
    graphDefinitions: [
      timeGraph('T-P', '温度と圧力', [
        { key: 'temperature', label: 'T', color: '#ffb454' },
        { key: 'pressure', label: 'P', color: '#5ac8fa' },
      ]),
      timeGraph('speeds', '速さの統計', [
        { key: 'meanSpeed', label: '平均', color: '#8ce99a' },
        { key: 'rmsSpeed', label: 'rms', color: '#c0a6ff' },
      ]),
    ],
    runtimeOptions: { dt: 1 / 20000, speed: 1 },
    simulationCode: `
const MASS = 4.65e-26; // nitrogen molecule, kg
const KB = 1.380649e-23;
return {
  meta: { kind: 'event-free hard-disc MD with elastic collisions' },
  init(p) {
    const rnd = PL.rng(p.seed);
    const parts = [];
    const L = p.boxWidth;
    for (let i = 0; i < p.count; i++) {
      const a = rnd() * 2 * Math.PI;
      let sp = p.speed;
      if (p.start === 'maxwell') sp = p.speed * Math.sqrt(-Math.log(1 - rnd()));
      const x = p.start === 'corner' ? rnd.range(p.radius, L * 0.4) : rnd.range(p.radius, L - p.radius);
      parts.push({ x, y: rnd.range(p.radius, L - p.radius), vx: sp * Math.cos(a), vy: sp * Math.sin(a) });
    }
    return { parts, impulse: 0, window: 0, pressure: 0, collisions: 0, hist: null };
  },
  step(s, dt, p) {
    const L = p.boxWidth, r = p.radius;
    const parts = s.parts;
    for (const q of parts) {
      q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.x < r) { q.x = r; q.vx = Math.abs(q.vx); s.impulse += 2 * MASS * Math.abs(q.vx); }
      else if (q.x > L - r) { q.x = L - r; q.vx = -Math.abs(q.vx); s.impulse += 2 * MASS * Math.abs(q.vx); }
      if (q.y < r) { q.y = r; q.vy = Math.abs(q.vy); s.impulse += 2 * MASS * Math.abs(q.vy); }
      else if (q.y > L - r) { q.y = L - r; q.vy = -Math.abs(q.vy); s.impulse += 2 * MASS * Math.abs(q.vy); }
    }
    // Uniform-grid broad phase, then exact elastic resolution for equal masses.
    const cell = Math.max(2 * r, L / 40);
    const nc = Math.max(1, Math.ceil(L / cell));
    const grid = new Map();
    parts.forEach((q, i) => {
      const key = Math.floor(q.x / cell) * 1000 + Math.floor(q.y / cell);
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(i);
    });
    for (const [key, list] of grid) {
      const cx = Math.floor(key / 1000), cy = key % 1000;
      const neighbours = [];
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        const other = grid.get((cx + a) * 1000 + (cy + b));
        if (other) neighbours.push(...other);
      }
      for (const i of list) {
        for (const j of neighbours) {
          if (j <= i) continue;
          const A = parts[i], B = parts[j];
          const dx = B.x - A.x, dy = B.y - A.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 0 && dist < 2 * r) {
            const nx = dx / dist, ny = dy / dist;
            const rel = (B.vx - A.vx) * nx + (B.vy - A.vy) * ny;
            if (rel < 0) {
              A.vx += rel * nx; A.vy += rel * ny;
              B.vx -= rel * nx; B.vy -= rel * ny;
              const overlap = 2 * r - dist;
              A.x -= nx * overlap / 2; A.y -= ny * overlap / 2;
              B.x += nx * overlap / 2; B.y += ny * overlap / 2;
              s.collisions++;
            }
          }
        }
      }
    }
    s.window += dt;
    if (s.window > 0.002) {
      s.pressure = s.impulse / (s.window * 4 * L);
      s.impulse = 0; s.window = 0;
    }
    return s;
  },
  sample(s, p, t) {
    const speeds = s.parts.map((q) => Math.hypot(q.vx, q.vy));
    const mean = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    const ms = speeds.reduce((a, b) => a + b * b, 0) / speeds.length;
    const T = (MASS * ms) / (2 * KB);           // 2D equipartition: <E> = k_B T
    const V = p.boxWidth * p.boxWidth;
    const hist = PL.histogram(speeds, 26, 0, Math.max(...speeds) * 1.05);
    const scalars = {
      t, temperature: T, pressure: s.pressure,
      pvOverNkT: s.pressure > 0 ? (s.pressure * V) / (s.parts.length * KB * T) : 0,
      meanSpeed: mean, rmsSpeed: Math.sqrt(ms),
      collisions: s.collisions, energy: 0.5 * MASS * ms * s.parts.length,
    };
    return {
      draw: {
        parts: s.parts.map((q) => [q.x, q.y, Math.hypot(q.vx, q.vy)]),
        L: p.boxWidth, r: p.radius, hist, T, mass: MASS, kB: KB, vmax: Math.max(...speeds),
      },
      scalars, series: scalars,
    };
  },
};`,
    rendererCode: `
const d = frame.draw;
const w = helpers.w, h = helpers.h;
const boxW = Math.min(w * 0.62, h);
const view = helpers.view({ xmin: 0, xmax: d.L, ymin: 0, ymax: d.L }, { pad: 10 });
const scale = Math.min((w * 0.62 - 20) / d.L, (h - 20) / d.L);
const ox = 10, oy = h - 10;
const X = (x) => ox + x * scale, Y = (y) => oy - y * scale;
ctx.strokeStyle = 'rgba(200,220,235,0.45)'; ctx.lineWidth = 1.5;
ctx.strokeRect(X(0), Y(d.L), d.L * scale, d.L * scale);
for (const q of d.parts) {
  const f = Math.min(1, q[2] / (d.vmax || 1));
  ctx.fillStyle = 'rgb(' + Math.round(90 + 165 * f) + ',' + Math.round(200 - 60 * f) + ',' + Math.round(250 - 160 * f) + ')';
  ctx.beginPath(); ctx.arc(X(q[0]), Y(q[1]), Math.max(1.6, d.r * scale), 0, 2 * Math.PI); ctx.fill();
}
// Speed histogram with the Maxwell–Boltzmann curve on top.
const hx = w * 0.66, hw = w - hx - 14, hy = h - 40, hh = h * 0.6;
const maxCount = Math.max(...d.hist.counts);
ctx.fillStyle = 'rgba(90,200,250,0.5)';
d.hist.counts.forEach((c, i) => {
  const bw = hw / d.hist.counts.length;
  ctx.fillRect(hx + i * bw, hy - (c / maxCount) * hh, bw - 1, (c / maxCount) * hh);
});
ctx.strokeStyle = '#ffb454'; ctx.lineWidth = 2;
ctx.beginPath();
const norm = (v) => (d.mass * v / (d.kB * d.T)) * Math.exp(-(d.mass * v * v) / (2 * d.kB * d.T));
let peak = 0;
for (let i = 0; i <= 120; i++) peak = Math.max(peak, norm((i / 120) * d.hist.edges[d.hist.edges.length - 1]));
for (let i = 0; i <= 120; i++) {
  const v = (i / 120) * d.hist.edges[d.hist.edges.length - 1];
  const y = hy - (norm(v) / peak) * hh * (Math.max(...d.hist.counts) / maxCount);
  const x = hx + (i / 120) * hw;
  i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
}
ctx.stroke();
helpers.label('速さの分布（橙＝マクスウェル分布の理論曲線）', hx, hy + 22);
helpers.label('T = ' + d.T.toFixed(1) + ' K', hx, hy - hh - 10, { color: helpers.theme.ink });`,
  }),

  sim({
    slug: 'random-walk-diffusion',
    title: 'ランダムウォークと拡散',
    titleEn: 'Random walk and diffusion',
    category: 'statistical-physics',
    shortDescription: '多数の酔歩粒子から ⟨r²⟩ = 4Dt を実測し、拡散係数を読み取ります。',
    description:
      '二次元ランダムウォークを多数同時に走らせ、平均二乗変位の時間変化を測ります。' +
      '理論どおり ⟨r²⟩ は時間に比例し、その傾きから拡散係数 D = ⟨r²⟩/4t が求まります（2 次元の場合）。\n\n' +
      'バイアスを加えるとドリフト項が現れ、⟨r²⟩ は長時間で t² に比例するようになります。' +
      '粒子数を増やすほど統計誤差は 1/√N で小さくなり、直線へのフィットが安定します。',
    physicsTopics: ['ランダムウォーク', '拡散', 'ブラウン運動', '中心極限定理'],
    formulas: [
      { text: '⟨r²⟩ = 4 D t', note: '2 次元' },
      { text: 'D = ℓ² / 4τ' },
      { text: 'P(x,t) = exp(−x²/4Dt) / √(4πDt)' },
    ],
    tags: ['statistical-physics', 'random-walk', 'diffusion', 'monte-carlo', 'university-physics'],
    parameterDefinitions: [
      range('walkers', '粒子数', 400, 10, 3000, 10, { unit: '個', restart: true }),
      range('stepLength', '1 歩の長さ ℓ', 1, 0.1, 5, 0.1, { unit: '' }),
      range('stepsPerSecond', '1 秒あたりの歩数', 60, 5, 400, 5, { unit: '歩/s' }),
      range('bias', 'ドリフト（x方向）', 0, -0.9, 0.9, 0.01, { unit: '' }),
      range('seed', '乱数シード', 11, 1, 500, 1, { restart: true }),
    ],
    displayDefinitions: [
      read('t', '時間', 's', 2),
      read('steps', '歩数', '', 0),
      read('msd', '平均二乗変位 ⟨r²⟩', '', 3),
      read('diffusion', '拡散係数 D（実測）', '', 4),
      read('diffusionTheory', '拡散係数 D（理論）', '', 4),
      read('meanX', '平均位置 ⟨x⟩', '', 3),
    ],
    graphDefinitions: [
      timeGraph('msd', '平均二乗変位', [
        { key: 'msd', label: '⟨r²⟩ 実測', color: '#5ac8fa' },
        { key: 'msdTheory', label: '4Dt 理論', color: '#7d93a6' },
      ]),
      timeGraph('drift', '平均位置', [{ key: 'meanX', label: '⟨x⟩', color: '#ffb454' }]),
    ],
    runtimeOptions: { dt: 1 / 240, speed: 1, maxSubsteps: 60 },
    simulationCode: `
return {
  meta: { kind: 'Monte Carlo, seeded PRNG for reproducibility' },
  init(p) {
    const rnd = PL.rng(p.seed);
    return {
      rnd,
      xs: new Float64Array(p.walkers), ys: new Float64Array(p.walkers),
      steps: 0, acc: 0, history: [],
    };
  },
  step(s, dt, p) {
    s.acc += dt * p.stepsPerSecond;
    while (s.acc >= 1) {
      s.acc -= 1;
      for (let i = 0; i < s.xs.length; i++) {
        const a = s.rnd() * 2 * Math.PI;
        s.xs[i] += p.stepLength * (Math.cos(a) + p.bias);
        s.ys[i] += p.stepLength * Math.sin(a);
      }
      s.steps++;
    }
    return s;
  },
  sample(s, p, t) {
    let msd = 0, mx = 0;
    for (let i = 0; i < s.xs.length; i++) {
      msd += s.xs[i] * s.xs[i] + s.ys[i] * s.ys[i];
      mx += s.xs[i];
    }
    msd /= s.xs.length; mx /= s.xs.length;
    const rate = p.stepsPerSecond;
    const Dtheory = (p.stepLength * p.stepLength * rate) / 4;
    const scalars = {
      t, steps: s.steps, msd,
      diffusion: t > 0 ? msd / (4 * t) : 0,
      diffusionTheory: Dtheory,
      msdTheory: 4 * Dtheory * t,
      meanX: mx,
    };
    const extent = Math.max(10, Math.sqrt(msd) * 3);
    const show = Math.min(s.xs.length, 900);
    const pts = [];
    for (let i = 0; i < show; i++) pts.push([s.xs[i], s.ys[i]]);
    return { draw: { pts, extent }, scalars, series: scalars };
  },
};`,
    rendererCode: `
const d = frame.draw;
const R = d.extent;
const view = helpers.view({ xmin: -R, xmax: R, ymin: -R, ymax: R }, { pad: 10 });
helpers.grid(view, R / 4, R / 4);
helpers.axes(view);
ctx.fillStyle = 'rgba(90,200,250,0.55)';
for (const p0 of d.pts) {
  ctx.beginPath(); ctx.arc(view.x(p0[0]), view.y(p0[1]), 1.6, 0, 2 * Math.PI); ctx.fill();
}
// RMS radius circle.
let msd = 0;
for (const p0 of d.pts) msd += p0[0] * p0[0] + p0[1] * p0[1];
const rms = Math.sqrt(msd / Math.max(1, d.pts.length));
ctx.strokeStyle = '#ffb454'; ctx.setLineDash([5, 5]); ctx.lineWidth = 1.5;
ctx.beginPath(); ctx.arc(view.x(0), view.y(0), view.len(rms), 0, 2 * Math.PI); ctx.stroke();
ctx.setLineDash([]);
helpers.label('破線＝√⟨r²⟩', view.x(0) + view.len(rms) + 6, view.y(0), { color: '#ffb454' });`,
  }),
];
