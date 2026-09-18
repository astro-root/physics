/**
 * Dynamis — numerical core.
 *
 * This file is deliberately dependency-free, side-effect-free, plain JavaScript.
 * It is used in two places:
 *   1. imported normally by the test suite and by app code;
 *   2. read as raw source text and injected into the sandboxed simulation worker,
 *      where it is exposed to author code as the global `PL`.
 *
 * Because of (2) it must not import anything, and the only `export` statement is
 * the final default export, which the injector strips.
 */

const PhysicsCore = (function () {
  // ---------------------------------------------------------------- constants
  const constants = {
    g: 9.80665, // standard gravity, m/s^2
    G: 6.6743e-11, // gravitational constant, m^3 kg^-1 s^-2
    c: 2.99792458e8, // speed of light, m/s
    e: 1.602176634e-19, // elementary charge, C
    me: 9.1093837015e-31, // electron mass, kg
    mp: 1.67262192369e-27, // proton mass, kg
    kB: 1.380649e-23, // Boltzmann constant, J/K
    h: 6.62607015e-34, // Planck constant, J s
    hbar: 1.054571817e-34,
    eps0: 8.8541878128e-12,
    mu0: 1.25663706212e-6,
    ke: 8.9875517923e9, // Coulomb constant, N m^2 C^-2
    NA: 6.02214076e23,
    R: 8.314462618,
    AU: 1.495978707e11,
    Msun: 1.98892e30,
    Mearth: 5.9722e24,
    yr: 3.15576e7,
  };

  // --------------------------------------------------------------- vector ops
  // Vectors are plain arrays so that they serialise across postMessage cheaply.
  const vec = {
    add: (a, b) => a.map((v, i) => v + b[i]),
    sub: (a, b) => a.map((v, i) => v - b[i]),
    scale: (a, s) => a.map((v) => v * s),
    dot: (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
    norm: (a) => Math.hypot(...a),
    norm2: (a) => a.reduce((s, v) => s + v * v, 0),
    dist: (a, b) => Math.hypot(...a.map((v, i) => v - b[i])),
    unit: (a) => {
      const n = Math.hypot(...a);
      return n === 0 ? a.map(() => 0) : a.map((v) => v / n);
    },
    cross: (a, b) => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ],
    cross2: (a, b) => a[0] * b[1] - a[1] * b[0],
    clone: (a) => a.slice(),
    zeros: (n) => new Array(n).fill(0),
  };

  // ----------------------------------------------------------- generic state
  // A "state vector" is a flat array of numbers. `deriv(t, y) -> dy/dt`.

  /** Explicit (forward) Euler. First order. Cheap, and energy-unstable — kept for
   *  teaching comparisons between integrators, not as a default. */
  function euler(deriv, t, y, dt) {
    const dy = deriv(t, y);
    const out = new Array(y.length);
    for (let i = 0; i < y.length; i++) out[i] = y[i] + dy[i] * dt;
    return out;
  }

  /** Classical 4th-order Runge–Kutta. The default for non-conservative or
   *  stiff-ish systems (circuits, drag, decay, chaotic flows). */
  function rk4(deriv, t, y, dt) {
    const n = y.length;
    const k1 = deriv(t, y);
    const y2 = new Array(n);
    for (let i = 0; i < n; i++) y2[i] = y[i] + (dt / 2) * k1[i];
    const k2 = deriv(t + dt / 2, y2);
    const y3 = new Array(n);
    for (let i = 0; i < n; i++) y3[i] = y[i] + (dt / 2) * k2[i];
    const k3 = deriv(t + dt / 2, y3);
    const y4 = new Array(n);
    for (let i = 0; i < n; i++) y4[i] = y[i] + dt * k3[i];
    const k4 = deriv(t + dt, y4);
    const out = new Array(n);
    for (let i = 0; i < n; i++) {
      out[i] = y[i] + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
    }
    return out;
  }

  /** Semi-implicit (symplectic) Euler for separable systems.
   *  `accel(t, x, v) -> a`. First order but does not pump energy secularly. */
  function semiImplicitEuler(accel, t, x, v, dt) {
    const a = accel(t, x, v);
    const vNew = v.map((vi, i) => vi + a[i] * dt);
    const xNew = x.map((xi, i) => xi + vNew[i] * dt);
    return { x: xNew, v: vNew, a };
  }

  /** Velocity Verlet. Second order, symplectic, time-reversible.
   *  Default for gravitational N-body and spring/oscillator systems. */
  function velocityVerlet(accel, t, x, v, dt, aPrev) {
    const a0 = aPrev || accel(t, x, v);
    const n = x.length;
    const xNew = new Array(n);
    for (let i = 0; i < n; i++) xNew[i] = x[i] + v[i] * dt + 0.5 * a0[i] * dt * dt;
    // Half-kick first so that velocity-dependent forces (drag, magnetic) see a
    // consistent estimate; for velocity-independent forces this is exact.
    const vHalf = new Array(n);
    for (let i = 0; i < n; i++) vHalf[i] = v[i] + 0.5 * a0[i] * dt;
    const a1 = accel(t + dt, xNew, vHalf);
    const vNew = new Array(n);
    for (let i = 0; i < n; i++) vNew[i] = vHalf[i] + 0.5 * a1[i] * dt;
    return { x: xNew, v: vNew, a: a1 };
  }

  /** Position (Störmer) Verlet, for when only positions matter. */
  function positionVerlet(accel, t, x, xPrev, dt) {
    const a = accel(t, x);
    return x.map((xi, i) => 2 * xi - xPrev[i] + a[i] * dt * dt);
  }

  /** Boris pusher — the correct integrator for a charged particle in E and B.
   *  Conserves energy in a pure magnetic field exactly (to round-off). */
  function borisPush(x, v, qOverM, E, B, dt) {
    const h = (qOverM * dt) / 2;
    const vMinus = [v[0] + h * E[0], v[1] + h * E[1], v[2] + h * E[2]];
    const t = [h * B[0], h * B[1], h * B[2]];
    const t2 = t[0] * t[0] + t[1] * t[1] + t[2] * t[2];
    const s = [(2 * t[0]) / (1 + t2), (2 * t[1]) / (1 + t2), (2 * t[2]) / (1 + t2)];
    const vPrime = vec.add(vMinus, vec.cross(vMinus, t));
    const vPlus = vec.add(vMinus, vec.cross(vPrime, s));
    const vNew = [vPlus[0] + h * E[0], vPlus[1] + h * E[1], vPlus[2] + h * E[2]];
    const xNew = [x[0] + vNew[0] * dt, x[1] + vNew[1] * dt, x[2] + vNew[2] * dt];
    return { x: xNew, v: vNew };
  }

  /** Adaptive RK45 (Cash–Karp) step. Returns the accepted step and the dt to
   *  use next. Used where the timescale varies by orders of magnitude
   *  (close encounters, eccentric orbits, scattering). */
  function rk45Step(deriv, t, y, dt, tol = 1e-8, dtMin = 1e-9, dtMax = Infinity) {
    const a = [0, 1 / 5, 3 / 10, 3 / 5, 1, 7 / 8];
    const b = [
      [],
      [1 / 5],
      [3 / 40, 9 / 40],
      [3 / 10, -9 / 10, 6 / 5],
      [-11 / 54, 5 / 2, -70 / 27, 35 / 27],
      [1631 / 55296, 175 / 512, 575 / 13824, 44275 / 110592, 253 / 4096],
    ];
    const c5 = [37 / 378, 0, 250 / 621, 125 / 594, 0, 512 / 1771];
    const c4 = [2825 / 27648, 0, 18575 / 48384, 13525 / 55296, 277 / 14336, 1 / 4];
    const n = y.length;
    let h = dt;
    for (let attempt = 0; attempt < 12; attempt++) {
      const k = [];
      for (let i = 0; i < 6; i++) {
        const yi = y.slice();
        for (let j = 0; j < i; j++) {
          const bij = b[i][j];
          if (!bij) continue;
          for (let m = 0; m < n; m++) yi[m] += h * bij * k[j][m];
        }
        k.push(deriv(t + a[i] * h, yi));
      }
      const y5 = new Array(n);
      const y4 = new Array(n);
      let err = 0;
      let scale = 0;
      for (let m = 0; m < n; m++) {
        let s5 = 0;
        let s4 = 0;
        for (let i = 0; i < 6; i++) {
          s5 += c5[i] * k[i][m];
          s4 += c4[i] * k[i][m];
        }
        y5[m] = y[m] + h * s5;
        y4[m] = y[m] + h * s4;
        err = Math.max(err, Math.abs(y5[m] - y4[m]));
        scale = Math.max(scale, Math.abs(y[m]), Math.abs(y5[m]));
      }
      const tolAbs = tol * (1 + scale);
      if (err <= tolAbs || h <= dtMin) {
        const growth = err === 0 ? 4 : 0.9 * Math.pow(tolAbs / err, 0.2);
        const hNext = Math.min(dtMax, h * Math.min(4, Math.max(0.2, growth)));
        return { t: t + h, y: y5, dt: h, dtNext: Math.max(dtMin, hNext), error: err };
      }
      h = Math.max(dtMin, 0.9 * h * Math.pow(tolAbs / err, 0.25));
    }
    return { t: t + h, y: rk4(deriv, t, y, h), dt: h, dtNext: h, error: Infinity };
  }

  // ------------------------------------------------------------- conservation
  function kineticEnergy(bodies) {
    return bodies.reduce((s, b) => s + 0.5 * b.m * vec.norm2(b.v), 0);
  }

  function gravitationalPotential(bodies, G = constants.G, softening = 0) {
    let u = 0;
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const r = Math.sqrt(vec.dist(bodies[i].x, bodies[j].x) ** 2 + softening * softening);
        u -= (G * bodies[i].m * bodies[j].m) / r;
      }
    }
    return u;
  }

  function totalMomentum(bodies) {
    const dim = bodies[0].v.length;
    const p = new Array(dim).fill(0);
    bodies.forEach((b) => b.v.forEach((vi, i) => (p[i] += b.m * vi)));
    return p;
  }

  function angularMomentum2D(bodies) {
    return bodies.reduce((s, b) => s + b.m * vec.cross2(b.x, b.v), 0);
  }

  function centerOfMass(bodies) {
    const M = bodies.reduce((s, b) => s + b.m, 0);
    const dim = bodies[0].x.length;
    const c = new Array(dim).fill(0);
    bodies.forEach((b) => b.x.forEach((xi, i) => (c[i] += (b.m * xi) / M)));
    return c;
  }

  /** N-body accelerations with Plummer softening. O(N^2) — fine up to a few
   *  hundred bodies at 60 fps in a worker. */
  function nBodyAccelerations(bodies, G = constants.G, softening = 0) {
    const n = bodies.length;
    const dim = bodies[0].x.length;
    const acc = bodies.map(() => new Array(dim).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let r2 = softening * softening;
        const d = new Array(dim);
        for (let k = 0; k < dim; k++) {
          d[k] = bodies[j].x[k] - bodies[i].x[k];
          r2 += d[k] * d[k];
        }
        const invR3 = 1 / (r2 * Math.sqrt(r2));
        for (let k = 0; k < dim; k++) {
          acc[i][k] += G * bodies[j].m * d[k] * invR3;
          acc[j][k] -= G * bodies[i].m * d[k] * invR3;
        }
      }
    }
    return acc;
  }

  // ------------------------------------------------------------------ analysis
  /** Least-squares fit y = a + b x, with uncertainties and r^2. */
  function linearFit(xs, ys) {
    const n = xs.length;
    if (n < 2) return { slope: NaN, intercept: NaN, r2: NaN, slopeError: NaN };
    const mx = xs.reduce((s, v) => s + v, 0) / n;
    const my = ys.reduce((s, v) => s + v, 0) / n;
    let sxx = 0;
    let sxy = 0;
    let syy = 0;
    for (let i = 0; i < n; i++) {
      sxx += (xs[i] - mx) ** 2;
      sxy += (xs[i] - mx) * (ys[i] - my);
      syy += (ys[i] - my) ** 2;
    }
    const slope = sxy / sxx;
    const intercept = my - slope * mx;
    const r2 = syy === 0 ? 1 : (sxy * sxy) / (sxx * syy);
    let ssr = 0;
    for (let i = 0; i < n; i++) ssr += (ys[i] - (intercept + slope * xs[i])) ** 2;
    const s2 = n > 2 ? ssr / (n - 2) : 0;
    return {
      slope,
      intercept,
      r2,
      slopeError: Math.sqrt(s2 / sxx),
      interceptError: Math.sqrt(s2 * (1 / n + (mx * mx) / sxx)),
    };
  }

  function histogram(values, bins, min, max) {
    const lo = min === undefined ? Math.min(...values) : min;
    const hi = max === undefined ? Math.max(...values) : max;
    const width = (hi - lo) / bins || 1;
    const counts = new Array(bins).fill(0);
    for (const v of values) {
      const i = Math.floor((v - lo) / width);
      if (i >= 0 && i < bins) counts[i]++;
      else if (v === hi) counts[bins - 1]++;
    }
    return {
      counts,
      edges: Array.from({ length: bins + 1 }, (_, i) => lo + i * width),
      centers: Array.from({ length: bins }, (_, i) => lo + (i + 0.5) * width),
      width,
    };
  }

  /** Deterministic PRNG (mulberry32) so seeded runs are reproducible and
   *  statistical simulations can be tested. */
  function rng(seed = 1) {
    let a = seed >>> 0;
    const next = () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    next.normal = (mu = 0, sigma = 1) => {
      // Box–Muller
      const u = 1 - next();
      const v = next();
      return mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };
    next.range = (lo, hi) => lo + (hi - lo) * next();
    next.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * next());
    return next;
  }

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  /** Relativity helpers, shared by several simulations and calculators. */
  const relativity = {
    gamma: (beta) => 1 / Math.sqrt(1 - beta * beta),
    betaFromGamma: (g) => Math.sqrt(1 - 1 / (g * g)),
    lorentzBoost: (t, x, beta) => {
      const g = 1 / Math.sqrt(1 - beta * beta);
      return { t: g * (t - beta * x), x: g * (x - beta * t) };
    },
    velocityAddition: (u, v) => (u + v) / (1 + (u * v) / (constants.c * constants.c)),
    dopplerFactor: (beta) => Math.sqrt((1 + beta) / (1 - beta)),
  };

  return {
    constants,
    vec,
    euler,
    rk4,
    semiImplicitEuler,
    velocityVerlet,
    positionVerlet,
    borisPush,
    rk45Step,
    kineticEnergy,
    gravitationalPotential,
    totalMomentum,
    angularMomentum2D,
    centerOfMass,
    nBodyAccelerations,
    linearFit,
    histogram,
    rng,
    clamp,
    lerp,
    wrapAngle,
    relativity,
  };
})();

export default PhysicsCore;
