import { z } from 'zod';

const parameterDefinition = z.object({
  key: z.string().min(1).max(40).regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'Parameter keys must be valid identifiers.'),
  label: z.string().min(1),
  type: z.enum(['number', 'range', 'select', 'boolean']),
  default: z.union([z.number(), z.boolean(), z.string()]),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  unit: z.string().optional(),
  help: z.string().optional(),
  options: z.array(z.object({ value: z.union([z.string(), z.number()]), label: z.string() })).optional(),
  /** Changing this parameter restarts the run instead of being applied live. */
  restart: z.boolean().optional(),
});

const graphDefinition = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  mode: z.enum(['time', 'xy', 'bar']).default('time'),
  x: z.object({ key: z.string(), label: z.string(), unit: z.string().optional() }),
  y: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      unit: z.string().optional(),
      color: z.string().optional(),
    }),
  ).min(1),
  maxPoints: z.number().int().positive().max(20000).optional(),
  clearOnReset: z.boolean().optional(),
});

const displayDefinition = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  unit: z.string().optional(),
  precision: z.number().int().min(0).max(10).optional(),
  format: z.enum(['fixed', 'exponential', 'auto']).optional(),
});

const experimentSchema = z.object({
  objective: z.string().default(''),
  conditions: z.array(z.string()).default([]),
  procedure: z.array(z.string()).default([]),
  measurements: z.array(
    z.object({ key: z.string(), label: z.string(), unit: z.string().optional(), source: z.enum(['manual', 'readout']).default('readout'), from: z.string().optional() }),
  ).default([]),
  analysisCode: z.string().default(''),
  theory: z.object({ label: z.string(), value: z.number(), unit: z.string().optional() }).nullable().default(null),
});

export const simulationInput = z.object({
  slug: z.string().optional(),
  title: z.string().min(1, 'Give the simulation a title.'),
  titleEn: z.string().default(''),
  shortDescription: z.string().default(''),
  description: z.string().default(''),
  category: z.string().min(1, 'Choose a category.'),
  type: z.enum(['simulation', 'experiment', 'visualization', 'model', 'calculator']).default('simulation'),
  difficulty: z.number().int().min(1).max(5).default(2),
  targetLevel: z.enum(['middle-school', 'high-school', 'undergraduate', 'graduate']).default('high-school'),
  physicsTopics: z.array(z.string()).default([]),
  formulas: z.array(z.object({ latex: z.string().optional(), text: z.string(), note: z.string().optional() })).default([]),
  tags: z.array(z.string()).default([]),
  simulationCode: z.string().default(''),
  rendererCode: z.string().default(''),
  parameterDefinitions: z.array(parameterDefinition).default([]),
  graphDefinitions: z.array(graphDefinition).default([]),
  displayDefinitions: z.array(displayDefinition).default([]),
  runtimeOptions: z.object({
    dt: z.number().positive().max(1).optional(),
    speed: z.number().positive().max(1000).optional(),
    maxSubsteps: z.number().int().positive().max(20000).optional(),
  }).default({}),
  experiment: experimentSchema.nullable().default(null),
  thumbnail: z.string().default(''),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  sortOrder: z.number().int().default(0),
  author: z.string().default('るーと'),
  versionSummary: z.string().default(''),
});

export const tagInput = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  description: z.string().default(''),
});

export const categoryInput = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  description: z.string().default(''),
  parentSlug: z.string().nullable().default(null),
  sortOrder: z.number().int().default(0),
});

export const credentials = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(8, 'Passwords must be at least 8 characters.'),
  displayName: z.string().max(80).optional(),
});

/**
 * Static checks on author-supplied code. This is a usability guard that catches
 * obvious mistakes early — it is *not* the security boundary. The security
 * boundary is the opaque-origin iframe plus worker plus CSP (see sandbox-doc.ts).
 */
export function lintSimulationCode(code) {
  const problems = [];
  if (!code || !code.trim()) {
    problems.push({ level: 'error', message: 'Simulation code is empty.' });
    return problems;
  }
  if (!/\breturn\b/.test(code)) {
    problems.push({ level: 'error', message: 'The code must return an object with init() and step().' });
  }
  if (!/\binit\s*[:(]/.test(code)) problems.push({ level: 'error', message: 'No init() found in the returned model.' });
  if (!/\bstep\s*[:(]/.test(code)) problems.push({ level: 'error', message: 'No step() found in the returned model.' });
  if (!/\bsample\s*[:(]/.test(code)) {
    problems.push({ level: 'warning', message: 'No sample() — readouts and graphs will receive the raw state.' });
  }
  for (const [pattern, message] of [
    [/\bimportScripts\s*\(/, 'importScripts() is blocked by the sandbox CSP and will throw at runtime.'],
    [/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource/, 'Network access is blocked by the sandbox (connect-src none).'],
    [/\blocalStorage\b|\bindexedDB\b|\bdocument\b|\bwindow\b/, 'The worker has no DOM or storage; this will be undefined at runtime.'],
    [/while\s*\(\s*true\s*\)|for\s*\(\s*;\s*;\s*\)/, 'An unbounded loop inside step() will trip the 5-second watchdog.'],
  ]) {
    if (pattern.test(code)) problems.push({ level: 'warning', message });
  }
  try {
    // Parses without executing: catches syntax errors before publish.
    // eslint-disable-next-line no-new-func
    new Function('PL', code);
  } catch (err) {
    problems.push({ level: 'error', message: `Syntax error: ${err.message}` });
  }
  return problems;
}

export function lintRendererCode(code) {
  const problems = [];
  if (!code || !code.trim()) {
    problems.push({ level: 'warning', message: 'No renderer — the canvas will stay blank.' });
    return problems;
  }
  try {
    // eslint-disable-next-line no-new-func
    new Function('ctx', 'frame', 'params', 'helpers', code);
  } catch (err) {
    problems.push({ level: 'error', message: `Syntax error: ${err.message}` });
  }
  return problems;
}
