/** Defaults shared by every seeded item, so each definition stays readable. */
export const sim = (o) => ({
  status: 'published',
  type: 'simulation',
  difficulty: 2,
  targetLevel: 'high-school',
  author: 'るーと',
  physicsTopics: [],
  formulas: [],
  tags: [],
  parameterDefinitions: [],
  graphDefinitions: [],
  displayDefinitions: [],
  runtimeOptions: {},
  experiment: null,
  thumbnail: '',
  sortOrder: 0,
  titleEn: '',
  shortDescription: '',
  description: '',
  versionSummary: 'Seeded with the platform',
  ...o,
});

export const num = (key, label, def, extra = {}) => ({ key, label, type: 'number', default: def, ...extra });
export const range = (key, label, def, min, max, step, extra = {}) =>
  ({ key, label, type: 'range', default: def, min, max, step, ...extra });
export const toggle = (key, label, def, extra = {}) => ({ key, label, type: 'boolean', default: def, ...extra });
export const choice = (key, label, def, options, extra = {}) =>
  ({ key, label, type: 'select', default: def, options, ...extra });

export const read = (key, label, unit, precision = 3, format = 'auto') => ({ key, label, unit, precision, format });

export const timeGraph = (id, title, ys, extra = {}) => ({
  id,
  title,
  mode: 'time',
  x: { key: 't', label: 'Time', unit: 's' },
  y: ys,
  maxPoints: 4000,
  clearOnReset: true,
  ...extra,
});

export const xyGraph = (id, title, x, ys, extra = {}) => ({
  id, title, mode: 'xy', x, y: ys, maxPoints: 6000, clearOnReset: true, ...extra,
});
