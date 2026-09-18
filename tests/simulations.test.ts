import { describe, expect, it } from 'vitest';
import PL from '../src/lib/physics-core.js';
// @ts-ignore - plain JS seed modules
import { seedSimulations } from '../server/seed/index.js';

type Model = {
  init: (p: any) => any;
  step: (s: any, dt: number, p: any, t: number) => any;
  sample?: (s: any, p: any, t: number) => any;
};

function build(sim: any): Model {
  // eslint-disable-next-line no-new-func
  return new Function('PL', '"use strict";\n' + sim.simulationCode)(PL);
}

function defaults(sim: any) {
  const p: Record<string, unknown> = {};
  for (const d of sim.parameterDefinitions) p[d.key] = d.default;
  return p;
}

function run(sim: any, params: Record<string, unknown>, steps: number) {
  const model = build(sim);
  const dt = sim.runtimeOptions?.dt ?? 1 / 600;
  let state = model.init(params);
  for (let i = 0; i < steps; i++) {
    const next = model.step(state, dt, params, i * dt);
    if (next !== undefined && next !== null) state = next;
  }
  return { state, model, dt, out: model.sample ? model.sample(state, params, steps * dt) : {} };
}

describe('every shipped simulation', () => {
  it.each(seedSimulations.map((s: any) => [s.slug, s] as const))(
    '%s runs, stays finite and exposes the keys its UI asks for',
    (_slug, sim: any) => {
      const params = defaults(sim);
      const { out } = run(sim, params, 400);

      expect(out.scalars, 'sample() must return scalars').toBeTypeOf('object');
      for (const [key, value] of Object.entries(out.scalars as Record<string, unknown>)) {
        if (typeof value === 'number') {
          expect(Number.isFinite(value), `${key} became ${value}`).toBe(true);
        }
      }
      for (const def of sim.displayDefinitions) {
        expect(Object.keys(out.scalars)).toContain(def.key);
      }
      for (const graph of sim.graphDefinitions) {
        expect(Object.keys(out.series || {})).toContain(graph.x.key);
        for (const y of graph.y) expect(Object.keys(out.series || {})).toContain(y.key);
      }
      // The renderer must at least compile.
      // eslint-disable-next-line no-new-func
      expect(() => new Function('ctx', 'frame', 'params', 'helpers', sim.rendererCode)).not.toThrow();
    },
  );
});

