import { describe, expect, it } from 'vitest';
import PL from '../src/lib/physics-core.js';

/**
 * Every assertion here compares against a closed-form result, not against a
 * previous run of the code. A regression in an integrator therefore fails the
 * suite rather than silently redefining "correct".
 */
describe('numerical integrators', () => {
  it('RK4 reproduces free fall exactly (the solution is a quadratic)', () => {
    const g = 9.80665;
    const deriv = (_t: number, y: number[]) => [y[1], -g];
    let y = [100, 0];
    const dt = 1 / 1000;
    for (let i = 0; i < 2000; i++) y = PL.rk4(deriv, i * dt, y, dt);
    const t = 2;
    expect(y[0]).toBeCloseTo(100 - 0.5 * g * t * t, 8);
    expect(y[1]).toBeCloseTo(-g * t, 8);
  });

  it('terminal velocity matches sqrt(mg/k) for quadratic drag', () => {
    const g = 9.80665, m = 2, k = 0.08;
    const deriv = (_t: number, y: number[]) => [y[1], -g - (k * y[1] * Math.abs(y[1])) / m];
    let y = [10000, 0];
    const dt = 1 / 500;
    for (let i = 0; i < 40000; i++) y = PL.rk4(deriv, i * dt, y, dt);
    expect(Math.abs(y[1])).toBeCloseTo(Math.sqrt((m * g) / k), 3);
  });

  it('velocity Verlet conserves the energy of a harmonic oscillator', () => {
    const k = 12, m = 0.7;
    const accel = (_t: number, x: number[]) => [(-k * x[0]) / m];
    let x = [0.4], v = [0], a: number[] | undefined;
    const e0 = 0.5 * k * x[0] * x[0];
    const dt = 1 / 2000;
    for (let i = 0; i < 200000; i++) {
      const r = PL.velocityVerlet(accel, i * dt, x, v, dt, a);
      x = r.x; v = r.v; a = r.a;
    }
    const e = 0.5 * m * v[0] * v[0] + 0.5 * k * x[0] * x[0];
    // Symplectic integrators bound the energy error instead of letting it drift.
    expect(Math.abs(e - e0) / e0).toBeLessThan(1e-4);
  });

  it('explicit Euler visibly gains energy where Verlet does not', () => {
    const k = 12, m = 0.7;
    const deriv = (_t: number, y: number[]) => [y[1], (-k * y[0]) / m];
    let y = [0.4, 0];
    const dt = 1 / 2000;
    const e0 = 0.5 * k * 0.4 * 0.4;
    for (let i = 0; i < 200000; i++) y = PL.euler(deriv, i * dt, y, dt);
    const e = 0.5 * m * y[1] * y[1] + 0.5 * k * y[0] * y[0];
    expect(e / e0).toBeGreaterThan(1.1);
  });

  it('pendulum period approaches 2*pi*sqrt(L/g) at small amplitude', () => {
    const g = 9.80665, L = 1;
    const run = (theta0: number) => {
      let th = theta0, om = 0, t = 0, prev = th, period = 0, last: number | null = null;
      const dt = 1 / 20000;
      for (let i = 0; i < 400000; i++) {
        const a0 = -(g / L) * Math.sin(th);
        const thN = th + om * dt + 0.5 * a0 * dt * dt;
        const omH = om + 0.5 * a0 * dt;
        const a1 = -(g / L) * Math.sin(thN);
        om = omH + 0.5 * a1 * dt;
        prev = th; th = thN; t += dt;
        if (prev < 0 && th >= 0) {
          const frac = -prev / (th - prev);
          const cross = t - dt + frac * dt;
          if (last !== null) period = cross - last;
          last = cross;
        }
      }
      return period;
    };
    const small = run(0.02);
    expect(small).toBeCloseTo(2 * Math.PI * Math.sqrt(L / g), 3);
    // A 90-degree amplitude is about 18% slower than the small-angle result.
    const large = run(Math.PI / 2);
    expect(large / small).toBeGreaterThan(1.17);
    expect(large / small).toBeLessThan(1.19);
  });

  it('Kepler orbit returns to perihelion after the predicted period', () => {
    const G = 4 * Math.PI * Math.PI; // au, yr, Msun
    const M = 1, a = 1;
    const T = Math.sqrt((4 * Math.PI * Math.PI * a ** 3) / (G * M));
    expect(T).toBeCloseTo(1, 10);
    let x = [a, 0], v = [0, Math.sqrt((G * M) / a)];
    let acc: number[] | undefined;
    const accel = (_t: number, p: number[]) => {
      const r = Math.hypot(p[0], p[1]);
      return [(-G * M * p[0]) / r ** 3, (-G * M * p[1]) / r ** 3];
    };
    const dt = 1 / 20000;
    for (let i = 0; i < 20000; i++) {
      const r = PL.velocityVerlet(accel, i * dt, x, v, dt, acc);
      x = r.x; v = r.v; acc = r.a;
    }
    // After one period the body is back where it started.
    expect(Math.hypot(x[0] - a, x[1])).toBeLessThan(2e-3);
  });

  it('conserves momentum and angular momentum in an N-body step', () => {
    const bodies = [
      { m: 1, x: [0, 0], v: [0, -0.2] },
      { m: 0.5, x: [2, 0], v: [0, 1.4] },
      { m: 0.3, x: [-1.5, 0.4], v: [0.1, -0.9] },
    ];
    const p0 = PL.totalMomentum(bodies);
    const l0 = PL.angularMomentum2D(bodies);
    const dt = 1 / 5000;
    let acc = PL.nBodyAccelerations(bodies, 1, 0.01);
    for (let step = 0; step < 20000; step++) {
      bodies.forEach((b, i) => { for (let k = 0; k < 2; k++) b.x[k] += b.v[k] * dt + 0.5 * acc[i][k] * dt * dt; });
      const acc1 = PL.nBodyAccelerations(bodies, 1, 0.01);
      bodies.forEach((b, i) => { for (let k = 0; k < 2; k++) b.v[k] += 0.5 * (acc[i][k] + acc1[i][k]) * dt; });
      acc = acc1;
    }
    const p1 = PL.totalMomentum(bodies);
    expect(Math.abs(p1[0] - p0[0])).toBeLessThan(1e-10);
    expect(Math.abs(p1[1] - p0[1])).toBeLessThan(1e-10);
    expect(Math.abs(PL.angularMomentum2D(bodies) - l0)).toBeLessThan(1e-6);
  });

  it('Boris pusher conserves speed exactly in a pure magnetic field', () => {
    let x = [0, 0, 0];
    let v = [1e5, 0, 4e4];
    const qm = -1.758820e11;
    const dt = 1e-12;
    const speed0 = PL.vec.norm(v);
    for (let i = 0; i < 200000; i++) {
      const r = PL.borisPush(x, v, qm, [0, 0, 0], [0, 0, 0.01], dt);
      x = r.x; v = r.v;
    }
    expect(PL.vec.norm(v) / speed0).toBeCloseTo(1, 10);
  });

  it('RC discharge follows V0 exp(-t/RC)', () => {
    const R = 10000, C = 1e-5, V0 = 5;
    const tau = R * C;
    const deriv = (_t: number, y: number[]) => [-y[0] / tau];
    let y = [V0];
    const dt = tau / 2000;
    for (let i = 0; i < 2000; i++) y = PL.rk4(deriv, i * dt, y, dt);
    expect(y[0]).toBeCloseTo(V0 * Math.exp(-1), 9);
    expect(y[0] / V0).toBeCloseTo(0.367879, 5);
  });

  it('radioactive decay halves each half-life', () => {
    const halfLife = 3;
    const lam = Math.LN2 / halfLife;
    const deriv = (_t: number, y: number[]) => [-lam * y[0]];
    let y = [1000];
    const dt = 1 / 2000;
    for (let i = 0; i < 3 * 2000; i++) y = PL.rk4(deriv, i * dt, y, dt);
    expect(y[0]).toBeCloseTo(500, 6);
  });

  it('elastic collision conserves momentum and kinetic energy', () => {
    const m1 = 1, m2 = 2, u1 = 3, u2 = -1, e = 1;
    const M = m1 + m2;
    const v1 = (m1 * u1 + m2 * u2 - m2 * e * (u1 - u2)) / M;
    const v2 = (m1 * u1 + m2 * u2 + m1 * e * (u1 - u2)) / M;
    expect(m1 * v1 + m2 * v2).toBeCloseTo(m1 * u1 + m2 * u2, 12);
    expect(0.5 * m1 * v1 ** 2 + 0.5 * m2 * v2 ** 2).toBeCloseTo(0.5 * m1 * u1 ** 2 + 0.5 * m2 * u2 ** 2, 12);
  });

  it('perfectly inelastic collision loses the predicted energy', () => {
    const m1 = 1, m2 = 2, u1 = 3, u2 = -1;
    const vf = (m1 * u1 + m2 * u2) / (m1 + m2);
    const mu = (m1 * m2) / (m1 + m2);
    const lost = 0.5 * m1 * u1 ** 2 + 0.5 * m2 * u2 ** 2 - 0.5 * (m1 + m2) * vf ** 2;
    expect(lost).toBeCloseTo(0.5 * mu * (u1 - u2) ** 2, 12);
  });

  it('adaptive RK45 tracks an exponential decay to the requested tolerance', () => {
    const deriv = (_t: number, y: number[]) => [-5 * y[0]];
    let t = 0, y = [1], dt = 0.01;
    let steps = 0;
    while (t < 1) {
      const r = PL.rk45Step(deriv, t, y, Math.min(dt, 1 - t), 1e-12);
      t = r.t; y = r.y; dt = r.dtNext; steps++;
    }
    expect(y[0]).toBeCloseTo(Math.exp(-5), 10);
    // The step size should have grown well beyond the initial guess.
    expect(steps).toBeLessThan(400);
  });

  it('linear fit recovers a known slope and intercept', () => {
    const xs = [1, 2, 3, 4, 5, 6];
    const ys = xs.map((x) => 2.5 * x + 1.2);
    const fit = PL.linearFit(xs, ys);
    expect(fit.slope).toBeCloseTo(2.5, 12);
    expect(fit.intercept).toBeCloseTo(1.2, 12);
    expect(fit.r2).toBeCloseTo(1, 12);
  });

  it('relativity helpers agree with the closed forms', () => {
    expect(PL.relativity.gamma(0.8)).toBeCloseTo(5 / 3, 12);
    expect(PL.relativity.betaFromGamma(5 / 3)).toBeCloseTo(0.8, 12);
    expect(PL.relativity.dopplerFactor(0.6)).toBeCloseTo(2, 12);
    expect(PL.relativity.velocityAddition(PL.constants.c, 0.5 * PL.constants.c)).toBeCloseTo(PL.constants.c, 6);
  });

  it('the seeded PRNG is reproducible', () => {
    const a = PL.rng(42);
    const b = PL.rng(42);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });
});
