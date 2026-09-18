import { sim, num, range, toggle, choice, read, timeGraph, xyGraph } from './common.js';

export const mechanics = [
  sim({
    slug: 'free-fall-with-air-resistance',
    title: '自由落下と終端速度',
    titleEn: 'Free fall and terminal velocity',
    category: 'mechanics',
    shortDescription: '真空中の落下と、速度の二乗に比例する空気抵抗を受ける落下を並べて比較します。',
    description:
      '同じ高さから同時に落とした二つの物体を追跡します。左は抵抗なし、右は空気抵抗 F = -k v|v| を受けます。\n\n' +
      '抵抗のある側は速度が終端速度 v_t = sqrt(mg/k) に漸近し、v-t グラフは指数的に平坦になります。' +
      '抵抗係数を 0 に近づけると二つの軌跡は重なり、Δy グラフが 0 に戻ります。',
    physicsTopics: ['自由落下', '空気抵抗', '終端速度', '運動方程式'],
    formulas: [
      { text: 'm dv/dt = -mg - k v|v|', note: '下向き正で符号反転' },
      { text: 'v_terminal = sqrt(m g / k)' },
      { text: 'v(t) = -v_t tanh(g t / v_t)', note: '静止から落下する場合の解析解' },
    ],
    tags: ['mechanics', 'kinematics', 'air-resistance', '1d', 'high-school'],
    difficulty: 1,
    parameterDefinitions: [
      range('h0', '初期高度 h₀', 120, 5, 500, 5, { unit: 'm', restart: true }),
      range('mass', '質量 m', 2, 0.1, 20, 0.1, { unit: 'kg' }),
      range('k', '抵抗係数 k', 0.08, 0, 2, 0.005, { unit: 'kg/m', help: 'F = k v² の比例定数' }),
      range('g', '重力加速度 g', 9.80665, 1, 30, 0.01, { unit: 'm/s²' }),
    ],
    displayDefinitions: [
      read('t', '経過時間', 's', 3),
      read('yFree', '高度（抵抗なし）', 'm', 2),
      read('yDrag', '高度（抵抗あり）', 'm', 2),
      read('vFree', '速度（抵抗なし）', 'm/s', 2),
      read('vDrag', '速度（抵抗あり）', 'm/s', 2),
      read('vTerminal', '終端速度', 'm/s', 2),
      read('fractionOfTerminal', '終端速度比', '', 3),
    ],
    graphDefinitions: [
      timeGraph('y-t', '高度 y–t', [
        { key: 'yFree', label: '抵抗なし', color: '#5ac8fa' },
        { key: 'yDrag', label: '抵抗あり', color: '#ffb454' },
      ]),
      timeGraph('v-t', '速度 v–t', [
        { key: 'vFree', label: '抵抗なし', color: '#5ac8fa' },
        { key: 'vDrag', label: '抵抗あり', color: '#ffb454' },
        { key: 'vTerminal', label: '終端速度', color: '#7d93a6' },
      ]),
      timeGraph('a-t', '加速度 a–t', [{ key: 'aDrag', label: '抵抗あり', color: '#8ce99a' }]),
    ],
    runtimeOptions: { dt: 1 / 2000, speed: 1 },
    simulationCode: `
// Two independent bodies integrated with RK4 so that the drag term (which is
// velocity dependent) is handled to fourth order rather than first.
const { rk4 } = PL;
return {
  meta: { integrator: 'RK4' },
  init(p) {
    return { free: [p.h0, 0], drag: [p.h0, 0], landedFree: false, landedDrag: false, aDrag: -p.g };
  },
  step(s, dt, p) {
    const dFree = (t, y) => [y[1], -p.g];
    const dDrag = (t, y) => {
      const v = y[1];
      return [v, -p.g - (p.k * v * Math.abs(v)) / p.mass];
    };
    if (!s.landedFree) {
      s.free = rk4(dFree, 0, s.free, dt);
      if (s.free[0] <= 0) { s.free = [0, 0]; s.landedFree = true; }
    }
    if (!s.landedDrag) {
      s.drag = rk4(dDrag, 0, s.drag, dt);
      s.aDrag = -p.g - (p.k * s.drag[1] * Math.abs(s.drag[1])) / p.mass;
      if (s.drag[0] <= 0) { s.drag = [0, 0]; s.landedDrag = true; s.aDrag = 0; }
    }
    return s;
  },
  sample(s, p, t) {
    const vT = p.k > 0 ? Math.sqrt((p.mass * p.g) / p.k) : Infinity;
    const scalars = {
      t,
      yFree: s.free[0], yDrag: s.drag[0],
      vFree: s.free[1], vDrag: s.drag[1],
      aDrag: s.aDrag,
      vTerminal: p.k > 0 ? -vT : 0,
      fractionOfTerminal: p.k > 0 ? Math.abs(s.drag[1]) / vT : 0,
      gap: s.drag[0] - s.free[0],
    };
    return {
      draw: { free: s.free, drag: s.drag, h0: p.h0, vT },
      scalars,
      series: scalars,
      done: s.landedFree && s.landedDrag,
    };
  },
};`,
    rendererCode: `
const d = frame.draw;
const view = helpers.view({ xmin: -1, xmax: 1, ymin: 0, ymax: d.h0 * 1.05 }, { stretch: true, pad: 24 });
helpers.grid(view, 0.25, d.h0 / 8);
const lanes = [[-0.45, d.free, helpers.theme.trace[0], '抵抗なし'], [0.45, d.drag, helpers.theme.trace[1], '抵抗あり']];
ctx.lineWidth = 2;
for (const [x, body, color, label] of lanes) {
  ctx.strokeStyle = 'rgba(120,150,175,0.35)';
  ctx.beginPath(); ctx.moveTo(view.x(x), view.y(0)); ctx.lineTo(view.x(x), view.y(d.h0)); ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(view.x(x), view.y(body[0]), 9, 0, 2 * Math.PI); ctx.fill();
  helpers.label(label, view.x(x), view.y(d.h0) - 10, { align: 'center', color });
  helpers.label(body[0].toFixed(1) + ' m', view.x(x) + 14, view.y(body[0]) + 4, { color: helpers.theme.ink });
  ctx.strokeStyle = color; ctx.fillStyle = color;
  helpers.arrow(view.x(x), view.y(body[0]), view.x(x), view.y(body[0]) - Math.min(70, Math.abs(body[1]) * 2.2), 6);
}
ctx.strokeStyle = 'rgba(200,220,235,0.5)';
ctx.beginPath(); ctx.moveTo(0, view.y(0)); ctx.lineTo(helpers.w, view.y(0)); ctx.stroke();`,
  }),

  sim({
    slug: 'projectile-motion',
    title: '斜方投射',
    titleEn: 'Projectile motion',
    category: 'mechanics',
    shortDescription: '初速・角度・空気抵抗を変えて放物運動を追い、理想放物線とのずれを見ます。',
    description:
      '抵抗なしの理想軌道（破線）と、実際に積分された軌道（実線）を同時に描きます。' +
      '抵抗が 0 のとき両者は完全に一致し、射程は最大 v₀²sin2θ/g、最適角度は 45° になります。' +
      '抵抗を加えると軌道は前後非対称になり、最適角度は 45° より小さくなります。',
    physicsTopics: ['放物運動', '水平投射', '空気抵抗', '射程'],
    formulas: [
      { text: 'R = v₀² sin(2θ) / g', note: '抵抗なしの射程' },
      { text: 'H = v₀² sin²θ / (2g)' },
      { text: 'm dv/dt = m g - k |v| v' },
    ],
    tags: ['mechanics', 'kinematics', '2d', 'air-resistance', 'high-school'],
    parameterDefinitions: [
      range('v0', '初速 v₀', 30, 1, 120, 0.5, { unit: 'm/s', restart: true }),
      range('angle', '仰角 θ', 45, 0, 90, 0.5, { unit: '°', restart: true }),
      range('h0', '発射高さ', 0, 0, 100, 0.5, { unit: 'm', restart: true }),
      range('mass', '質量 m', 0.15, 0.01, 10, 0.01, { unit: 'kg' }),
      range('k', '抵抗係数 k', 0, 0, 0.5, 0.002, { unit: 'kg/m' }),
      range('g', '重力加速度 g', 9.80665, 1, 30, 0.01, { unit: 'm/s²' }),
    ],
    displayDefinitions: [
      read('t', '飛行時間', 's', 3),
      read('x', '水平距離', 'm', 2),
      read('y', '高度', 'm', 2),
      read('speed', '速さ', 'm/s', 2),
      read('range', '着地点', 'm', 2),
      read('idealRange', '理論射程（抵抗なし）', 'm', 2),
      read('apex', '最高点', 'm', 2),
      read('energy', '力学的エネルギー', 'J', 3),
    ],
    graphDefinitions: [
      xyGraph('trajectory', '軌道 y–x', { key: 'x', label: '水平距離', unit: 'm' }, [
        { key: 'y', label: '高度', color: '#5ac8fa' },
      ]),
      timeGraph('v-t', '速度成分 v–t', [
        { key: 'vx', label: 'vₓ', color: '#5ac8fa' },
        { key: 'vy', label: 'v_y', color: '#ffb454' },
      ]),
      timeGraph('energy', 'エネルギー', [
        { key: 'ke', label: '運動', color: '#5ac8fa' },
        { key: 'pe', label: '位置', color: '#ffb454' },
        { key: 'energy', label: '合計', color: '#8ce99a' },
      ]),
    ],
    runtimeOptions: { dt: 1 / 2000 },
    simulationCode: `
const { rk4 } = PL;
return {
  meta: { integrator: 'RK4', notes: 'Landing is found by linear interpolation on the final step.' },
  init(p) {
    const a = (p.angle * Math.PI) / 180;
    return {
      y: [0, p.h0, p.v0 * Math.cos(a), p.v0 * Math.sin(a)],
      trail: [[0, p.h0]],
      landed: false, range: 0, apex: p.h0,
    };
  },
  step(s, dt, p) {
    if (s.landed) return s;
    const deriv = (t, y) => {
      const sp = Math.hypot(y[2], y[3]);
      const f = (p.k * sp) / p.mass;
      return [y[2], y[3], -f * y[2], -p.g - f * y[3]];
    };
    const next = rk4(deriv, 0, s.y, dt);
    if (next[1] < 0 && s.y[1] >= 0) {
      const f = s.y[1] / (s.y[1] - next[1]);
      const hit = s.y.map((v, i) => v + (next[i] - v) * f);
      s.y = hit; s.landed = true; s.range = hit[0];
    } else {
      s.y = next;
    }
    s.apex = Math.max(s.apex, s.y[1]);
    const last = s.trail[s.trail.length - 1];
    if (Math.hypot(s.y[0] - last[0], s.y[1] - last[1]) > 0.05) {
      s.trail.push([s.y[0], s.y[1]]);
      if (s.trail.length > 4000) s.trail.shift();
    }
    return s;
  },
  sample(s, p, t) {
    const [x, y, vx, vy] = s.y;
    const speed = Math.hypot(vx, vy);
    const a = (p.angle * Math.PI) / 180;
    const idealRange =
      (p.v0 * Math.cos(a) * (p.v0 * Math.sin(a) + Math.sqrt(Math.max(0, (p.v0 * Math.sin(a)) ** 2 + 2 * p.g * p.h0)))) / p.g;
    const ke = 0.5 * p.mass * speed * speed;
    const pe = p.mass * p.g * y;
    const scalars = { t, x, y, vx, vy, speed, ke, pe, energy: ke + pe, range: s.range, apex: s.apex, idealRange };
    return {
      draw: { trail: s.trail, x, y, vx, vy, v0: p.v0, angle: p.angle, g: p.g, h0: p.h0, idealRange, apex: s.apex },
      scalars, series: scalars, done: s.landed,
    };
  },
};`,
    rendererCode: `
const d = frame.draw;
const a = (d.angle * Math.PI) / 180;
const span = Math.max(d.idealRange * 1.15, 10);
const top = Math.max(d.apex * 1.3, (d.v0 * d.v0) / (2 * d.g) * 0.6, 5);
const view = helpers.view({ xmin: -span * 0.04, xmax: span, ymin: -top * 0.08, ymax: top }, { stretch: true, pad: 26 });
helpers.grid(view, span / 8, top / 6);
// Ideal (drag-free) parabola for comparison.
ctx.save();
ctx.setLineDash([5, 5]); ctx.strokeStyle = 'rgba(125,147,166,0.85)'; ctx.lineWidth = 1.4;
ctx.beginPath();
for (let i = 0; i <= 160; i++) {
  const tt = (i / 160) * (2 * (d.v0 * Math.sin(a)) / d.g + 1.4);
  const xx = d.v0 * Math.cos(a) * tt;
  const yy = d.h0 + d.v0 * Math.sin(a) * tt - 0.5 * d.g * tt * tt;
  if (yy < 0) break;
  i === 0 ? ctx.moveTo(view.x(xx), view.y(yy)) : ctx.lineTo(view.x(xx), view.y(yy));
}
ctx.stroke(); ctx.restore();
// Ground.
ctx.strokeStyle = 'rgba(200,220,235,0.55)'; ctx.lineWidth = 1.5;
ctx.beginPath(); ctx.moveTo(view.x(view.bounds.xmin), view.y(0)); ctx.lineTo(view.x(span), view.y(0)); ctx.stroke();
// Actual trajectory.
ctx.strokeStyle = helpers.theme.trace[0]; ctx.lineWidth = 2;
ctx.beginPath();
d.trail.forEach((pt, i) => (i ? ctx.lineTo(view.x(pt[0]), view.y(pt[1])) : ctx.moveTo(view.x(pt[0]), view.y(pt[1]))));
ctx.stroke();
// Projectile and velocity vector.
ctx.fillStyle = helpers.theme.trace[0];
ctx.beginPath(); ctx.arc(view.x(d.x), view.y(d.y), 6, 0, 2 * Math.PI); ctx.fill();
ctx.strokeStyle = helpers.theme.trace[1]; ctx.fillStyle = helpers.theme.trace[1]; ctx.lineWidth = 1.8;
helpers.arrow(view.x(d.x), view.y(d.y), view.x(d.x) + d.vx * 1.6, view.y(d.y) - d.vy * 1.6, 7);
helpers.label('破線＝抵抗なしの理論軌道', 12, helpers.h - 12);`,
  }),

  sim({
    slug: 'simple-pendulum',
    title: '単振り子',
    titleEn: 'Simple pendulum',
    category: 'mechanics',
    shortDescription: '厳密な非線形振り子。振幅を大きくすると周期が小角度近似からずれます。',
    description:
      '運動方程式 θ¨ = -(g/L) sinθ - b θ˙ を速度ベルレ法で積分します。小角度近似 T₀ = 2π√(L/g) と、' +
      '実測した周期を並べて表示するので、振幅 10° と 90° で周期がどれだけ違うかを直接確認できます。\n\n' +
      '減衰を 0 にすると全エネルギーは数値誤差の範囲で一定に保たれます（シンプレクティック積分の効果）。',
    physicsTopics: ['単振動', '振り子', '小角度近似', 'エネルギー保存'],
    formulas: [
      { text: 'θ¨ = -(g/L) sin θ - b θ˙' },
      { text: 'T₀ = 2π √(L/g)', note: '小角度近似' },
      { text: 'T ≈ T₀ (1 + θ₀²/16 + 11θ₀⁴/3072 + …)', note: '大振幅補正' },
    ],
    tags: ['mechanics', 'oscillation', 'energy', '2d', 'high-school'],
    parameterDefinitions: [
      range('length', 'ひもの長さ L', 1, 0.1, 5, 0.01, { unit: 'm' }),
      range('theta0', '初期角 θ₀', 30, 1, 170, 1, { unit: '°', restart: true }),
      range('mass', 'おもりの質量 m', 0.5, 0.05, 5, 0.05, { unit: 'kg' }),
      range('g', '重力加速度 g', 9.80665, 1, 30, 0.001, { unit: 'm/s²' }),
      range('damping', '減衰 b', 0, 0, 2, 0.01, { unit: '1/s' }),
    ],
    displayDefinitions: [
      read('t', '経過時間', 's', 3),
      read('thetaDeg', '角度 θ', '°', 2),
      read('omega', '角速度 ω', 'rad/s', 3),
      read('period', '実測周期 T', 's', 4),
      read('periodSmall', '近似周期 T₀', 's', 4),
      read('periodRatio', 'T / T₀', '', 4),
      read('energy', '力学的エネルギー', 'J', 5),
    ],
    graphDefinitions: [
      timeGraph('theta-t', '角度 θ–t', [{ key: 'thetaDeg', label: 'θ', color: '#5ac8fa' }]),
      xyGraph('phase', '位相空間 ω–θ', { key: 'theta', label: 'θ', unit: 'rad' }, [
        { key: 'omega', label: 'ω', color: '#ffb454' },
      ]),
      timeGraph('energy', 'エネルギー', [
        { key: 'ke', label: '運動', color: '#5ac8fa' },
        { key: 'pe', label: '位置', color: '#ffb454' },
        { key: 'energy', label: '合計', color: '#8ce99a' },
      ]),
    ],
    runtimeOptions: { dt: 1 / 4000 },
    simulationCode: `
return {
  meta: { integrator: 'Velocity Verlet (symplectic)' },
  init(p) {
    const th = (p.theta0 * Math.PI) / 180;
    return { th, om: 0, trail: [], period: 0, lastCross: null, prevTh: th, tAbs: 0 };
  },
  step(s, dt, p) {
    const accel = (th, om) => -(p.g / p.length) * Math.sin(th) - p.damping * om;
    // Velocity Verlet on the scalar coordinate.
    const a0 = accel(s.th, s.om);
    const thNew = s.th + s.om * dt + 0.5 * a0 * dt * dt;
    const omHalf = s.om + 0.5 * a0 * dt;
    const a1 = accel(thNew, omHalf);
    const omNew = omHalf + 0.5 * a1 * dt;
    s.prevTh = s.th;
    s.th = thNew; s.om = omNew; s.tAbs += dt;
    // Period from successive upward zero crossings, interpolated for precision.
    if (s.prevTh < 0 && s.th >= 0) {
      const frac = -s.prevTh / (s.th - s.prevTh);
      const crossing = s.tAbs - dt + frac * dt;
      if (s.lastCross !== null) s.period = crossing - s.lastCross;
      s.lastCross = crossing;
    }
    return s;
  },
  sample(s, p, t) {
    const L = p.length;
    const x = L * Math.sin(s.th);
    const y = -L * Math.cos(s.th);
    const v = L * s.om;
    const ke = 0.5 * p.mass * v * v;
    const pe = p.mass * p.g * (y + L);
    const T0 = 2 * Math.PI * Math.sqrt(L / p.g);
    const scalars = {
      t, theta: s.th, thetaDeg: (s.th * 180) / Math.PI, omega: s.om,
      ke, pe, energy: ke + pe, period: s.period, periodSmall: T0,
      periodRatio: s.period ? s.period / T0 : 0,
    };
    return { draw: { x, y, L, th: s.th, om: s.om }, scalars, series: scalars };
  },
};`,
    rendererCode: `
const d = frame.draw;
const R = d.L * 1.25;
const view = helpers.view({ xmin: -R, xmax: R, ymin: -R, ymax: R * 0.35 }, { pad: 20 });
const px = view.x(d.x), py = view.y(d.y), ox = view.x(0), oy = view.y(0);
// Arc showing the swing amplitude.
ctx.strokeStyle = 'rgba(120,150,175,0.25)'; ctx.lineWidth = 1;
ctx.beginPath(); ctx.arc(ox, oy, view.len(d.L), Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox, view.y(-d.L * 1.1)); ctx.stroke();
// String and bob.
ctx.strokeStyle = helpers.theme.ink; ctx.lineWidth = 1.6;
ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(px, py); ctx.stroke();
ctx.fillStyle = helpers.theme.muted;
ctx.beginPath(); ctx.arc(ox, oy, 4, 0, 2 * Math.PI); ctx.fill();
const grad = ctx.createRadialGradient(px - 3, py - 4, 1, px, py, 14);
grad.addColorStop(0, '#9ce0ff'); grad.addColorStop(1, helpers.theme.trace[0]);
ctx.fillStyle = grad;
ctx.beginPath(); ctx.arc(px, py, 13, 0, 2 * Math.PI); ctx.fill();
// Velocity vector, tangent to the arc.
ctx.strokeStyle = helpers.theme.trace[1]; ctx.fillStyle = helpers.theme.trace[1]; ctx.lineWidth = 1.6;
const vx = d.L * d.om * Math.cos(d.th), vy = d.L * d.om * Math.sin(d.th);
helpers.arrow(px, py, px + vx * 18, py + vy * 18, 6);
helpers.label('θ = ' + ((d.th * 180) / Math.PI).toFixed(1) + '°', ox + 10, oy + 18, { color: helpers.theme.ink });`,
  }),

  sim({
    slug: 'driven-damped-oscillator',
    title: '強制振動と共振',
    titleEn: 'Driven damped oscillator',
    category: 'mechanics',
    shortDescription: '駆動周波数を掃引して、振幅と位相が共振点でどう振る舞うかを見ます。',
    description:
      'x¨ + 2ζω₀x˙ + ω₀²x = (F₀/m)cos(ωt) を RK4 で解きます。定常状態の振幅は ' +
      'A = (F₀/m)/√((ω₀²-ω²)² + (2ζω₀ω)²) で、ζ が小さいほど共振ピークは鋭くなります。\n\n' +
      '理論振幅（灰色の水平線）と実際の包絡線を比べると、過渡応答が減衰して定常状態に落ち着く様子が分かります。',
    physicsTopics: ['強制振動', '共振', '減衰', '位相差'],
    formulas: [
      { text: 'm x¨ + c x˙ + k x = F₀ cos(ω t)' },
      { text: 'A(ω) = (F₀/m) / √((ω₀²−ω²)² + (2ζω₀ω)²)' },
      { text: 'tan φ = 2ζω₀ω / (ω₀² − ω²)' },
    ],
    tags: ['mechanics', 'oscillation', 'resonance', 'university-physics'],
    difficulty: 3,
    targetLevel: 'undergraduate',
    parameterDefinitions: [
      range('omega0', '固有角振動数 ω₀', 6.283, 0.5, 20, 0.01, { unit: 'rad/s' }),
      range('zeta', '減衰比 ζ', 0.05, 0, 1.2, 0.005, { unit: '' }),
      range('omega', '駆動角振動数 ω', 6.283, 0.1, 25, 0.01, { unit: 'rad/s' }),
      range('force', '駆動振幅 F₀/m', 1, 0, 10, 0.05, { unit: 'm/s²' }),
      range('x0', '初期変位 x₀', 0, -3, 3, 0.05, { unit: 'm', restart: true }),
    ],
    displayDefinitions: [
      read('t', '時間', 's', 2),
      read('x', '変位 x', 'm', 4),
      read('v', '速度 v', 'm/s', 4),
      read('amplitude', '観測振幅', 'm', 4),
      read('theoryAmplitude', '定常振幅（理論）', 'm', 4),
      read('phaseDeg', '位相差 φ', '°', 2),
      read('qFactor', 'Q 値', '', 3),
    ],
    graphDefinitions: [
      timeGraph('x-t', '変位と駆動力', [
        { key: 'x', label: 'x', color: '#5ac8fa' },
        { key: 'drive', label: '駆動力', color: '#ffb454' },
      ]),
      xyGraph('phase', '位相空間 v–x', { key: 'x', label: 'x', unit: 'm' }, [
        { key: 'v', label: 'v', color: '#c0a6ff' },
      ]),
      timeGraph('amp', '振幅の追従', [
        { key: 'amplitude', label: '観測', color: '#5ac8fa' },
        { key: 'theoryAmplitude', label: '理論', color: '#7d93a6' },
      ]),
    ],
    runtimeOptions: { dt: 1 / 3000 },
    simulationCode: `
const { rk4 } = PL;
return {
  meta: { integrator: 'RK4' },
  init(p) {
    return { y: [p.x0, 0], tAbs: 0, peak: 0, window: [], trail: [] };
  },
  step(s, dt, p) {
    const deriv = (t, y) => [
      y[1],
      -2 * p.zeta * p.omega0 * y[1] - p.omega0 * p.omega0 * y[0] + p.force * Math.cos(p.omega * (s.tAbs + t)),
    ];
    s.y = rk4(deriv, 0, s.y, dt);
    s.tAbs += dt;
    // Rolling amplitude estimate over roughly one drive period.
    s.window.push(Math.abs(s.y[0]));
    const span = Math.max(50, Math.round((2 * Math.PI) / p.omega / dt));
    if (s.window.length > span) s.window.shift();
    s.peak = Math.max(...s.window);
    return s;
  },
  sample(s, p, t) {
    const w = p.omega, w0 = p.omega0, z = p.zeta;
    const denom = Math.sqrt((w0 * w0 - w * w) ** 2 + (2 * z * w0 * w) ** 2);
    const theory = denom === 0 ? Infinity : p.force / denom;
    const phase = Math.atan2(2 * z * w0 * w, w0 * w0 - w * w);
    const scalars = {
      t, x: s.y[0], v: s.y[1], drive: p.force * Math.cos(w * s.tAbs),
      amplitude: s.peak, theoryAmplitude: Number.isFinite(theory) ? theory : 0,
      phaseDeg: (phase * 180) / Math.PI,
      qFactor: z > 0 ? 1 / (2 * z) : 0,
      energy: 0.5 * s.y[1] * s.y[1] + 0.5 * w0 * w0 * s.y[0] * s.y[0],
    };
    return { draw: { x: s.y[0], v: s.y[1], amp: Math.max(s.peak, 0.2), theory, drive: scalars.drive, force: p.force }, scalars, series: scalars };
  },
};`,
    rendererCode: `
const d = frame.draw;
const span = Math.max(d.amp * 1.6, Math.abs(d.theory) * 1.2, 0.5);
const view = helpers.view({ xmin: -span, xmax: span, ymin: -1, ymax: 1 }, { stretch: true, pad: 30 });
const y0 = view.y(0);
// Rail with equilibrium mark.
ctx.strokeStyle = 'rgba(120,150,175,0.3)'; ctx.lineWidth = 1;
ctx.beginPath(); ctx.moveTo(view.x(-span), y0); ctx.lineTo(view.x(span), y0); ctx.stroke();
ctx.beginPath(); ctx.moveTo(view.x(0), y0 - 30); ctx.lineTo(view.x(0), y0 + 30); ctx.stroke();
// Steady-state amplitude envelope.
if (isFinite(d.theory)) {
  ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(125,147,166,0.9)';
  for (const sx of [-d.theory, d.theory]) {
    ctx.beginPath(); ctx.moveTo(view.x(sx), y0 - 46); ctx.lineTo(view.x(sx), y0 + 46); ctx.stroke();
  }
  ctx.restore();
}
// Spring drawn as a zigzag from the wall to the mass.
const wall = view.x(-span);
const mx = view.x(d.x);
ctx.strokeStyle = helpers.theme.muted; ctx.lineWidth = 1.6;
ctx.beginPath(); ctx.moveTo(wall, y0);
const coils = 18;
for (let i = 1; i < coils; i++) {
  const f = i / coils;
  ctx.lineTo(wall + (mx - wall) * f, y0 + (i % 2 ? -12 : 12));
}
ctx.lineTo(mx, y0); ctx.stroke();
ctx.fillStyle = helpers.theme.trace[0];
ctx.fillRect(mx - 16, y0 - 16, 32, 32);
// Drive force arrow.
ctx.strokeStyle = helpers.theme.trace[1]; ctx.fillStyle = helpers.theme.trace[1]; ctx.lineWidth = 2;
helpers.arrow(mx, y0 - 40, mx + d.drive * 26, y0 - 40, 6);
helpers.label('駆動力', mx + 8, y0 - 50, { color: helpers.theme.trace[1] });`,
  }),

  sim({
    slug: 'double-pendulum',
    title: '二重振り子',
    titleEn: 'Double pendulum',
    category: 'mechanics',
    shortDescription: 'ラグランジュ方程式を RK4 で解き、初期値鋭敏性を二本の軌跡で可視化します。',
    description:
      '二重振り子の厳密な運動方程式を解きます。わずか 10⁻³ ラジアンだけずらした二つ目の振り子（橙）を同時に走らせ、' +
      '数秒で軌道が完全に分かれる様子＝カオスの初期値鋭敏性を示します。\n\n' +
      '「分離距離」グラフは片対数的に増加し、その傾きが最大リアプノフ指数のおおよその目安になります。' +
      'エネルギーのドリフトは数値精度の指標として同時に監視しています。',
    physicsTopics: ['二重振り子', 'カオス', '初期値鋭敏性', 'ラグランジュ力学'],
    formulas: [
      { text: '(m₁+m₂)L₁θ₁¨ + m₂L₂θ₂¨cos(θ₁−θ₂) + m₂L₂θ₂˙²sin(θ₁−θ₂) + (m₁+m₂)g sinθ₁ = 0' },
      { text: 'L₂θ₂¨ + L₁θ₁¨cos(θ₁−θ₂) − L₁θ₁˙²sin(θ₁−θ₂) + g sinθ₂ = 0' },
    ],
    tags: ['mechanics', 'chaos', 'nonlinear', 'oscillation', '2d', 'numerical-simulation', 'university-physics'],
    difficulty: 4,
    targetLevel: 'undergraduate',
    parameterDefinitions: [
      range('m1', '質量 m₁', 1, 0.1, 5, 0.1, { unit: 'kg' }),
      range('m2', '質量 m₂', 1, 0.1, 5, 0.1, { unit: 'kg' }),
      range('L1', '長さ L₁', 1, 0.2, 2, 0.01, { unit: 'm' }),
      range('L2', '長さ L₂', 1, 0.2, 2, 0.01, { unit: 'm' }),
      range('th1', '初期角 θ₁', 120, -180, 180, 1, { unit: '°', restart: true }),
      range('th2', '初期角 θ₂', 60, -180, 180, 1, { unit: '°', restart: true }),
      range('g', '重力加速度 g', 9.80665, 1, 30, 0.01, { unit: 'm/s²' }),
      toggle('showTwin', '摂動した双子を表示', true, { restart: true }),
    ],
    displayDefinitions: [
      read('t', '時間', 's', 2),
      read('th1Deg', 'θ₁', '°', 2),
      read('th2Deg', 'θ₂', '°', 2),
      read('energy', '全エネルギー', 'J', 6),
      read('energyDrift', 'エネルギー誤差', 'J', 8),
      read('separation', '双子との分離', 'rad', 6),
    ],
    graphDefinitions: [
      timeGraph('angles', '角度', [
        { key: 'th1Deg', label: 'θ₁', color: '#5ac8fa' },
        { key: 'th2Deg', label: 'θ₂', color: '#ffb454' },
      ]),
      xyGraph('phase', '位相空間 ω₁–θ₁', { key: 'th1', label: 'θ₁', unit: 'rad' }, [
        { key: 'w1', label: 'ω₁', color: '#c0a6ff' },
      ]),
      timeGraph('sep', '双子との分離（カオスの指標）', [{ key: 'separation', label: '分離', color: '#ff8fa3' }]),
    ],
    runtimeOptions: { dt: 1 / 4000 },
    simulationCode: `
const { rk4 } = PL;
function deriv(p) {
  return (t, y) => {
    const [a1, a2, w1, w2] = y;
    const d = a1 - a2;
    const m1 = p.m1, m2 = p.m2, L1 = p.L1, L2 = p.L2, g = p.g;
    const den = 2 * m1 + m2 - m2 * Math.cos(2 * d);
    const dw1 =
      (-g * (2 * m1 + m2) * Math.sin(a1) - m2 * g * Math.sin(a1 - 2 * a2) -
        2 * Math.sin(d) * m2 * (w2 * w2 * L2 + w1 * w1 * L1 * Math.cos(d))) / (L1 * den);
    const dw2 =
      (2 * Math.sin(d) * (w1 * w1 * L1 * (m1 + m2) + g * (m1 + m2) * Math.cos(a1) +
        w2 * w2 * L2 * m2 * Math.cos(d))) / (L2 * den);
    return [w1, w2, dw1, dw2];
  };
}
function energy(y, p) {
  const [a1, a2, w1, w2] = y;
  const v1sq = p.L1 * p.L1 * w1 * w1;
  const v2sq = p.L1 * p.L1 * w1 * w1 + p.L2 * p.L2 * w2 * w2 + 2 * p.L1 * p.L2 * w1 * w2 * Math.cos(a1 - a2);
  const T = 0.5 * p.m1 * v1sq + 0.5 * p.m2 * v2sq;
  const U = -(p.m1 + p.m2) * p.g * p.L1 * Math.cos(a1) - p.m2 * p.g * p.L2 * Math.cos(a2);
  return T + U;
}
return {
  meta: { integrator: 'RK4', conserved: 'energy monitored' },
  init(p) {
    const y = [(p.th1 * Math.PI) / 180, (p.th2 * Math.PI) / 180, 0, 0];
    return { y, twin: [y[0] + 1e-3, y[1], 0, 0], e0: energy(y, p), trail: [], trailTwin: [] };
  },
  step(s, dt, p) {
    const f = deriv(p);
    s.y = rk4(f, 0, s.y, dt);
    if (p.showTwin) s.twin = rk4(f, 0, s.twin, dt);
    return s;
  },
  sample(s, p, t) {
    const pos = (y) => {
      const x1 = p.L1 * Math.sin(y[0]), y1 = -p.L1 * Math.cos(y[0]);
      return { x1, y1, x2: x1 + p.L2 * Math.sin(y[1]), y2: y1 - p.L2 * Math.cos(y[1]) };
    };
    const a = pos(s.y), b = pos(s.twin);
    s.trail.push([a.x2, a.y2]); if (s.trail.length > 2500) s.trail.shift();
    if (p.showTwin) { s.trailTwin.push([b.x2, b.y2]); if (s.trailTwin.length > 2500) s.trailTwin.shift(); }
    const e = energy(s.y, p);
    const sep = Math.hypot(s.y[0] - s.twin[0], s.y[1] - s.twin[1]);
    const scalars = {
      t, th1: s.y[0], th2: s.y[1], w1: s.y[2], w2: s.y[3],
      th1Deg: (s.y[0] * 180) / Math.PI, th2Deg: (s.y[1] * 180) / Math.PI,
      energy: e, energyDrift: e - s.e0, separation: p.showTwin ? sep : 0,
    };
    return {
      draw: { a, b, trail: s.trail, trailTwin: s.trailTwin, L: p.L1 + p.L2, twin: p.showTwin },
      scalars, series: scalars,
    };
  },
};`,
    rendererCode: `
const d = frame.draw;
const R = d.L * 1.12;
const view = helpers.view({ xmin: -R, xmax: R, ymin: -R, ymax: R * 0.5 }, { pad: 16 });
const drawTrail = (pts, color, alpha) => {
  ctx.strokeStyle = color; ctx.globalAlpha = alpha; ctx.lineWidth = 1.4;
  ctx.beginPath();
  pts.forEach((pt, i) => (i ? ctx.lineTo(view.x(pt[0]), view.y(pt[1])) : ctx.moveTo(view.x(pt[0]), view.y(pt[1]))));
  ctx.stroke(); ctx.globalAlpha = 1;
};
drawTrail(d.trail, helpers.theme.trace[0], 0.55);
if (d.twin) drawTrail(d.trailTwin, helpers.theme.trace[1], 0.45);
const drawArm = (s, color) => {
  ctx.strokeStyle = color; ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(view.x(0), view.y(0)); ctx.lineTo(view.x(s.x1), view.y(s.y1)); ctx.lineTo(view.x(s.x2), view.y(s.y2));
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(view.x(s.x1), view.y(s.y1), 7, 0, 2 * Math.PI); ctx.fill();
  ctx.beginPath(); ctx.arc(view.x(s.x2), view.y(s.y2), 9, 0, 2 * Math.PI); ctx.fill();
};
if (d.twin) { ctx.globalAlpha = 0.7; drawArm(d.b, helpers.theme.trace[1]); ctx.globalAlpha = 1; }
drawArm(d.a, helpers.theme.ink);
ctx.fillStyle = helpers.theme.muted;
ctx.beginPath(); ctx.arc(view.x(0), view.y(0), 4, 0, 2 * Math.PI); ctx.fill();
if (d.twin) helpers.label('橙＝初期角を 0.001 rad ずらした双子', 12, helpers.h - 12);`,
  }),

  sim({
    slug: 'one-dimensional-collision',
    title: '一次元衝突と運動量保存',
    titleEn: 'One-dimensional collisions',
    category: 'mechanics',
    shortDescription: '反発係数を 0 から 1 まで変えて、弾性・非弾性衝突の前後を比較します。',
    description:
      '二つの台車を正面衝突させます。反発係数 e = 1 で完全弾性衝突（運動エネルギーも保存）、' +
      'e = 0 で完全非弾性衝突（合体）になります。\n\n' +
      '衝突後の速度は運動量保存と反発係数の定義から解析的に求め、数値積分による位置更新と組み合わせています。' +
      '運動量は e の値によらず常に保存され、失われたエネルギーは ΔE として表示されます。',
    physicsTopics: ['衝突', '運動量保存', '反発係数', 'エネルギー損失'],
    formulas: [
      { text: "m₁v₁ + m₂v₂ = m₁v₁' + m₂v₂'" },
      { text: "e = −(v₁' − v₂') / (v₁ − v₂)" },
      { text: 'ΔE = ½μ(1−e²)(v₁−v₂)²', note: 'μ は換算質量' },
    ],
    tags: ['mechanics', 'collision', 'momentum', 'energy', '1d', 'high-school'],
    parameterDefinitions: [
      range('m1', '質量 m₁', 1, 0.1, 10, 0.1, { unit: 'kg', restart: true }),
      range('m2', '質量 m₂', 2, 0.1, 10, 0.1, { unit: 'kg', restart: true }),
      range('v1', '初速 v₁', 3, -10, 10, 0.1, { unit: 'm/s', restart: true }),
      range('v2', '初速 v₂', -1, -10, 10, 0.1, { unit: 'm/s', restart: true }),
      range('e', '反発係数 e', 1, 0, 1, 0.01, { unit: '' }),
      toggle('walls', '壁で跳ね返す', true),
    ],
    displayDefinitions: [
      read('t', '時間', 's', 2),
      read('v1', '速度 v₁', 'm/s', 3),
      read('v2', '速度 v₂', 'm/s', 3),
      read('momentum', '全運動量', 'kg·m/s', 4),
      read('kinetic', '全運動エネルギー', 'J', 4),
      read('lostEnergy', '失われたエネルギー', 'J', 4),
      read('collisions', '衝突回数', '', 0),
    ],
    graphDefinitions: [
      timeGraph('v-t', '速度 v–t', [
        { key: 'v1', label: 'v₁', color: '#5ac8fa' },
        { key: 'v2', label: 'v₂', color: '#ffb454' },
      ]),
      timeGraph('conserve', '保存量', [
        { key: 'momentum', label: '運動量', color: '#8ce99a' },
        { key: 'kinetic', label: '運動エネルギー', color: '#ff8fa3' },
      ]),
    ],
    runtimeOptions: { dt: 1 / 1200, speed: 1 },
    simulationCode: `
return {
  meta: { integrator: 'analytic impulse + explicit advection' },
  init(p) {
    return {
      x1: -3, x2: 3, v1: p.v1, v2: p.v2, r1: 0.35, r2: 0.35,
      collisions: 0, e0: 0.5 * p.m1 * p.v1 * p.v1 + 0.5 * p.m2 * p.v2 * p.v2, flash: 0,
    };
  },
  step(s, dt, p) {
    s.x1 += s.v1 * dt;
    s.x2 += s.v2 * dt;
    const r1 = s.r1 * Math.cbrt(p.m1), r2 = s.r2 * Math.cbrt(p.m2);
    if (s.x2 - s.x1 <= r1 + r2 && s.v1 - s.v2 > 0) {
      // Impulse from momentum conservation plus the restitution definition.
      const M = p.m1 + p.m2;
      const u1 = s.v1, u2 = s.v2;
      s.v1 = (p.m1 * u1 + p.m2 * u2 - p.m2 * p.e * (u1 - u2)) / M;
      s.v2 = (p.m1 * u1 + p.m2 * u2 + p.m1 * p.e * (u1 - u2)) / M;
      // Separate the overlap so the pair cannot stick numerically.
      const overlap = r1 + r2 - (s.x2 - s.x1);
      s.x1 -= overlap / 2; s.x2 += overlap / 2;
      s.collisions += 1;
      s.flash = 1;
    }
    if (p.walls) {
      if (s.x1 - r1 < -6) { s.x1 = -6 + r1; s.v1 = Math.abs(s.v1); }
      if (s.x2 + r2 > 6) { s.x2 = 6 - r2; s.v2 = -Math.abs(s.v2); }
    }
    s.flash = Math.max(0, s.flash - dt * 3);
    return s;
  },
  sample(s, p, t) {
    const ke = 0.5 * p.m1 * s.v1 * s.v1 + 0.5 * p.m2 * s.v2 * s.v2;
    const scalars = {
      t, v1: s.v1, v2: s.v2,
      momentum: p.m1 * s.v1 + p.m2 * s.v2,
      kinetic: ke, lostEnergy: s.e0 - ke, collisions: s.collisions,
    };
    return {
      draw: { x1: s.x1, x2: s.x2, r1: s.r1 * Math.cbrt(p.m1), r2: s.r2 * Math.cbrt(p.m2), v1: s.v1, v2: s.v2, flash: s.flash },
      scalars, series: scalars,
    };
  },
};`,
    rendererCode: `
const d = frame.draw;
const view = helpers.view({ xmin: -6.4, xmax: 6.4, ymin: -1.4, ymax: 1.4 }, { stretch: true, pad: 24 });
const y0 = view.y(0);
ctx.strokeStyle = 'rgba(200,220,235,0.4)'; ctx.lineWidth = 2;
ctx.beginPath(); ctx.moveTo(view.x(-6), y0 + 26); ctx.lineTo(view.x(6), y0 + 26); ctx.stroke();
for (const wx of [-6, 6]) { ctx.beginPath(); ctx.moveTo(view.x(wx), y0 + 26); ctx.lineTo(view.x(wx), y0 - 46); ctx.stroke(); }
if (d.flash > 0) {
  ctx.fillStyle = 'rgba(255,180,84,' + (d.flash * 0.35).toFixed(3) + ')';
  ctx.beginPath(); ctx.arc(view.x((d.x1 + d.x2) / 2), y0, 40 * d.flash + 10, 0, 2 * Math.PI); ctx.fill();
}
const cart = (x, r, color, v, label) => {
  const w = view.len(r * 2), px = view.x(x);
  ctx.fillStyle = color;
  ctx.fillRect(px - w / 2, y0 + 26 - w, w, w);
  ctx.strokeStyle = helpers.theme.ink; ctx.fillStyle = helpers.theme.ink; ctx.lineWidth = 1.6;
  helpers.arrow(px, y0 - w - 12, px + v * 14, y0 - w - 12, 6);
  helpers.label(label + ' ' + v.toFixed(2) + ' m/s', px, y0 - w - 24, { align: 'center', color });
};
cart(d.x1, d.r1, helpers.theme.trace[0], d.v1, 'm₁');
cart(d.x2, d.r2, helpers.theme.trace[1], d.v2, 'm₂');`,
  }),

  sim({
    slug: 'coupled-oscillators',
    title: '連成振動と基準振動',
    titleEn: 'Coupled oscillators and normal modes',
    category: 'mechanics',
    shortDescription: 'ばねで結ばれた二つのおもりのエネルギーのやり取りと、二つの基準振動を観察します。',
    description:
      'ばね定数 k で壁につながれた二つの質点を結合ばね k_c でつなぎます。' +
      '同相モード（ω₁ = √(k/m)）と逆相モード（ω₂ = √((k+2k_c)/m)）の重ね合わせとして運動が記述され、' +
      '片方だけを引いて放すと、うなりの周期でエネルギーが二つのおもりの間を往復します。',
    physicsTopics: ['連成振動', '基準振動', 'うなり', 'エネルギー移動'],
    formulas: [
      { text: 'ω_同相 = √(k/m)' },
      { text: 'ω_逆相 = √((k + 2k_c)/m)' },
      { text: 'うなり周期 = 2π / (ω₂ − ω₁)' },
    ],
    tags: ['mechanics', 'oscillation', 'normal-modes', 'university-physics'],
    difficulty: 3,
    targetLevel: 'undergraduate',
    parameterDefinitions: [
      range('m', '質量 m', 1, 0.1, 5, 0.05, { unit: 'kg' }),
      range('k', 'ばね定数 k', 20, 1, 100, 0.5, { unit: 'N/m' }),
      range('kc', '結合ばね k_c', 4, 0, 60, 0.5, { unit: 'N/m' }),
      range('x1_0', '初期変位 x₁', 0.4, -1, 1, 0.01, { unit: 'm', restart: true }),
      range('x2_0', '初期変位 x₂', 0, -1, 1, 0.01, { unit: 'm', restart: true }),
    ],
    displayDefinitions: [
      read('t', '時間', 's', 2),
      read('x1', 'x₁', 'm', 4),
      read('x2', 'x₂', 'm', 4),
      read('omegaSym', 'ω 同相', 'rad/s', 3),
      read('omegaAnti', 'ω 逆相', 'rad/s', 3),
      read('beatPeriod', 'うなり周期', 's', 3),
      read('energy', '全エネルギー', 'J', 6),
    ],
    graphDefinitions: [
      timeGraph('x-t', '変位', [
        { key: 'x1', label: 'x₁', color: '#5ac8fa' },
        { key: 'x2', label: 'x₂', color: '#ffb454' },
      ]),
      timeGraph('e-t', '各おもりのエネルギー', [
        { key: 'e1', label: 'おもり 1', color: '#5ac8fa' },
        { key: 'e2', label: 'おもり 2', color: '#ffb454' },
        { key: 'energy', label: '合計', color: '#8ce99a' },
      ]),
    ],
    runtimeOptions: { dt: 1 / 4000 },
    simulationCode: `
return {
  meta: { integrator: 'Velocity Verlet (symplectic)' },
  init(p) { return { x: [p.x1_0, p.x2_0], v: [0, 0] }; },
  step(s, dt, p) {
    const accel = (x) => [
      (-p.k * x[0] - p.kc * (x[0] - x[1])) / p.m,
      (-p.k * x[1] - p.kc * (x[1] - x[0])) / p.m,
    ];
    const a0 = accel(s.x);
    const xNew = [s.x[0] + s.v[0] * dt + 0.5 * a0[0] * dt * dt, s.x[1] + s.v[1] * dt + 0.5 * a0[1] * dt * dt];
    const a1 = accel(xNew);
    s.v = [s.v[0] + 0.5 * (a0[0] + a1[0]) * dt, s.v[1] + 0.5 * (a0[1] + a1[1]) * dt];
    s.x = xNew;
    return s;
  },
  sample(s, p, t) {
    const e1 = 0.5 * p.m * s.v[0] * s.v[0] + 0.5 * p.k * s.x[0] * s.x[0];
    const e2 = 0.5 * p.m * s.v[1] * s.v[1] + 0.5 * p.k * s.x[1] * s.x[1];
    const ec = 0.5 * p.kc * (s.x[0] - s.x[1]) ** 2;
    const w1 = Math.sqrt(p.k / p.m);
    const w2 = Math.sqrt((p.k + 2 * p.kc) / p.m);
    const scalars = {
      t, x1: s.x[0], x2: s.x[1], v1: s.v[0], v2: s.v[1],
      e1, e2, energy: e1 + e2 + ec,
      omegaSym: w1, omegaAnti: w2,
      beatPeriod: w2 - w1 > 1e-9 ? (2 * Math.PI) / (w2 - w1) : 0,
    };
    return { draw: { x1: s.x[0], x2: s.x[1], e1, e2 }, scalars, series: scalars };
  },
};`,
    rendererCode: `
const d = frame.draw;
const view = helpers.view({ xmin: -3, xmax: 3, ymin: -1, ymax: 1 }, { stretch: true, pad: 26 });
const y0 = view.y(0);
const zig = (x0, x1, y, amp) => {
  ctx.beginPath(); ctx.moveTo(x0, y);
  for (let i = 1; i < 14; i++) ctx.lineTo(x0 + ((x1 - x0) * i) / 14, y + (i % 2 ? -amp : amp));
  ctx.lineTo(x1, y); ctx.stroke();
};
const p1 = view.x(-1 + d.x1), p2 = view.x(1 + d.x2);
ctx.strokeStyle = 'rgba(200,220,235,0.45)'; ctx.lineWidth = 2;
for (const wx of [-2.6, 2.6]) { ctx.beginPath(); ctx.moveTo(view.x(wx), y0 - 46); ctx.lineTo(view.x(wx), y0 + 46); ctx.stroke(); }
ctx.strokeStyle = helpers.theme.muted; ctx.lineWidth = 1.5;
zig(view.x(-2.6), p1, y0, 9);
zig(p2, view.x(2.6), y0, 9);
ctx.strokeStyle = helpers.theme.trace[3];
zig(p1, p2, y0, 12);
const bob = (px, color, energy) => {
  ctx.fillStyle = color;
  ctx.fillRect(px - 17, y0 - 17, 34, 34);
  ctx.fillStyle = 'rgba(10,16,22,0.65)';
  const h = Math.max(0, Math.min(34, 34 * (1 - Math.min(1, energy / 2))));
  ctx.fillRect(px - 17, y0 - 17, 34, h);
};
bob(p1, helpers.theme.trace[0], d.e1);
bob(p2, helpers.theme.trace[1], d.e2);
helpers.label('箱の塗りつぶしの高さが各おもりのエネルギー', 12, helpers.h - 12);`,
  }),
];
