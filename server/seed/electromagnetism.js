import { sim, range, toggle, choice, read, timeGraph, xyGraph } from './common.js';

export const electromagnetism = [
  sim({
    slug: 'electric-field-of-point-charges',
    title: '点電荷がつくる電場と電位',
    titleEn: 'Electric field and potential of point charges',
    category: 'electric-field',
    type: 'visualization',
    shortDescription: '電気力線・等電位線・電場ベクトルを、配置を変えながら描き分けます。',
    description:
      '複数の点電荷がつくる電場 E = Σ kq(r−rᵢ)/|r−rᵢ|³ と電位 V = Σ kq/|r−rᵢ| を格子上で計算して描画します。' +
      '電気力線は各電荷から等角度に出発させ、電場に沿って積分（RK4）して追跡しています。\n\n' +
      '双極子・四重極・平行平板の配置を切り替えると、遠方での電場の減衰の速さの違い（1/r²、1/r³、1/r⁴）と、' +
      '等電位線が常に電気力線と直交することが確認できます。',
    physicsTopics: ['電場', '電気力線', '電位', '等電位線', '電気双極子'],
    formulas: [
      { text: 'E = k Σ qᵢ (r − rᵢ) / |r − rᵢ|³' },
      { text: 'V = k Σ qᵢ / |r − rᵢ|' },
      { text: 'E = −∇V' },
    ],
    tags: ['electromagnetism', 'electric-field', 'visualization', '2d', 'high-school'],
    parameterDefinitions: [
      choice('layout', '電荷配置', 'dipole', [
        { value: 'single', label: '単一電荷' },
        { value: 'dipole', label: '双極子' },
        { value: 'same', label: '同符号の 2 電荷' },
        { value: 'quadrupole', label: '四重極' },
        { value: 'plates', label: '平行平板' },
      ], { restart: true }),
      range('charge', '電荷の大きさ q', 1, 0.1, 5, 0.1, { unit: 'nC' }),
      range('separation', '電荷間距離 d', 1.2, 0.3, 4, 0.05, { unit: 'm' }),
      range('lines', '電気力線の本数', 16, 4, 48, 2, { unit: '本/電荷' }),
      toggle('showPotential', '等電位線を描く', true),
      toggle('showVectors', '電場ベクトル格子を描く', false),
    ],
    displayDefinitions: [
      read('charges', '電荷の数', '', 0),
      read('totalCharge', '全電荷', 'nC', 3),
      read('dipoleMoment', '双極子モーメント', 'nC·m', 4),
      read('fieldAtOrigin', '原点の電場', 'N/C', 4),
      read('potentialAtOrigin', '原点の電位', 'V', 4),
    ],
    graphDefinitions: [
      xyGraph('potential-line', '中心軸上の電位 V(x)', { key: 'x', label: 'x', unit: 'm' }, [
        { key: 'V', label: 'V', color: '#ffb454' },
      ], { clearOnReset: true, maxPoints: 400 }),
    ],
    runtimeOptions: { dt: 1 / 60, maxSubsteps: 4 },
    simulationCode: `
// A static visualisation: the "step" only advances a scan line used for the
// V(x) profile graph, while the field itself is recomputed from the parameters.
const k = 8.9875517923e9 * 1e-9; // charges are supplied in nC
function layout(p) {
  const d = p.separation / 2;
  const q = p.charge;
  switch (p.layout) {
    case 'single': return [{ x: [0, 0], q }];
    case 'same': return [{ x: [-d, 0], q }, { x: [d, 0], q }];
    case 'quadrupole': return [
      { x: [-d, 0], q }, { x: [d, 0], q }, { x: [0, -d], q: -q }, { x: [0, d], q: -q },
    ];
    case 'plates': {
      const out = [];
      for (let i = 0; i < 9; i++) {
        const y = -1.6 + (i * 3.2) / 8;
        out.push({ x: [-d, y], q: q / 3 }, { x: [d, y], q: -q / 3 });
      }
      return out;
    }
    default: return [{ x: [-d, 0], q }, { x: [d, 0], q: -q }];
  }
}
function field(charges, x, y) {
  let ex = 0, ey = 0;
  for (const c of charges) {
    const dx = x - c.x[0], dy = y - c.x[1];
    const r2 = dx * dx + dy * dy + 1e-4;
    const f = (k * c.q) / (r2 * Math.sqrt(r2));
    ex += f * dx; ey += f * dy;
  }
  return [ex, ey];
}
function potential(charges, x, y) {
  let v = 0;
  for (const c of charges) v += (k * c.q) / Math.sqrt((x - c.x[0]) ** 2 + (y - c.x[1]) ** 2 + 1e-4);
  return v;
}
function traceLine(charges, start, sign, extent) {
  const pts = [start.slice()];
  let p0 = start.slice();
  for (let i = 0; i < 900; i++) {
    const deriv = (t, y) => {
      const e = field(charges, y[0], y[1]);
      const n = Math.hypot(e[0], e[1]) || 1;
      return [(sign * e[0]) / n, (sign * e[1]) / n];
    };
    p0 = PL.rk4(deriv, 0, p0, extent / 220);
    if (!isFinite(p0[0]) || Math.hypot(p0[0], p0[1]) > extent * 1.6) break;
    pts.push(p0.slice());
    if (charges.some((c) => Math.hypot(p0[0] - c.x[0], p0[1] - c.x[1]) < extent * 0.012)) break;
  }
  return pts;
}
return {
  meta: { kind: 'static field visualisation' },
  init(p) {
    const charges = layout(p);
    const extent = Math.max(3, p.separation * 2.2);
    const lines = [];
    for (const c of charges) {
      const n = Math.max(4, Math.round(p.lines * Math.min(1, Math.abs(c.q) / Math.max(0.001, p.charge))));
      for (let i = 0; i < n; i++) {
        const a = (2 * Math.PI * i) / n + 0.03;
        const r0 = extent * 0.02;
        const start = [c.x[0] + r0 * Math.cos(a), c.x[1] + r0 * Math.sin(a)];
        lines.push(traceLine(charges, start, Math.sign(c.q) || 1, extent));
      }
    }
    // Equipotential contours sampled on a grid and traced by marching squares.
    const N = 110;
    const grid = [];
    for (let j = 0; j <= N; j++) {
      const row = [];
      for (let i = 0; i <= N; i++) {
        row.push(potential(charges, -extent + (2 * extent * i) / N, -extent + (2 * extent * j) / N));
      }
      grid.push(row);
    }
    const vectors = [];
    const M = 17;
    for (let j = 0; j < M; j++) {
      for (let i = 0; i < M; i++) {
        const x = -extent + (2 * extent * (i + 0.5)) / M;
        const y = -extent + (2 * extent * (j + 0.5)) / M;
        const e = field(charges, x, y);
        vectors.push({ x, y, ex: e[0], ey: e[1], mag: Math.hypot(e[0], e[1]) });
      }
    }
    return { charges, lines, grid, N, extent, vectors, scan: 0, profile: [] };
  },
  step(s, dt, p) {
    // Sweep a probe along the x axis to build the V(x) graph, then stop.
    if (s.scan <= 1) {
      const x = -s.extent + 2 * s.extent * s.scan;
      s.profile.push([x, potential(s.charges, x, 0)]);
      s.scan += 0.004;
    }
    return s;
  },
  sample(s, p, t) {
    const totalQ = s.charges.reduce((a, c) => a + c.q, 0);
    const dip = s.charges.reduce((a, c) => a + c.q * c.x[0], 0);
    const e0 = field(s.charges, 0.001, 0.001);
    const last = s.profile[s.profile.length - 1] || [0, 0];
    return {
      draw: {
        charges: s.charges, lines: s.lines, grid: s.grid, N: s.N, extent: s.extent,
        vectors: s.vectors, showPotential: p.showPotential, showVectors: p.showVectors,
      },
      scalars: {
        charges: s.charges.length, totalCharge: totalQ, dipoleMoment: dip,
        fieldAtOrigin: Math.hypot(e0[0], e0[1]), potentialAtOrigin: potential(s.charges, 0.001, 0.001),
        x: last[0], V: last[1],
      },
      series: { x: last[0], V: last[1] },
      done: s.scan > 1,
    };
  },
};`,
    rendererCode: `
const d = frame.draw;
const R = d.extent;
const view = helpers.view({ xmin: -R, xmax: R, ymin: -R, ymax: R }, { pad: 8 });
// Equipotential contours via marching squares on the sampled grid.
if (d.showPotential) {
  const levels = [];
  for (let i = 1; i <= 9; i++) { const v = Math.pow(2, i) * 0.9; levels.push(v, -v); }
  ctx.lineWidth = 1;
  const cell = (2 * R) / d.N;
  for (const level of levels) {
    ctx.strokeStyle = level > 0 ? 'rgba(255,180,84,0.28)' : 'rgba(90,200,250,0.28)';
    ctx.beginPath();
    for (let j = 0; j < d.N; j++) {
      for (let i = 0; i < d.N; i++) {
        const x0 = -R + i * cell, y0 = -R + j * cell;
        const v = [d.grid[j][i], d.grid[j][i + 1], d.grid[j + 1][i + 1], d.grid[j + 1][i]];
        const corners = [[x0, y0], [x0 + cell, y0], [x0 + cell, y0 + cell], [x0, y0 + cell]];
        const pts = [];
        for (let e = 0; e < 4; e++) {
          const a = v[e], b = v[(e + 1) % 4];
          if ((a - level) * (b - level) < 0) {
            const f = (level - a) / (b - a);
            const ca = corners[e], cb = corners[(e + 1) % 4];
            pts.push([ca[0] + (cb[0] - ca[0]) * f, ca[1] + (cb[1] - ca[1]) * f]);
          }
        }
        if (pts.length === 2) {
          ctx.moveTo(view.x(pts[0][0]), view.y(pts[0][1]));
          ctx.lineTo(view.x(pts[1][0]), view.y(pts[1][1]));
        }
      }
    }
    ctx.stroke();
  }
}
// Field lines.
ctx.strokeStyle = 'rgba(219,230,240,0.75)'; ctx.lineWidth = 1.2;
for (const line of d.lines) {
  ctx.beginPath();
  line.forEach((pt, i) => (i ? ctx.lineTo(view.x(pt[0]), view.y(pt[1])) : ctx.moveTo(view.x(pt[0]), view.y(pt[1]))));
  ctx.stroke();
  // Direction arrow a third of the way along.
  const m = Math.floor(line.length / 3);
  if (line.length > 8) {
    const a = line[m], b = line[m + 1];
    ctx.fillStyle = 'rgba(219,230,240,0.8)';
    helpers.arrow(view.x(a[0]), view.y(a[1]), view.x(b[0]), view.y(b[1]), 5);
  }
}
if (d.showVectors) {
  const maxMag = Math.max(...d.vectors.map((v) => v.mag));
  for (const v of d.vectors) {
    const s = Math.min(1, Math.sqrt(v.mag / maxMag));
    if (s < 0.02) continue;
    const len = 16 * s;
    const n = v.mag || 1;
    ctx.strokeStyle = 'rgba(140,233,154,0.75)'; ctx.fillStyle = 'rgba(140,233,154,0.75)'; ctx.lineWidth = 1;
    helpers.arrow(view.x(v.x), view.y(v.y), view.x(v.x) + (v.ex / n) * len, view.y(v.y) - (v.ey / n) * len, 4);
  }
}
// Charges.
for (const c of d.charges) {
  const r = 5 + 5 * Math.min(1.6, Math.abs(c.q));
  ctx.fillStyle = c.q > 0 ? '#ff8fa3' : '#5ac8fa';
  ctx.beginPath(); ctx.arc(view.x(c.x[0]), view.y(c.x[1]), r, 0, 2 * Math.PI); ctx.fill();
  ctx.fillStyle = '#0b1016'; ctx.font = 'bold 13px "IBM Plex Sans", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(c.q > 0 ? '+' : '−', view.x(c.x[0]), view.y(c.x[1]) + 1);
}`,
  }),

  sim({
    slug: 'rc-circuit',
    title: 'RC回路の過渡現象',
    titleEn: 'RC circuit transients',
    category: 'circuits',
    shortDescription: 'コンデンサーの充電と放電。時定数 τ = RC を測定値から読み取れます。',
    description:
      'スイッチを閉じてからのコンデンサー電圧 V_C(t) = V₀(1 − e^{−t/RC}) と電流の指数減衰を数値積分で再現します。\n\n' +
      '時定数 τ = RC は「63.2% に達するまでの時間」として定義され、グラフ上に基準線として表示されます。' +
      '矩形波駆動に切り替えると充放電の繰り返しになり、τ が周期より長いか短いかで波形が積分器・微分器として振る舞う様子が見えます。',
    physicsTopics: ['RC回路', '過渡現象', '時定数', 'コンデンサー'],
    formulas: [
      { text: 'RC dV_C/dt + V_C = V_in' },
      { text: 'V_C(t) = V₀(1 − e^{−t/RC})', note: '充電' },
      { text: 'τ = RC', note: '63.2% に達する時間' },
    ],
    tags: ['electromagnetism', 'circuits', 'capacitor', 'transient', 'high-school'],
    parameterDefinitions: [
      range('V0', '電源電圧 V₀', 5, 0.1, 24, 0.1, { unit: 'V' }),
      range('R', '抵抗 R', 10000, 100, 1000000, 100, { unit: 'Ω' }),
      range('C', '静電容量 C', 10, 0.1, 1000, 0.1, { unit: 'µF' }),
      choice('drive', '入力', 'step', [
        { value: 'step', label: 'ステップ（充電）' },
        { value: 'square', label: '矩形波' },
        { value: 'discharge', label: '放電のみ' },
      ], { restart: true }),
      range('freq', '矩形波の周波数', 1, 0.05, 200, 0.05, { unit: 'Hz' }),
    ],
    displayDefinitions: [
      read('t', '時間', 's', 4),
      read('vc', 'コンデンサー電圧', 'V', 4),
      read('vr', '抵抗の電圧', 'V', 4),
      read('current', '電流', 'mA', 5),
      read('tau', '時定数 τ', 's', 5),
      read('charge', '電荷 Q', 'µC', 4),
      read('energy', '蓄えられたエネルギー', 'mJ', 5),
    ],
    graphDefinitions: [
      timeGraph('v-t', '電圧', [
        { key: 'vc', label: 'V_C', color: '#5ac8fa' },
        { key: 'vin', label: 'V_in', color: '#7d93a6' },
        { key: 'vr', label: 'V_R', color: '#ffb454' },
      ]),
      timeGraph('i-t', '電流', [{ key: 'current', label: 'I', color: '#8ce99a' }]),
    ],
    runtimeOptions: { dt: 1 / 20000, speed: 1 },
    simulationCode: `
return {
  meta: { integrator: 'RK4 on the first-order ODE' },
  init(p) {
    const C = p.C * 1e-6;
    return { vc: p.drive === 'discharge' ? p.V0 : 0, C, tAbs: 0 };
  },
  step(s, dt, p) {
    const C = p.C * 1e-6;
    const vin = p.drive === 'discharge' ? 0 : p.drive === 'square'
      ? (Math.sin(2 * Math.PI * p.freq * s.tAbs) >= 0 ? p.V0 : 0)
      : p.V0;
    const deriv = (t, y) => [(vin - y[0]) / (p.R * C)];
    s.vc = PL.rk4(deriv, 0, [s.vc], dt)[0];
    s.tAbs += dt;
    s.vin = vin;
    return s;
  },
  sample(s, p, t) {
    const C = p.C * 1e-6;
    const vin = s.vin === undefined ? p.V0 : s.vin;
    const vr = vin - s.vc;
    const i = vr / p.R;
    const scalars = {
      t, vc: s.vc, vin, vr, current: i * 1000, tau: p.R * C,
      charge: C * s.vc * 1e6, energy: 0.5 * C * s.vc * s.vc * 1000,
    };
    return { draw: { vc: s.vc, vin, vr, i, V0: p.V0, tau: p.R * C, t }, scalars, series: scalars };
  },
};`,
    rendererCode: `
const d = frame.draw;
const W = helpers.w, H = helpers.h;
const left = W * 0.14, right = W * 0.86, top = H * 0.22, bot = H * 0.78;
ctx.strokeStyle = helpers.theme.muted; ctx.lineWidth = 1.8;
ctx.beginPath();
ctx.moveTo(left, bot); ctx.lineTo(left, top); ctx.lineTo(right * 0.55, top);
ctx.moveTo(right * 0.72, top); ctx.lineTo(right, top); ctx.lineTo(right, bot * 0.92);
ctx.moveTo(right, bot); ctx.lineTo(left, bot);
ctx.stroke();
// Resistor.
ctx.strokeStyle = helpers.theme.trace[1]; ctx.lineWidth = 2;
ctx.beginPath();
const rx = right * 0.55, rw = right * 0.17;
ctx.moveTo(rx, top);
for (let i = 0; i < 6; i++) ctx.lineTo(rx + (rw * (i + 0.5)) / 6, top + (i % 2 ? 9 : -9));
ctx.lineTo(rx + rw, top); ctx.stroke();
helpers.label('R', rx + rw / 2, top - 16, { align: 'center', color: helpers.theme.trace[1] });
// Capacitor plates with a charge-proportional glow.
const fill = Math.min(1, Math.abs(d.vc) / Math.max(0.001, d.V0));
ctx.strokeStyle = helpers.theme.trace[0]; ctx.lineWidth = 3;
ctx.beginPath(); ctx.moveTo(right - 18, bot * 0.92); ctx.lineTo(right + 18, bot * 0.92); ctx.stroke();
ctx.beginPath(); ctx.moveTo(right - 18, bot * 0.92 + 12); ctx.lineTo(right + 18, bot * 0.92 + 12); ctx.stroke();
ctx.fillStyle = 'rgba(90,200,250,' + (0.1 + 0.5 * fill).toFixed(3) + ')';
ctx.fillRect(right - 18, bot * 0.92 + 1, 36, 11);
ctx.beginPath(); ctx.moveTo(right, bot * 0.92 + 12); ctx.lineTo(right, bot); ctx.stroke();
helpers.label('C  ' + d.vc.toFixed(3) + ' V', right + 26, bot * 0.92 + 8, { color: helpers.theme.trace[0] });
// Battery.
ctx.strokeStyle = helpers.theme.ink; ctx.lineWidth = 2.5;
ctx.beginPath(); ctx.moveTo(left - 12, (top + bot) / 2 - 8); ctx.lineTo(left + 12, (top + bot) / 2 - 8); ctx.stroke();
ctx.lineWidth = 1.2;
ctx.beginPath(); ctx.moveTo(left - 7, (top + bot) / 2 + 2); ctx.lineTo(left + 7, (top + bot) / 2 + 2); ctx.stroke();
helpers.label(d.vin.toFixed(2) + ' V', left - 60, (top + bot) / 2, { color: helpers.theme.ink });
// Current as moving dots around the loop.
const speed = Math.min(1, Math.abs(d.i) * 3e3);
const phase = (d.t * 0.8) % 1;
ctx.fillStyle = helpers.theme.trace[2];
for (let k = 0; k < 10; k++) {
  const f = (phase + k / 10) % 1;
  const x = left + (right - left) * f;
  ctx.globalAlpha = 0.25 + 0.75 * speed;
  ctx.beginPath(); ctx.arc(x, bot, 2.6, 0, 2 * Math.PI); ctx.fill();
}
ctx.globalAlpha = 1;
helpers.label('τ = ' + d.tau.toFixed(4) + ' s', 12, H - 12);`,
  }),

  sim({
    slug: 'rlc-resonance',
    title: 'RLC回路と共振',
    titleEn: 'RLC circuit and resonance',
    category: 'circuits',
    shortDescription: '減衰振動から共振曲線まで。臨界減衰の境目を R で行き来できます。',
    description:
      '直列 RLC 回路 L q¨ + R q˙ + q/C = V(t) を RK4 で解きます。過減衰・臨界減衰・不足減衰の三つの領域が ' +
      'R = 2√(L/C) を境に切り替わり、自由振動の波形がはっきり変わります。\n\n' +
      '正弦波駆動に切り替えて周波数を共振周波数 f₀ = 1/(2π√(LC)) に近づけると、電流振幅が最大になり ' +
      'インピーダンスが最小（= R）になることを読み取れます。',
    physicsTopics: ['RLC回路', '共振', '減衰振動', 'インピーダンス'],
    formulas: [
      { text: 'L q¨ + R q˙ + q/C = V(t)' },
      { text: 'f₀ = 1 / (2π√(LC))' },
      { text: 'Q = (1/R)√(L/C)' },
      { text: 'Z = √(R² + (ωL − 1/ωC)²)' },
    ],
    tags: ['electromagnetism', 'circuits', 'resonance', 'oscillation', 'university-physics'],
    difficulty: 3,
    targetLevel: 'undergraduate',
    parameterDefinitions: [
      range('R', '抵抗 R', 20, 0, 600, 1, { unit: 'Ω' }),
      range('L', 'インダクタンス L', 100, 1, 1000, 1, { unit: 'mH' }),
      range('C', '静電容量 C', 10, 0.1, 200, 0.1, { unit: 'µF' }),
      choice('drive', '駆動', 'free', [
        { value: 'free', label: '自由振動（初期電荷）' },
        { value: 'sine', label: '正弦波駆動' },
      ], { restart: true }),
      range('freq', '駆動周波数', 159, 1, 2000, 1, { unit: 'Hz' }),
      range('amplitude', '駆動電圧', 5, 0.1, 50, 0.1, { unit: 'V' }),
    ],
    displayDefinitions: [
      read('t', '時間', 's', 5),
      read('current', '電流 I', 'mA', 4),
      read('vc', 'V_C', 'V', 4),
      read('vl', 'V_L', 'V', 4),
      read('f0', '共振周波数 f₀', 'Hz', 3),
      read('Q', 'Q 値', '', 3),
      read('impedance', 'インピーダンス |Z|', 'Ω', 3),
      read('regime', '減衰（1不足/2臨界/3過）', '', 0),
    ],
    graphDefinitions: [
      timeGraph('i-t', '電流', [{ key: 'current', label: 'I', color: '#5ac8fa' }]),
      timeGraph('v-t', '素子電圧', [
        { key: 'vc', label: 'V_C', color: '#ffb454' },
        { key: 'vl', label: 'V_L', color: '#8ce99a' },
        { key: 'vr', label: 'V_R', color: '#c0a6ff' },
      ]),
      xyGraph('phase', '位相空間 I–Q', { key: 'charge', label: 'Q', unit: 'µC' }, [
        { key: 'current', label: 'I', color: '#ff8fa3' },
      ]),
    ],
    runtimeOptions: { dt: 1 / 200000, speed: 0.15 },
    simulationCode: `
return {
  meta: { integrator: 'RK4' },
  init(p) {
    const C = p.C * 1e-6;
    return { y: [p.drive === 'free' ? C * p.amplitude : 0, 0], tAbs: 0, peak: 0 };
  },
  step(s, dt, p) {
    const L = p.L * 1e-3, C = p.C * 1e-6;
    const deriv = (t, y) => {
      const v = p.drive === 'sine' ? p.amplitude * Math.sin(2 * Math.PI * p.freq * (s.tAbs + t)) : 0;
      return [y[1], (v - p.R * y[1] - y[0] / C) / L];
    };
    s.y = PL.rk4(deriv, 0, s.y, dt);
    s.tAbs += dt;
    s.peak = Math.max(s.peak * 0.9999, Math.abs(s.y[1]));
    return s;
  },
  sample(s, p, t) {
    const L = p.L * 1e-3, C = p.C * 1e-6;
    const w = 2 * Math.PI * p.freq;
    const f0 = 1 / (2 * Math.PI * Math.sqrt(L * C));
    const Rc = 2 * Math.sqrt(L / C);
    const scalars = {
      t, charge: s.y[0] * 1e6, current: s.y[1] * 1000,
      vc: s.y[0] / C, vr: p.R * s.y[1],
      vl: (p.drive === 'sine' ? p.amplitude * Math.sin(w * s.tAbs) : 0) - p.R * s.y[1] - s.y[0] / C,
      f0, Q: p.R > 0 ? (1 / p.R) * Math.sqrt(L / C) : Infinity,
      impedance: Math.sqrt(p.R * p.R + (w * L - 1 / (w * C)) ** 2),
      regime: p.R < Rc * 0.999 ? 1 : p.R > Rc * 1.001 ? 3 : 2,
      peakCurrent: s.peak * 1000,
    };
    if (!isFinite(scalars.Q)) scalars.Q = 0;
    return { draw: { i: s.y[1], q: s.y[0], C, peak: Math.max(s.peak, 1e-6), regime: scalars.regime, f0, freq: p.freq }, scalars, series: scalars };
  },
};`,
    rendererCode: `
const d = frame.draw;
const W = helpers.w, H = helpers.h;
const y0 = H * 0.55;
// Schematic loop.
ctx.strokeStyle = helpers.theme.muted; ctx.lineWidth = 1.6;
ctx.strokeRect(W * 0.12, H * 0.22, W * 0.76, H * 0.46);
const label = (x, text, color) => helpers.label(text, x, H * 0.18, { align: 'center', color: color || helpers.theme.muted });
label(W * 0.3, 'R'); label(W * 0.5, 'L'); label(W * 0.7, 'C');
// Element glyphs along the top edge.
const topY = H * 0.22;
ctx.strokeStyle = helpers.theme.trace[1]; ctx.lineWidth = 2;
ctx.beginPath();
for (let i = 0; i <= 6; i++) ctx.lineTo(W * 0.26 + (W * 0.08 * i) / 6, topY + (i % 2 ? 8 : -8));
ctx.stroke();
ctx.strokeStyle = helpers.theme.trace[2];
ctx.beginPath();
for (let i = 0; i < 4; i++) ctx.arc(W * 0.46 + i * W * 0.021 + W * 0.01, topY, W * 0.011, Math.PI, 0);
ctx.stroke();
ctx.strokeStyle = helpers.theme.trace[0]; ctx.lineWidth = 3;
ctx.beginPath(); ctx.moveTo(W * 0.7, topY - 12); ctx.lineTo(W * 0.7, topY + 12); ctx.stroke();
ctx.beginPath(); ctx.moveTo(W * 0.72, topY - 12); ctx.lineTo(W * 0.72, topY + 12); ctx.stroke();
// Live current trace drawn as a needle gauge plus a bar.
const rel = Math.max(-1, Math.min(1, d.i / (d.peak || 1)));
ctx.fillStyle = rel >= 0 ? helpers.theme.trace[0] : helpers.theme.trace[3];
ctx.fillRect(W / 2, H * 0.8, (W * 0.34) * rel, 16);
ctx.strokeStyle = helpers.theme.gridStrong;
ctx.beginPath(); ctx.moveTo(W / 2, H * 0.78); ctx.lineTo(W / 2, H * 0.86); ctx.stroke();
helpers.label('電流 ' + (d.i * 1000).toFixed(3) + ' mA', 12, H * 0.78 - 6, { color: helpers.theme.ink });
const names = ['', '不足減衰', '臨界減衰', '過減衰'];
helpers.label(names[d.regime] + '  ｜  f₀ = ' + d.f0.toFixed(2) + ' Hz', 12, H - 12);`,
  }),

  sim({
    slug: 'charged-particle-em-fields',
    title: '電磁場中の荷電粒子',
    titleEn: 'Charged particle in E and B fields',
    category: 'magnetic-field',
    shortDescription: 'ローレンツ力による円運動・らせん運動・E×Bドリフトを 3D で描きます。',
    description:
      'Boris 法（プラズマ計算の標準的な粒子プッシャー）で運動方程式 m dv/dt = q(E + v×B) を解きます。' +
      'Boris 法は純粋な磁場中では運動エネルギーを厳密に保存するため、何万周回しても半径が縮みません。\n\n' +
      '磁場だけならサイクロトロン円運動、初速に磁場方向成分があればらせん運動、直交する電場を加えると ' +
      'v_drift = E×B/B² のドリフトが現れます。回転角を変えて 3 次元的な軌道を確認してください。',
    physicsTopics: ['ローレンツ力', 'サイクロトロン運動', 'らせん運動', 'E×Bドリフト'],
    formulas: [
      { text: 'm dv/dt = q(E + v × B)' },
      { text: 'r = mv⊥ / |q|B', note: 'ラーモア半径' },
      { text: 'f_c = |q|B / 2πm', note: 'サイクロトロン周波数' },
      { text: 'v_drift = E × B / B²' },
    ],
    tags: ['electromagnetism', 'magnetic-field', 'lorentz-force', '3d', 'plasma', 'university-physics'],
    difficulty: 3,
    targetLevel: 'undergraduate',
    parameterDefinitions: [
      range('Bz', '磁場 B_z', 0.01, -0.05, 0.05, 0.0005, { unit: 'T' }),
      range('Ex', '電場 E_x', 0, -2000, 2000, 10, { unit: 'V/m' }),
      range('vx', '初速 v_x', 100000, -1e6, 1e6, 10000, { unit: 'm/s', restart: true }),
      range('vz', '初速 v_z（磁場方向）', 40000, -1e6, 1e6, 10000, { unit: 'm/s', restart: true }),
      choice('species', '粒子', 'electron', [
        { value: 'electron', label: '電子' },
        { value: 'proton', label: '陽子' },
        { value: 'alpha', label: 'α粒子' },
      ], { restart: true }),
      range('yaw', '視点の回転', 0.6, -3.14, 3.14, 0.02, { unit: 'rad' }),
      range('pitch', '視点の傾き', 0.35, -1.4, 1.4, 0.02, { unit: 'rad' }),
    ],
    displayDefinitions: [
      read('t', '時間', 's', 8),
      read('speed', '速さ', 'm/s', 0),
      read('larmorRadius', 'ラーモア半径', 'm', 5),
      read('cyclotronFreq', 'サイクロトロン周波数', 'Hz', 1),
      read('kineticEnergy', '運動エネルギー', 'eV', 2),
      read('driftSpeed', 'E×B ドリフト速度', 'm/s', 2),
    ],
    graphDefinitions: [
      xyGraph('xy', '断面 y–x', { key: 'x', label: 'x', unit: 'm' }, [{ key: 'y', label: 'y', color: '#5ac8fa' }]),
      timeGraph('energy', '運動エネルギー（Boris法は保存する）', [
        { key: 'kineticEnergy', label: 'K', color: '#8ce99a' },
      ]),
    ],
    runtimeOptions: { dt: 2e-11, speed: 1e-7 },
    simulationCode: `
const SPECIES = {
  electron: { q: -1.602176634e-19, m: 9.1093837015e-31 },
  proton: { q: 1.602176634e-19, m: 1.67262192369e-27 },
  alpha: { q: 2 * 1.602176634e-19, m: 6.6446573e-27 },
};
return {
  meta: { integrator: 'Boris pusher (energy conserving in pure B)' },
  init(p) {
    const sp = SPECIES[p.species] || SPECIES.electron;
    return { x: [0, 0, 0], v: [p.vx, 0, p.vz], sp, trail: [], k0: null };
  },
  step(s, dt, p) {
    const E = [p.Ex, 0, 0];
    const B = [0, 0, p.Bz];
    const r = PL.borisPush(s.x, s.v, s.sp.q / s.sp.m, E, B, dt);
    s.x = r.x; s.v = r.v;
    return s;
  },
  sample(s, p, t) {
    const last = s.trail[s.trail.length - 1];
    if (!last || PL.vec.dist(s.x, last) > 1e-4) {
      s.trail.push(s.x.slice());
      if (s.trail.length > 2600) s.trail.shift();
    }
    const v = PL.vec.norm(s.v);
    const vperp = Math.hypot(s.v[0], s.v[1]);
    const B = Math.abs(p.Bz);
    const k = 0.5 * s.sp.m * v * v;
    const scalars = {
      t, x: s.x[0], y: s.x[1], z: s.x[2], speed: v,
      larmorRadius: B > 0 ? (s.sp.m * vperp) / (Math.abs(s.sp.q) * B) : 0,
      cyclotronFreq: B > 0 ? (Math.abs(s.sp.q) * B) / (2 * Math.PI * s.sp.m) : 0,
      kineticEnergy: k / 1.602176634e-19,
      driftSpeed: B > 0 ? Math.abs(p.Ex) / B : 0,
    };
    const extent = Math.max(1e-3, ...s.trail.map((q) => Math.max(Math.abs(q[0]), Math.abs(q[1]), Math.abs(q[2]))));
    return { draw: { trail: s.trail, x: s.x, extent: extent * 1.2, yaw: p.yaw, pitch: p.pitch, Bz: p.Bz, Ex: p.Ex }, scalars, series: scalars };
  },
};`,
    rendererCode: `
const d = frame.draw;
const R = d.extent;
const view = helpers.view({ xmin: -R, xmax: R, ymin: -R, ymax: R }, { pad: 16 });
const opts = { yaw: d.yaw, pitch: d.pitch };
const P = (p) => { const q = helpers.project3D(p, opts); return [view.x(q[0]), view.y(q[1]), q[2]]; };
// Axes.
const axes = [[[R, 0, 0], 'x'], [[0, R, 0], 'y'], [[0, 0, R], 'z (B)']];
ctx.lineWidth = 1;
for (const [ax, name] of axes) {
  const a = P([0, 0, 0]), b = P(ax);
  ctx.strokeStyle = 'rgba(120,150,175,0.45)'; ctx.fillStyle = 'rgba(120,150,175,0.45)';
  helpers.arrow(a[0], a[1], b[0], b[1], 5);
  helpers.label(name, b[0] + 4, b[1] - 4);
}
// Trail, shaded by depth so the helix reads as 3D.
for (let i = 1; i < d.trail.length; i++) {
  const a = P(d.trail[i - 1]), b = P(d.trail[i]);
  const depth = (b[2] / R + 1) / 2;
  ctx.strokeStyle = 'rgba(90,200,250,' + (0.15 + 0.8 * depth).toFixed(3) + ')';
  ctx.lineWidth = 0.8 + 1.8 * depth;
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
}
const here = P(d.x);
ctx.fillStyle = '#ffffff';
ctx.beginPath(); ctx.arc(here[0], here[1], 4.5, 0, 2 * Math.PI); ctx.fill();
helpers.label('B_z = ' + d.Bz.toFixed(4) + ' T   E_x = ' + d.Ex.toFixed(0) + ' V/m', 12, helpers.h - 12);`,
  }),

  sim({
    slug: 'faraday-induction',
    title: '電磁誘導：コイルを通る磁石',
    titleEn: 'Faraday induction: magnet through a coil',
    category: 'induction',
    shortDescription: '磁石を落とすと誘導起電力が生じ、レンツの法則どおりに磁石が減速します。',
    description:
      'コイルを貫く磁束 Φ(z) を磁気双極子モデルで計算し、EMF = −N dΦ/dt から誘導起電力を求めます。' +
      'コイルが閉回路なら電流 I = EMF/R が流れ、その電流が磁石に及ぼす力は必ず運動を妨げる向き（レンツの法則）になります。\n\n' +
      '回路を開くと EMF は発生しても電流は流れず、磁石は自由落下します。二つを比べると、' +
      '磁気ブレーキがエネルギーを抵抗で熱に変えていることが分かります。',
    physicsTopics: ['電磁誘導', 'ファラデーの法則', 'レンツの法則', '磁気ブレーキ'],
    formulas: [
      { text: 'EMF = −N dΦ/dt' },
      { text: 'Φ(z) = µ₀ m a² / 2(a² + z²)^{3/2}', note: '双極子がつくる円形コイル内の磁束' },
      { text: 'F = I dΦ/dz', note: '磁石が受ける反作用' },
    ],
    tags: ['electromagnetism', 'induction', 'lenz-law', 'energy', 'high-school'],
    parameterDefinitions: [
      range('magnetMoment', '磁気モーメント m', 2, 0.1, 20, 0.1, { unit: 'A·m²' }),
      range('turns', 'コイルの巻数 N', 400, 10, 3000, 10, { unit: '回' }),
      range('radius', 'コイル半径 a', 0.03, 0.005, 0.15, 0.001, { unit: 'm' }),
      range('resistance', '回路抵抗 R', 5, 0.1, 200, 0.1, { unit: 'Ω' }),
      range('mass', '磁石の質量', 0.05, 0.005, 0.5, 0.005, { unit: 'kg' }),
      range('startHeight', '落下開始位置', 0.25, 0.05, 1, 0.01, { unit: 'm', restart: true }),
      toggle('closed', '回路を閉じる', true),
    ],
    displayDefinitions: [
      read('t', '時間', 's', 3),
      read('z', '磁石の位置', 'm', 4),
      read('v', '速度', 'm/s', 4),
      read('flux', '磁束 Φ', 'Wb', 8),
      read('emf', '誘導起電力', 'V', 5),
      read('current', '誘導電流', 'A', 5),
      read('dissipated', '抵抗で失われた熱', 'mJ', 4),
    ],
    graphDefinitions: [
      timeGraph('emf', '誘導起電力', [{ key: 'emf', label: 'EMF', color: '#ffb454' }]),
      timeGraph('kinematics', '位置と速度', [
        { key: 'z', label: 'z', color: '#5ac8fa' },
        { key: 'v', label: 'v', color: '#8ce99a' },
      ]),
      timeGraph('flux', '磁束', [{ key: 'flux', label: 'Φ', color: '#c0a6ff' }]),
    ],
    runtimeOptions: { dt: 1 / 20000 },
    simulationCode: `
const MU0 = 4 * Math.PI * 1e-7;
return {
  meta: { integrator: 'RK4 with analytic dPhi/dz' },
  init(p) { return { z: p.startHeight, v: 0, heat: 0, emf: 0, i: 0 }; },
  step(s, dt, p) {
    const a = p.radius;
    const flux = (z) => (MU0 * p.magnetMoment * a * a) / (2 * Math.pow(a * a + z * z, 1.5));
    const dFluxDz = (z) => (-3 * MU0 * p.magnetMoment * a * a * z) / (2 * Math.pow(a * a + z * z, 2.5));
    const deriv = (t, y) => {
      const [z, v] = y;
      const emf = -p.turns * dFluxDz(z) * v;
      const i = p.closed ? emf / p.resistance : 0;
      // Reaction force on the magnet: always opposes the change (Lenz).
      const F = p.turns * i * dFluxDz(z);
      return [v, -9.80665 + F / p.mass];
    };
    const y = PL.rk4(deriv, 0, [s.z, s.v], dt);
    s.z = y[0]; s.v = y[1];
    s.emf = -p.turns * dFluxDz(s.z) * s.v;
    s.i = p.closed ? s.emf / p.resistance : 0;
    s.heat += s.i * s.i * p.resistance * dt;
    s.flux = flux(s.z);
    if (s.z < -p.startHeight) { s.z = -p.startHeight; s.v = 0; }
    return s;
  },
  sample(s, p, t) {
    const scalars = {
      t, z: s.z, v: s.v, flux: s.flux || 0, emf: s.emf, current: s.i,
      dissipated: s.heat * 1000,
      kinetic: 0.5 * p.mass * s.v * s.v,
    };
    return { draw: { z: s.z, v: s.v, i: s.i, emf: s.emf, span: p.startHeight, a: p.radius, closed: p.closed }, scalars, series: scalars };
  },
};`,
    rendererCode: `
const d = frame.draw;
const view = helpers.view({ xmin: -d.span * 0.8, xmax: d.span * 0.8, ymin: -d.span, ymax: d.span }, { pad: 22 });
const cx = view.x(0);
// Coil seen edge-on.
const coilY = view.y(0), cw = view.len(d.a);
ctx.strokeStyle = d.closed ? helpers.theme.trace[1] : 'rgba(125,147,166,0.7)';
ctx.lineWidth = 3;
ctx.beginPath(); ctx.ellipse(cx, coilY, cw, cw * 0.28, 0, 0, 2 * Math.PI); ctx.stroke();
if (!d.closed) {
  ctx.strokeStyle = helpers.theme.bg === 'transparent' ? '#0b1016' : helpers.theme.bg;
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(cx + cw * 0.85, coilY - 6); ctx.lineTo(cx + cw * 1.1, coilY + 6); ctx.stroke();
}
// Induced current indicator.
if (d.closed && Math.abs(d.i) > 1e-9) {
  const glow = Math.min(0.8, Math.abs(d.i) * 6);
  ctx.strokeStyle = 'rgba(140,233,154,' + glow.toFixed(3) + ')';
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.ellipse(cx, coilY, cw, cw * 0.28, 0, 0, 2 * Math.PI); ctx.stroke();
}
// Magnet.
const my = view.y(d.z);
ctx.fillStyle = '#ff8fa3'; ctx.fillRect(cx - 9, my - 22, 18, 22);
ctx.fillStyle = '#5ac8fa'; ctx.fillRect(cx - 9, my, 18, 22);
ctx.fillStyle = '#0b1016'; ctx.font = 'bold 11px "IBM Plex Sans", sans-serif'; ctx.textAlign = 'center';
ctx.fillText('N', cx, my - 8); ctx.fillText('S', cx, my + 15);
ctx.strokeStyle = helpers.theme.trace[0]; ctx.fillStyle = helpers.theme.trace[0]; ctx.lineWidth = 1.6;
helpers.arrow(cx + 26, my, cx + 26, my - d.v * 12, 6);
helpers.label('EMF ' + d.emf.toFixed(4) + ' V', 12, 20, { color: helpers.theme.trace[1] });
helpers.label(d.closed ? '閉回路：誘導電流が磁石を減速させる' : '開回路：電流は流れず自由落下', 12, helpers.h - 12);`,
  }),
];
