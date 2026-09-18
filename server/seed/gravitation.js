import { sim, num, range, toggle, choice, read, timeGraph, xyGraph } from './common.js';

export const gravitation = [
  sim({
    slug: 'two-body-kepler',
    title: '二体問題とケプラーの法則',
    titleEn: 'Two-body problem and Kepler orbits',
    category: 'gravitation',
    shortDescription: '重心のまわりを回る二体運動。面積速度と全エネルギーが保存する様子を確認します。',
    description:
      '二つの天体を万有引力だけで運動させます。速度ベルレ法（シンプレクティック）で積分するため、' +
      '長時間走らせてもエネルギーは振動するだけで系統的にドリフトしません。\n\n' +
      '表示している面積速度 dA/dt = L/2m はケプラーの第二法則そのものです。離心率を上げると近点で速く、' +
      '遠点で遅くなりますが、面積速度は一定のままであることをグラフで確認できます。',
    physicsTopics: ['万有引力', 'ケプラーの法則', '角運動量保存', '軌道要素'],
    formulas: [
      { text: 'F = G m₁ m₂ / r²' },
      { text: 'T² = 4π²a³ / (G(m₁+m₂))', note: 'ケプラーの第三法則' },
      { text: 'dA/dt = L / 2m = 一定', note: 'ケプラーの第二法則' },
      { text: 'E = −G m₁ m₂ / 2a' },
    ],
    tags: ['gravitation', 'orbit', 'celestial-mechanics', 'energy', '2d', 'university-physics'],
    difficulty: 3,
    targetLevel: 'undergraduate',
    parameterDefinitions: [
      range('m1', '中心天体の質量', 1, 0.1, 10, 0.1, { unit: '太陽質量', restart: true }),
      range('m2', '周回天体の質量', 0.05, 0.001, 2, 0.001, { unit: '太陽質量', restart: true }),
      range('a', '軌道長半径 a', 1, 0.3, 5, 0.01, { unit: 'au', restart: true }),
      range('ecc', '離心率 e', 0.4, 0, 0.95, 0.01, { unit: '', restart: true }),
      toggle('comFrame', '重心を固定して表示', true),
      choice('speed', '時間の進み方', 2, [
        { value: 0.5, label: '0.5×' }, { value: 1, label: '1×' }, { value: 2, label: '2×' }, { value: 6, label: '6×' },
      ]),
    ],
    displayDefinitions: [
      read('t', '経過時間', '年', 3),
      read('r', '距離 r', 'au', 4),
      read('speed', '相対速度', 'au/年', 4),
      read('period', '理論周期', '年', 4),
      read('energy', '全エネルギー', '', 6),
      read('angularMomentum', '角運動量', '', 6),
      read('arealVelocity', '面積速度 dA/dt', 'au²/年', 6),
    ],
    graphDefinitions: [
      xyGraph('orbit', '軌道', { key: 'x', label: 'x', unit: 'au' }, [{ key: 'y', label: 'y', color: '#5ac8fa' }]),
      timeGraph('r-t', '距離 r–t', [{ key: 'r', label: 'r', color: '#5ac8fa' }]),
      timeGraph('conserved', '保存量', [
        { key: 'energy', label: 'エネルギー', color: '#ffb454' },
        { key: 'angularMomentum', label: '角運動量', color: '#8ce99a' },
        { key: 'arealVelocity', label: '面積速度', color: '#c0a6ff' },
      ]),
    ],
    runtimeOptions: { dt: 1 / 20000 },
    simulationCode: `
// Units: au, years, solar masses. In these units G = 4 pi^2.
const G = 4 * Math.PI * Math.PI;
return {
  meta: { integrator: 'Velocity Verlet', units: 'au / yr / Msun, G = 4pi^2' },
  init(p) {
    const M = p.m1 + p.m2;
    const rp = p.a * (1 - p.ecc);                       // start at perihelion
    const vp = Math.sqrt((G * M * (1 + p.ecc)) / (p.a * (1 - p.ecc)));
    // Place the two bodies about a stationary centre of mass.
    const x1 = [-(p.m2 / M) * rp, 0], x2 = [(p.m1 / M) * rp, 0];
    const v1 = [0, -(p.m2 / M) * vp], v2 = [0, (p.m1 / M) * vp];
    return { x1, x2, v1, v2, a: null, trail: [], trail2: [] };
  },
  step(s, dt, p) {
    const acc = () => {
      const dx = s.x2[0] - s.x1[0], dy = s.x2[1] - s.x1[1];
      const r2 = dx * dx + dy * dy;
      const inv = 1 / (r2 * Math.sqrt(r2));
      return [
        [G * p.m2 * dx * inv, G * p.m2 * dy * inv],
        [-G * p.m1 * dx * inv, -G * p.m1 * dy * inv],
      ];
    };
    const a0 = s.a || acc();
    for (let i = 0; i < 2; i++) {
      s.x1[i] += s.v1[i] * dt + 0.5 * a0[0][i] * dt * dt;
      s.x2[i] += s.v2[i] * dt + 0.5 * a0[1][i] * dt * dt;
    }
    const a1 = acc();
    for (let i = 0; i < 2; i++) {
      s.v1[i] += 0.5 * (a0[0][i] + a1[0][i]) * dt;
      s.v2[i] += 0.5 * (a0[1][i] + a1[1][i]) * dt;
    }
    s.a = a1;
    return s;
  },
  sample(s, p, t) {
    const dx = s.x2[0] - s.x1[0], dy = s.x2[1] - s.x1[1];
    const r = Math.hypot(dx, dy);
    const dvx = s.v2[0] - s.v1[0], dvy = s.v2[1] - s.v1[1];
    const v = Math.hypot(dvx, dvy);
    const mu = (p.m1 * p.m2) / (p.m1 + p.m2);
    const E = 0.5 * mu * v * v - (G * p.m1 * p.m2) / r;
    const L = mu * (dx * dvy - dy * dvx);
    if (s.trail.length === 0 || Math.hypot(s.x2[0] - s.trail[s.trail.length - 1][0], s.x2[1] - s.trail[s.trail.length - 1][1]) > p.a * 0.004) {
      s.trail.push([s.x2[0], s.x2[1]]); if (s.trail.length > 3000) s.trail.shift();
      s.trail2.push([s.x1[0], s.x1[1]]); if (s.trail2.length > 3000) s.trail2.shift();
    }
    const scalars = {
      t, x: dx, y: dy, r, speed: v, energy: E, angularMomentum: L,
      arealVelocity: L / (2 * mu),
      // Kepler's third law in these units: T = sqrt(4 pi^2 a^3 / (G M_total)).
      period: Math.sqrt((4 * Math.PI * Math.PI * Math.pow(p.a, 3)) / (G * (p.m1 + p.m2))),
    };
    return {
      draw: {
        x1: s.x1, x2: s.x2, trail: s.trail, trail2: s.trail2,
        scale: p.a * (1 + p.ecc) * 1.25, m1: p.m1, m2: p.m2, comFrame: p.comFrame,
      },
      scalars, series: scalars,
    };
  },
};`,
    rendererCode: `
const d = frame.draw;
const R = d.scale;
const view = helpers.view({ xmin: -R, xmax: R, ymin: -R, ymax: R }, { pad: 14 });
helpers.grid(view, R / 4, R / 4);
ctx.strokeStyle = 'rgba(90,200,250,0.45)'; ctx.lineWidth = 1.2;
ctx.beginPath();
d.trail.forEach((p0, i) => (i ? ctx.lineTo(view.x(p0[0]), view.y(p0[1])) : ctx.moveTo(view.x(p0[0]), view.y(p0[1]))));
ctx.stroke();
ctx.strokeStyle = 'rgba(255,180,84,0.4)';
ctx.beginPath();
d.trail2.forEach((p0, i) => (i ? ctx.lineTo(view.x(p0[0]), view.y(p0[1])) : ctx.moveTo(view.x(p0[0]), view.y(p0[1]))));
ctx.stroke();
// Line joining the bodies: the radius vector that sweeps equal areas.
ctx.strokeStyle = 'rgba(219,230,240,0.35)'; ctx.setLineDash([3, 4]);
ctx.beginPath(); ctx.moveTo(view.x(d.x1[0]), view.y(d.x1[1])); ctx.lineTo(view.x(d.x2[0]), view.y(d.x2[1])); ctx.stroke();
ctx.setLineDash([]);
const star = (pos, r, color) => {
  const g = ctx.createRadialGradient(view.x(pos[0]), view.y(pos[1]), 1, view.x(pos[0]), view.y(pos[1]), r * 2.4);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(view.x(pos[0]), view.y(pos[1]), r * 2.4, 0, 2 * Math.PI); ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(view.x(pos[0]), view.y(pos[1]), r, 0, 2 * Math.PI); ctx.fill();
};
star(d.x1, 6 + 5 * Math.cbrt(d.m1), '#ffd479');
star(d.x2, 3 + 4 * Math.cbrt(d.m2), '#5ac8fa');
ctx.fillStyle = helpers.theme.muted;
ctx.beginPath(); ctx.arc(view.x(0), view.y(0), 2.5, 0, 2 * Math.PI); ctx.fill();
helpers.label('＋ 重心', view.x(0) + 8, view.y(0) - 8);`,
  }),

  sim({
    slug: 'three-body-problem',
    title: '三体問題',
    titleEn: 'Three-body problem',
    category: 'gravitation',
    shortDescription: '安定な8の字解から、わずかな摂動でカオス的な散乱へ移り変わる様子を追います。',
    description:
      'Chenciner–Montgomery の 8 の字周期解を初期条件として使います。摂動を 0 にすると三体は同じ 8 の字を' +
      '何周も描き続けますが、摂動を 10⁻³ 程度与えるだけで解は崩れ、やがて一体が放出される散乱状態になります。\n\n' +
      '時間刻みが粗いと接近遭遇でエネルギーが跳ねます。エネルギー誤差のグラフを見ながら精度を判断してください。',
    physicsTopics: ['三体問題', 'カオス', '重力多体系', '数値安定性'],
    formulas: [{ text: 'r̈ᵢ = Σ_{j≠i} G mⱼ (rⱼ − rᵢ) / |rⱼ − rᵢ|³' }],
    tags: ['gravitation', 'chaos', 'n-body', 'numerical-simulation', 'university-physics'],
    difficulty: 4,
    targetLevel: 'undergraduate',
    parameterDefinitions: [
      choice('preset', '初期条件', 'figure8', [
        { value: 'figure8', label: '8の字解' },
        { value: 'triangle', label: 'ラグランジュ正三角形' },
        { value: 'random', label: 'ランダム' },
      ], { restart: true }),
      range('perturbation', '摂動の大きさ', 0, 0, 0.05, 0.0005, { unit: '', restart: true }),
      range('mass', '各天体の質量', 1, 0.2, 3, 0.05, { unit: '', restart: true }),
      range('softening', 'ソフトニング長', 0.01, 0.001, 0.2, 0.001, { unit: '', help: '接近遭遇での発散を抑えます' }),
      range('seed', '乱数シード', 7, 1, 200, 1, { restart: true }),
    ],
    displayDefinitions: [
      read('t', '時間', '', 3),
      read('energy', '全エネルギー', '', 6),
      read('energyDrift', 'エネルギー誤差', '', 8),
      read('momentum', '全運動量', '', 8),
      read('minSeparation', '最接近距離', '', 4),
      read('virial', '2T/|U|', '', 4),
    ],
    graphDefinitions: [
      xyGraph('paths', '軌跡', { key: 'x1', label: 'x', unit: '' }, [{ key: 'y1', label: '天体 1', color: '#5ac8fa' }]),
      timeGraph('energy', 'エネルギー誤差', [{ key: 'energyDrift', label: 'ΔE', color: '#ff8fa3' }]),
      timeGraph('sep', '最接近距離', [{ key: 'minSeparation', label: 'r_min', color: '#8ce99a' }]),
    ],
    runtimeOptions: { dt: 1 / 20000 },
    simulationCode: `
const G = 1;
function presets(p) {
  if (p.preset === 'figure8') {
    // Chenciner & Montgomery (2000) figure-eight initial conditions.
    const vx = 0.93240737, vy = 0.86473146;
    return [
      { x: [0.97000436, -0.24308753], v: [vx / 2, vy / 2] },
      { x: [-0.97000436, 0.24308753], v: [vx / 2, vy / 2] },
      { x: [0, 0], v: [-vx, -vy] },
    ];
  }
  if (p.preset === 'triangle') {
    const bodies = [];
    for (let i = 0; i < 3; i++) {
      const a = (2 * Math.PI * i) / 3;
      const r = 1;
      const v = Math.sqrt((G * p.mass) / Math.sqrt(3));
      bodies.push({ x: [r * Math.cos(a), r * Math.sin(a)], v: [-v * Math.sin(a), v * Math.cos(a)] });
    }
    return bodies;
  }
  const rnd = PL.rng(p.seed);
  return [0, 1, 2].map(() => ({ x: [rnd.range(-1, 1), rnd.range(-1, 1)], v: [rnd.range(-0.4, 0.4), rnd.range(-0.4, 0.4)] }));
}
return {
  meta: { integrator: 'Velocity Verlet with Plummer softening' },
  init(p) {
    const rnd = PL.rng(p.seed + 1);
    const bodies = presets(p).map((b) => ({
      m: p.mass,
      x: [b.x[0] + rnd.range(-1, 1) * p.perturbation, b.x[1] + rnd.range(-1, 1) * p.perturbation],
      v: [b.v[0] + rnd.range(-1, 1) * p.perturbation, b.v[1] + rnd.range(-1, 1) * p.perturbation],
    }));
    const s = { bodies, trails: [[], [], []], a: null, e0: null, minSep: Infinity };
    s.e0 = energy(s.bodies, p);
    return s;
  },
  step(s, dt, p) {
    const acc = () => PL.nBodyAccelerations(s.bodies, G, p.softening);
    const a0 = s.a || acc();
    s.bodies.forEach((b, i) => {
      for (let k = 0; k < 2; k++) b.x[k] += b.v[k] * dt + 0.5 * a0[i][k] * dt * dt;
    });
    const a1 = acc();
    s.bodies.forEach((b, i) => {
      for (let k = 0; k < 2; k++) b.v[k] += 0.5 * (a0[i][k] + a1[i][k]) * dt;
    });
    s.a = a1;
    return s;
  },
  sample(s, p, t) {
    s.bodies.forEach((b, i) => {
      const tr = s.trails[i];
      if (!tr.length || Math.hypot(b.x[0] - tr[tr.length - 1][0], b.x[1] - tr[tr.length - 1][1]) > 0.006) {
        tr.push([b.x[0], b.x[1]]);
        if (tr.length > 2200) tr.shift();
      }
    });
    let minSep = Infinity;
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) minSep = Math.min(minSep, PL.vec.dist(s.bodies[i].x, s.bodies[j].x));
    s.minSep = Math.min(s.minSep, minSep);
    const T = PL.kineticEnergy(s.bodies);
    const U = PL.gravitationalPotential(s.bodies, G, p.softening);
    const pmom = PL.totalMomentum(s.bodies);
    const scalars = {
      t, energy: T + U, energyDrift: T + U - s.e0,
      momentum: Math.hypot(pmom[0], pmom[1]),
      minSeparation: minSep, virial: Math.abs(U) > 0 ? (2 * T) / Math.abs(U) : 0,
      x1: s.bodies[0].x[0], y1: s.bodies[0].x[1],
    };
    const extent = Math.max(2, ...s.bodies.map((b) => Math.hypot(b.x[0], b.x[1]) * 1.3));
    return { draw: { bodies: s.bodies.map((b) => b.x.slice()), trails: s.trails, extent }, scalars, series: scalars };
  },
};
function energy(bodies, p) {
  return PL.kineticEnergy(bodies) + PL.gravitationalPotential(bodies, 1, p.softening);
}`,
    rendererCode: `
const d = frame.draw;
const R = Math.min(d.extent, 12);
const view = helpers.view({ xmin: -R, xmax: R, ymin: -R, ymax: R }, { pad: 12 });
helpers.grid(view, R / 3, R / 3);
d.trails.forEach((tr, i) => {
  ctx.strokeStyle = helpers.colorFor(i); ctx.globalAlpha = 0.55; ctx.lineWidth = 1.3;
  ctx.beginPath();
  tr.forEach((pt, k) => (k ? ctx.lineTo(view.x(pt[0]), view.y(pt[1])) : ctx.moveTo(view.x(pt[0]), view.y(pt[1]))));
  ctx.stroke(); ctx.globalAlpha = 1;
});
d.bodies.forEach((b, i) => {
  const color = helpers.colorFor(i);
  const g = ctx.createRadialGradient(view.x(b[0]), view.y(b[1]), 1, view.x(b[0]), view.y(b[1]), 16);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(view.x(b[0]), view.y(b[1]), 16, 0, 2 * Math.PI); ctx.fill();
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(view.x(b[0]), view.y(b[1]), 5, 0, 2 * Math.PI); ctx.fill();
});`,
  }),

  sim({
    slug: 'orbital-launch',
    title: '人工衛星と脱出速度',
    titleEn: 'Satellite orbits and escape velocity',
    category: 'gravitation',
    shortDescription: '打ち上げ速度を変えると、弾道・円軌道・楕円軌道・脱出軌道が連続的に切り替わります。',
    description:
      '地球表面から水平に打ち出した物体の軌道を追跡します。第一宇宙速度（約 7.91 km/s）で円軌道、' +
      'それ以上で楕円、第二宇宙速度（約 11.2 km/s）を超えると双曲線軌道になって戻ってきません。\n\n' +
      '軌道種別は軌道エネルギー E = v²/2 − μ/r の符号から判定して表示します。E < 0 なら束縛（楕円）、' +
      'E = 0 で放物線、E > 0 で双曲線です。',
    physicsTopics: ['人工衛星', '円軌道', '楕円軌道', '脱出速度', '軌道エネルギー'],
    formulas: [
      { text: 'v_円 = √(GM/r) ≈ 7.91 km/s', note: '地表付近' },
      { text: 'v_脱出 = √(2GM/r) ≈ 11.2 km/s' },
      { text: 'ε = v²/2 − μ/r', note: '符号で軌道種別が決まる' },
      { text: 'a = −μ / 2ε' },
    ],
    tags: ['gravitation', 'orbit', 'satellite', 'space', 'high-school'],
    difficulty: 2,
    parameterDefinitions: [
      range('v0', '打ち上げ速度', 7.905, 1, 16, 0.005, { unit: 'km/s', restart: true }),
      range('altitude', '打ち上げ高度', 200, 0, 20000, 10, { unit: 'km', restart: true }),
      range('angle', '打ち上げ角（水平から）', 0, -60, 60, 1, { unit: '°', restart: true }),
      toggle('drag', '低高度で大気抵抗を考慮', false),
    ],
    displayDefinitions: [
      read('t', '経過時間', 's', 0),
      read('altitudeKm', '高度', 'km', 1),
      read('speedKms', '速さ', 'km/s', 4),
      read('apoapsis', '遠地点高度', 'km', 1),
      read('periapsis', '近地点高度', 'km', 1),
      read('eccentricity', '離心率', '', 4),
      read('orbitEnergy', '軌道エネルギー', 'MJ/kg', 4),
      read('orbitType', '軌道種別（1楕円/2放物線/3双曲線/0墜落）', '', 0),
    ],
    graphDefinitions: [
      xyGraph('path', '軌道（地球中心座標）', { key: 'xKm', label: 'x', unit: 'km' }, [{ key: 'yKm', label: 'y', color: '#5ac8fa' }]),
      timeGraph('alt', '高度', [{ key: 'altitudeKm', label: '高度', color: '#5ac8fa' }]),
      timeGraph('v', '速さ', [{ key: 'speedKms', label: 'v', color: '#ffb454' }]),
    ],
    runtimeOptions: { dt: 0.05, speed: 60 },
    simulationCode: `
const RE = 6371e3;              // Earth radius, m
const MU = 3.986004418e14;      // GM, m^3/s^2
return {
  meta: { integrator: 'Velocity Verlet, SI units' },
  init(p) {
    const r0 = RE + p.altitude * 1000;
    const a = (p.angle * Math.PI) / 180;
    const v = p.v0 * 1000;
    return {
      x: [0, r0],
      v: [v * Math.cos(a), v * Math.sin(a)],
      acc: null, trail: [[0, r0]], crashed: false, apo: r0, peri: r0,
    };
  },
  step(s, dt, p) {
    if (s.crashed) return s;
    const accel = (x, v) => {
      const r = Math.hypot(x[0], x[1]);
      const g = -MU / (r * r * r);
      let ax = g * x[0], ay = g * x[1];
      if (p.drag) {
        const h = r - RE;
        const rho = 1.225 * Math.exp(-Math.max(h, 0) / 8500);   // isothermal atmosphere
        const sp = Math.hypot(v[0], v[1]);
        const k = 0.5 * rho * 2.2e-3 * sp;                       // (Cd A / m) lumped
        ax -= k * v[0]; ay -= k * v[1];
      }
      return [ax, ay];
    };
    const a0 = s.acc || accel(s.x, s.v);
    const xNew = [s.x[0] + s.v[0] * dt + 0.5 * a0[0] * dt * dt, s.x[1] + s.v[1] * dt + 0.5 * a0[1] * dt * dt];
    const vHalf = [s.v[0] + 0.5 * a0[0] * dt, s.v[1] + 0.5 * a0[1] * dt];
    const a1 = accel(xNew, vHalf);
    s.v = [vHalf[0] + 0.5 * a1[0] * dt, vHalf[1] + 0.5 * a1[1] * dt];
    s.x = xNew; s.acc = a1;
    const r = Math.hypot(s.x[0], s.x[1]);
    if (r <= RE) { s.crashed = true; }
    s.apo = Math.max(s.apo, r); s.peri = Math.min(s.peri, r);
    const last = s.trail[s.trail.length - 1];
    if (Math.hypot(s.x[0] - last[0], s.x[1] - last[1]) > RE * 0.01) {
      s.trail.push([s.x[0], s.x[1]]);
      if (s.trail.length > 4000) s.trail.shift();
    }
    return s;
  },
  sample(s, p, t) {
    const r = Math.hypot(s.x[0], s.x[1]);
    const v = Math.hypot(s.v[0], s.v[1]);
    const eps = (v * v) / 2 - MU / r;
    const h = s.x[0] * s.v[1] - s.x[1] * s.v[0];
    const ecc = Math.sqrt(Math.max(0, 1 + (2 * eps * h * h) / (MU * MU)));
    const a = eps < 0 ? -MU / (2 * eps) : Infinity;
    const type = s.crashed ? 0 : eps < -1 ? 1 : Math.abs(eps) < 1 ? 2 : 3;
    const scalars = {
      t, xKm: s.x[0] / 1000, yKm: s.x[1] / 1000,
      altitudeKm: (r - RE) / 1000, speedKms: v / 1000,
      apoapsis: Number.isFinite(a) ? (a * (1 + ecc) - RE) / 1000 : Infinity,
      periapsis: Number.isFinite(a) ? (a * (1 - ecc) - RE) / 1000 : (s.peri - RE) / 1000,
      eccentricity: ecc, orbitEnergy: eps / 1e6, orbitType: type,
    };
    if (!Number.isFinite(scalars.apoapsis)) scalars.apoapsis = 0;
    return {
      draw: {
        x: s.x, trail: s.trail, RE,
        scale: Math.max(RE * 1.6, Math.min(r * 1.5, RE * 40)),
        crashed: s.crashed, type,
      },
      scalars, series: scalars,
    };
  },
};`,
    rendererCode: `
const d = frame.draw;
const R = d.scale;
const view = helpers.view({ xmin: -R, xmax: R, ymin: -R, ymax: R }, { pad: 10 });
// Earth.
const cx = view.x(0), cy = view.y(0), re = view.len(d.RE);
const g = ctx.createRadialGradient(cx - re * 0.3, cy - re * 0.3, re * 0.1, cx, cy, re);
g.addColorStop(0, '#2b6c9b'); g.addColorStop(1, '#10334c');
ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, re, 0, 2 * Math.PI); ctx.fill();
ctx.strokeStyle = 'rgba(120,200,250,0.35)'; ctx.lineWidth = 1;
ctx.beginPath(); ctx.arc(cx, cy, re * 1.02, 0, 2 * Math.PI); ctx.stroke();
// Trajectory.
const colors = ['#ff8fa3', '#5ac8fa', '#ffd479', '#c0a6ff'];
ctx.strokeStyle = colors[d.type] || '#5ac8fa'; ctx.lineWidth = 1.8;
ctx.beginPath();
d.trail.forEach((pt, i) => (i ? ctx.lineTo(view.x(pt[0]), view.y(pt[1])) : ctx.moveTo(view.x(pt[0]), view.y(pt[1]))));
ctx.stroke();
ctx.fillStyle = d.crashed ? '#ff8fa3' : '#ffffff';
ctx.beginPath(); ctx.arc(view.x(d.x[0]), view.y(d.x[1]), 4.5, 0, 2 * Math.PI); ctx.fill();
const names = ['地表に落下', '楕円軌道', '放物線軌道', '双曲線軌道'];
helpers.label(names[d.type], 12, 20, { color: colors[d.type], font: '13px "IBM Plex Sans", sans-serif' });`,
  }),
];