/** Physics checks on the shipped models, against closed-form expectations. */
describe('physical correctness of specific simulations', () => {
  const bySlug = (slug: string) => seedSimulations.find((s: any) => s.slug === slug);

  it('projectile range matches v0^2 sin(2θ)/g when drag is off', () => {
    const sim = bySlug('projectile-motion');
    const params = { ...defaults(sim), v0: 30, angle: 45, h0: 0, k: 0, g: 9.80665, mass: 0.15 };
    const { out } = run(sim, params, 200000);
    const expected = (30 * 30 * Math.sin((2 * 45 * Math.PI) / 180)) / 9.80665;
    expect(out.scalars.range).toBeGreaterThan(0);
    expect(Math.abs(out.scalars.range - expected) / expected).toBeLessThan(0.001);
  });

  it('adding drag shortens the range', () => {
    const sim = bySlug('projectile-motion');
    const base = { ...defaults(sim), v0: 30, angle: 45, h0: 0, g: 9.80665, mass: 0.15 };
    const dry = run(sim, { ...base, k: 0 }, 200000).out.scalars.range;
    const wet = run(sim, { ...base, k: 0.05 }, 200000).out.scalars.range;
    expect(wet).toBeLessThan(dry);
  });

  it('free-fall model reaches the analytic terminal velocity', () => {
    const sim = bySlug('free-fall-with-air-resistance');
    const params = { ...defaults(sim), h0: 500, mass: 2, k: 0.08, g: 9.80665 };
    // 10 s of fall: the drag timescale is about 1.6 s, so it is essentially
    // at terminal velocity but has not yet reached the ground.
    const { out } = run(sim, params, 20000);
    expect(out.scalars.fractionOfTerminal).toBeGreaterThan(0.999);
    expect(out.scalars.yDrag).toBeGreaterThan(0);
  });

  it('pendulum conserves energy and measures its own period', () => {
    const sim = bySlug('simple-pendulum');
    const params = { ...defaults(sim), theta0: 10, damping: 0, length: 1, g: 9.80665, mass: 0.5 };
    const first = run(sim, params, 100);
    const later = run(sim, params, 400000);
    expect(Math.abs(later.out.scalars.energy - first.out.scalars.energy)).toBeLessThan(1e-6);
    // The measured period is the large-amplitude one, so compare against the
    // first-order correction T0 (1 + theta0^2 / 16) rather than T0 itself.
    const theta0 = (10 * Math.PI) / 180;
    const T0 = 2 * Math.PI * Math.sqrt(1 / 9.80665);
    expect(later.out.scalars.period).toBeCloseTo(T0 * (1 + (theta0 * theta0) / 16), 4);
    expect(later.out.scalars.period).toBeGreaterThan(T0);
  });

  it('collisions conserve momentum for every restitution value', () => {
    const sim = bySlug('one-dimensional-collision');
    for (const e of [0, 0.5, 1]) {
      const params = { ...defaults(sim), e, m1: 1, m2: 2, v1: 3, v2: -1, walls: false };
      const start = run(sim, params, 1);
      const end = run(sim, params, 40000);
      expect(end.out.scalars.collisions).toBeGreaterThan(0);
      expect(end.out.scalars.momentum).toBeCloseTo(start.out.scalars.momentum, 9);
      if (e === 1) expect(end.out.scalars.kinetic).toBeCloseTo(start.out.scalars.kinetic, 9);
      if (e === 0) expect(end.out.scalars.lostEnergy).toBeGreaterThan(0);
    }
  });

  it('two-body orbit conserves energy and angular momentum', () => {
    const sim = bySlug('two-body-kepler');
    const params = defaults(sim);
    const early = run(sim, params, 2000);
    const late = run(sim, params, 200000);
    expect(Math.abs(late.out.scalars.angularMomentum - early.out.scalars.angularMomentum) / Math.abs(early.out.scalars.angularMomentum)).toBeLessThan(1e-8);
    expect(Math.abs(late.out.scalars.energy - early.out.scalars.energy) / Math.abs(early.out.scalars.energy)).toBeLessThan(1e-4);
  });

  it('RC circuit reaches 63.2 per cent of the supply after one time constant', () => {
    const sim = bySlug('rc-circuit');
    const params = { ...defaults(sim), V0: 5, R: 10000, C: 10, drive: 'step' };
    const tau = 10000 * 10e-6;
    const dt = sim.runtimeOptions.dt;
    const { out } = run(sim, params, Math.round(tau / dt));
    expect(out.scalars.vc / 5).toBeCloseTo(1 - Math.exp(-1), 4);
    expect(out.scalars.tau).toBeCloseTo(tau, 12);
  });

  it('radioactive decay halves the population after one half-life', () => {
    const sim = bySlug('radioactive-decay');
    const params = { ...defaults(sim), initial: 20000, halfLife: 3, chain: false, seed: 4 };
    const dt = sim.runtimeOptions.dt;
    const { out } = run(sim, params, Math.round(3 / dt));
    // Monte Carlo: expect 10000 within a few standard deviations (sigma ~ 70).
    expect(out.scalars.parent).toBeGreaterThan(9600);
    expect(out.scalars.parent).toBeLessThan(10400);
    expect(out.scalars.theory).toBeCloseTo(10000, 0);
  });

  it('random walk reproduces the diffusion coefficient', () => {
    const sim = bySlug('random-walk-diffusion');
    const params = { ...defaults(sim), walkers: 2000, stepLength: 1, stepsPerSecond: 60, bias: 0, seed: 3 };
    const dt = sim.runtimeOptions.dt;
    const { out } = run(sim, params, Math.round(5 / dt));
    const ratio = out.scalars.diffusion / out.scalars.diffusionTheory;
    expect(ratio).toBeGreaterThan(0.85);
    expect(ratio).toBeLessThan(1.15);
  });

  it('the quantum wave packet keeps its norm', () => {
    const sim = bySlug('quantum-tunneling');
    const params = defaults(sim);
    const { out } = run(sim, params, 20000);
    expect(out.scalars.norm).toBeGreaterThan(0.98);
    expect(out.scalars.norm).toBeLessThan(1.02);
    expect(out.scalars.transmitted + out.scalars.reflected + out.scalars.inBarrier).toBeCloseTo(out.scalars.norm, 6);
  });

  it('the light clock ticks slower by exactly gamma', () => {
    const sim = bySlug('time-dilation-light-clock');
    const params = { ...defaults(sim), beta: 0.8, clockHeight: 1 };
    const { out } = run(sim, params, 200000);
    expect(out.scalars.gamma).toBeCloseTo(5 / 3, 9);
    expect(out.scalars.t / out.scalars.properTime).toBeCloseTo(5 / 3, 6);
  });
});
