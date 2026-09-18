import { mechanics } from './mechanics.js';
import { gravitation } from './gravitation.js';
import { electromagnetism } from './electromagnetism.js';
import { wavesThermal } from './waves-thermal.js';
import { modernAstro } from './modern-astro.js';
import { experiments } from './experiments.js';
import { categories, tags } from './taxonomy.js';

export const seedCategories = categories;
export const seedTags = tags;
export const seedSimulations = [
  ...mechanics,
  ...gravitation,
  ...electromagnetism,
  ...wavesThermal,
  ...modernAstro,
  ...experiments,
];
