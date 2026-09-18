import { sim, range, toggle, read, timeGraph, xyGraph } from './common.js';

/**
 * Experiments reuse the simulation runtime but add an `experiment` block:
 * an objective, conditions, a procedure, a measurement table and an analysis
 * snippet that is evaluated in the same sandbox as the simulation code.
 */
export const experiments = [
  sim({
    slug: 'measure-g-with-a-pendulum',
    title: '実験：単振り子から重力加速度を求める',
    titleEn: 'Experiment: measuring g with a pendulum',
    category: 'mechanics',
    type: 'experiment',
    difficulty: 2,
    shortDescription: 'ひもの長さを変えて周期を測り、T²–L グラフの傾きから g を決定します。',
    description:
      '実際の実験室でやることと同じ手順を踏みます。ひもの長さ L を変えながら 10 往復の時間を測り、' +
      '周期 T を求めて T² を L に対してプロットします。理論式 T = 2π√(L/g) より T² = (4π²/g)L なので、' +
      '直線の傾き a から g = 4π²/a が得られます。\n\n' +
      '測定には人間の反応時間に相当するランダムな誤差が乗ります。測定点を増やして最小二乗フィットすれば、' +
      '誤差が平均化されて真の値に近づいていくことを体験できます。',
    physicsTopics: ['単振り子', '重力加速度の測定', '最小二乗法', '測定誤差'],
    formulas: [
      { text: 'T = 2π √(L/g)' },
      { text: 'T² = (4π²/g) L' },
      { text: 'g = 4π² / 傾き' },
    ],
    tags: ['mechanics', 'oscillation', 'experiment', 'measurement', 'high-school'],
    parameterDefinitions: [
      range('length', 'ひもの長さ L', 0.5, 0.1, 2, 0.01, { unit: 'm', restart: true }),
      range('theta0', '振れ角', 8, 1, 30, 1, { unit: '°', restart: true }),
      range('trueG', '（隠し）真の g', 9.80665, 9.6, 9.9, 0.00001, { unit: 'm/s²', restart: true, help: '地域による違いを再現するために変えられます' }),
      range('timingError', 'ストップウォッチの誤差', 0.15, 0, 0.5, 0.01, { unit: 's' }),
      range('seed', '測定のばらつきのシード', 42, 1, 999, 1),
    ],
    displayDefinitions: [
      read('t', '経過時間', 's', 2),
      read('swings', '往復回数', '回', 0),
      read('elapsedTen', '10往復の時間（誤差込み）', 's', 3),
      read('measuredPeriod', '測定した周期 T', 's', 4),
      read('truePeriod', '真の周期', 's', 4),
      read('lengthNow', '現在の L', 'm', 3),
    ],
    graphDefinitions: [
      timeGraph('theta', '振れ角', [{ key: 'thetaDeg', label: 'θ', color: '#5ac8fa' }]),
    ],
    runtimeOptions: { dt: 1 / 4000 },
    simulationCode: `
return {
  meta: { integrator: 'Velocity Verlet, with simulated timing noise' },
  init(p) {
    return {
      th: (p.theta0 * Math.PI) / 180, om: 0, tAbs: 0, swings: 0,
      lastUp: null, tenStart: null, tenTime: 0, rnd: PL.rng(p.seed),
    };
  },
  step(s, dt, p) {
    const accel = (th) => -(p.trueG / p.length) * Math.sin(th);
    const a0 = accel(s.th);
    const thNew = s.th + s.om * dt + 0.5 * a0 * dt * dt;
    const a1 = accel(thNew);
    s.om += 0.5 * (a0 + a1) * dt;
    const prev = s.th;
    s.th = thNew;
    s.tAbs += dt;
    // Count full swings at the upward zero crossing.
    if (prev < 0 && s.th >= 0) {
      s.swings++;
      if (s.swings % 10 === 1) s.tenStart = s.tAbs;
      if (s.swings % 10 === 1 && s.tenStart !== null && s.swings > 1) {
        // A stopwatch reading of ten swings, with human timing error.
        s.tenTime = s.tAbs - s.lastTen + s.rnd.normal(0, p.timingError);
      }
      if ((s.swings - 1) % 10 === 0) s.lastTen = s.tAbs;
    }
    return s;
  },
  sample(s, p, t) {
    const truePeriod = 2 * Math.PI * Math.sqrt(p.length / p.trueG);
    return {
      draw: { th: s.th, L: p.length, swings: s.swings },
      scalars: {
        t, swings: s.swings, thetaDeg: (s.th * 180) / Math.PI,
        elapsedTen: s.tenTime || 0,
        measuredPeriod: s.tenTime ? s.tenTime / 10 : 0,
        truePeriod, lengthNow: p.length,
      },
      series: { t, thetaDeg: (s.th * 180) / Math.PI },
    };
  },
};`,
    rendererCode: `
const d = frame.draw;
const view = helpers.view({ xmin: -d.L * 1.2, xmax: d.L * 1.2, ymin: -d.L * 1.2, ymax: d.L * 0.4 }, { pad: 18 });
const ox = view.x(0), oy = view.y(0);
const px = view.x(d.L * Math.sin(d.th)), py = view.y(-d.L * Math.cos(d.th));
ctx.strokeStyle = 'rgba(120,150,175,0.3)';
ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox, view.y(-d.L * 1.1)); ctx.stroke();
ctx.strokeStyle = helpers.theme.ink; ctx.lineWidth = 1.6;
ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(px, py); ctx.stroke();
ctx.fillStyle = helpers.theme.trace[0];
ctx.beginPath(); ctx.arc(px, py, 12, 0, 2 * Math.PI); ctx.fill();
helpers.label('往復 ' + d.swings + ' 回', 12, 20, { color: helpers.theme.ink, font: '14px "IBM Plex Mono", monospace' });`,
    experiment: {
      objective: '長さの異なる単振り子の周期を測定し、T²–L グラフの傾きから重力加速度 g を決定する。',
      conditions: [
        '振れ角は 10° 以下に保つ（小角度近似が成り立つ範囲）',
        '10 往復の時間を測って 10 で割り、1 回の測定誤差を 1/10 にする',
        'ひもの長さは 0.2 m から 1.5 m の範囲で 5 点以上とる',
        '同じ長さで 3 回測り、平均をとる',
      ],
      procedure: [
        'ひもの長さ L を設定し、シミュレーションを開始する',
        '「10往復の時間」が表示されたら、L と一緒に測定表に記録する',
        'L を変えて、5 点以上のデータを集める',
        '解析を実行し、T²–L の傾きから g を求める',
        '得られた g と真の値（9.80665 m/s²）を比べ、相対誤差を評価する',
      ],
      measurements: [
        { key: 'L', label: 'ひもの長さ L', unit: 'm', source: 'readout', from: 'lengthNow' },
        { key: 'T', label: '測定した周期 T', unit: 's', source: 'readout', from: 'measuredPeriod' },
      ],
      theory: { label: '重力加速度 g', value: 9.80665, unit: 'm/s²' },
      analysisCode: `
// input.rows: [{ L, T }, ...]
const rows = input.rows.filter((r) => r.L > 0 && r.T > 0);
if (rows.length < 2) return { error: '2 点以上のデータが必要です。' };
const xs = rows.map((r) => Number(r.L));
const ys = rows.map((r) => Math.pow(Number(r.T), 2));
const fit = PL.linearFit(xs, ys);
const g = (4 * Math.PI * Math.PI) / fit.slope;
const gError = (4 * Math.PI * Math.PI * fit.slopeError) / (fit.slope * fit.slope);
return {
  fit: { slope: fit.slope, intercept: fit.intercept, r2: fit.r2, slopeError: fit.slopeError },
  points: xs.map((x, i) => [x, ys[i]]),
  result: { label: '重力加速度 g', value: g, uncertainty: gError, unit: 'm/s²' },
  xLabel: 'L [m]',
  yLabel: 'T² [s²]',
};`,
    },
  }),

  sim({
    slug: 'measure-rc-time-constant',
    title: '実験：RC回路の時定数を測る',
    titleEn: 'Experiment: measuring the RC time constant',
    category: 'circuits',
    type: 'experiment',
    difficulty: 2,
    shortDescription: '放電曲線の電圧を記録し、ln V の傾きから τ = RC を求めます。',
    description:
      '充電したコンデンサーを抵抗を通して放電させ、一定間隔で電圧を読み取ります。' +
      'V = V₀e^{−t/RC} の両辺の対数をとると ln V = ln V₀ − t/RC なので、ln V を t に対してプロットした直線の' +
      '傾きの逆数の符号を変えたものが時定数 τ になります。\n\n' +
      '電圧計の分解能に相当するノイズが乗るため、V が小さくなった領域では対数が暴れます。' +
      'どこまでのデータを使うかという判断そのものが、実験データ解析の練習になります。',
    physicsTopics: ['RC回路', '時定数', '指数関数', '片対数プロット'],
    formulas: [
      { text: 'V(t) = V₀ e^{−t/RC}' },
      { text: 'ln V = ln V₀ − t/τ' },
      { text: 'τ = RC' },
    ],
    tags: ['electromagnetism', 'circuits', 'experiment', 'measurement', 'high-school'],
    parameterDefinitions: [
      range('V0', '初期電圧 V₀', 5, 1, 24, 0.1, { unit: 'V', restart: true }),
      range('R', '抵抗 R', 47000, 1000, 500000, 1000, { unit: 'Ω', restart: true }),
      range('C', '静電容量 C', 22, 1, 470, 1, { unit: 'µF', restart: true }),
      range('noise', '電圧計のノイズ', 0.02, 0, 0.2, 0.005, { unit: 'V' }),
      range('seed', 'ノイズのシード', 9, 1, 999, 1),
    ],
    displayDefinitions: [
      read('t', '経過時間', 's', 3),
      read('voltage', '測定電圧', 'V', 4),
      read('trueVoltage', '真の電圧', 'V', 4),
      read('trueTau', '（隠し）真の τ', 's', 4),
      read('fraction', 'V / V₀', '', 4),
    ],
    graphDefinitions: [
      timeGraph('v', '放電曲線', [
        { key: 'voltage', label: '測定値', color: '#5ac8fa' },
        { key: 'trueVoltage', label: '真の値', color: '#7d93a6' },
      ]),
    ],
    runtimeOptions: { dt: 1 / 2000 },
    simulationCode: `
return {
  meta: { integrator: 'analytic decay with measurement noise' },
  init(p) { return { v: p.V0, rnd: PL.rng(p.seed), tAbs: 0 }; },
  step(s, dt, p) {
    const tau = p.R * p.C * 1e-6;
    s.v = s.v * Math.exp(-dt / tau);
    s.tAbs += dt;
    return s;
  },
  sample(s, p, t) {
    const tau = p.R * p.C * 1e-6;
    const measured = s.v + s.rnd.normal(0, p.noise);
    return {
      draw: { v: s.v, V0: p.V0, measured, tau, t },
      scalars: {
        t, voltage: measured, trueVoltage: s.v, trueTau: tau, fraction: s.v / p.V0,
      },
      series: { t, voltage: measured, trueVoltage: s.v },
      done: s.v < p.V0 * 0.005,
    };
  },
};`,
    rendererCode: `
const d = frame.draw;
const w = helpers.w, h = helpers.h;
// Voltmeter face.
ctx.strokeStyle = helpers.theme.gridStrong; ctx.lineWidth = 1.5;
ctx.strokeRect(w * 0.08, h * 0.16, w * 0.38, h * 0.5);
ctx.fillStyle = helpers.theme.trace[0];
ctx.font = '600 34px "IBM Plex Mono", monospace'; ctx.textAlign = 'center';
ctx.fillText(d.measured.toFixed(3) + ' V', w * 0.27, h * 0.45);
helpers.label('電圧計', w * 0.27, h * 0.6, { align: 'center' });
// Discharge bar.
const frac = Math.max(0, d.v / d.V0);
ctx.fillStyle = 'rgba(90,200,250,0.25)';
ctx.fillRect(w * 0.58, h * 0.16, w * 0.12, h * 0.5);
ctx.fillStyle = helpers.theme.trace[0];
ctx.fillRect(w * 0.58, h * 0.16 + h * 0.5 * (1 - frac), w * 0.12, h * 0.5 * frac);
// Time-constant markers at 1τ, 2τ, 3τ.
ctx.strokeStyle = helpers.theme.muted; ctx.lineWidth = 1;
[0.368, 0.135, 0.05].forEach((f, i) => {
  const y = h * 0.16 + h * 0.5 * (1 - f);
  ctx.beginPath(); ctx.moveTo(w * 0.7, y); ctx.lineTo(w * 0.76, y); ctx.stroke();
  helpers.label((i + 1) + 'τ', w * 0.78, y + 4);
});
helpers.label('t = ' + d.t.toFixed(2) + ' s', 12, h - 12, { color: helpers.theme.ink });`,
    experiment: {
      objective: 'コンデンサーの放電曲線から時定数 τ を求め、τ = RC が成り立つことを確かめる。',
      conditions: [
        'R と C の公称値を記録しておく（比較の基準になる）',
        '0.5τ 程度の間隔で、少なくとも 3τ まで電圧を読み取る',
        'V が V₀ の 5% を下回った点はノイズが支配的なので除外を検討する',
      ],
      procedure: [
        'シミュレーションを開始し、放電の様子を観察する',
        '一定間隔で「測定電圧」と「経過時間」を測定表に記録する（6 点以上）',
        '解析を実行し、ln V–t の直線の傾きから τ を求める',
        '得られた τ を公称値 RC と比べ、相対誤差を評価する',
      ],
      measurements: [
        { key: 't', label: '時刻 t', unit: 's', source: 'readout', from: 't' },
        { key: 'V', label: '電圧 V', unit: 'V', source: 'readout', from: 'voltage' },
      ],
      theory: { label: '時定数 τ = RC', value: 1.034, unit: 's' },
      analysisCode: `
const rows = input.rows.filter((r) => Number(r.V) > 0);
if (rows.length < 2) return { error: '正の電圧のデータが 2 点以上必要です。' };
const xs = rows.map((r) => Number(r.t));
const ys = rows.map((r) => Math.log(Number(r.V)));
const fit = PL.linearFit(xs, ys);
const tau = -1 / fit.slope;
const tauError = Math.abs(fit.slopeError / (fit.slope * fit.slope));
return {
  fit,
  points: xs.map((x, i) => [x, ys[i]]),
  result: { label: '時定数 τ', value: tau, uncertainty: tauError, unit: 's' },
  xLabel: 't [s]',
  yLabel: 'ln V',
};`,
    },
  }),
];
