export type Role = 'user' | 'admin';
export type SimulationType = 'simulation' | 'experiment' | 'visualization' | 'model' | 'calculator';
export type Status = 'draft' | 'published' | 'archived';
export type TargetLevel = 'middle-school' | 'high-school' | 'undergraduate' | 'graduate';

export interface User { id: number; email: string; displayName: string; role: Role }
export interface Tag { id?: number; slug: string; name: string; description?: string; count?: number }
export interface Category {
  id?: number; slug: string; name: string; description: string;
  parentSlug: string | null; sortOrder: number; count?: number;
}

export interface ParameterDefinition {
  key: string;
  label: string;
  type: 'number' | 'range' | 'select' | 'boolean';
  default: number | string | boolean;
  min?: number; max?: number; step?: number;
  unit?: string; help?: string;
  options?: { value: string | number; label: string }[];
  restart?: boolean;
}

export interface GraphDefinition {
  id: string;
  title: string;
  mode: 'time' | 'xy' | 'bar';
  x: { key: string; label: string; unit?: string };
  y: { key: string; label: string; unit?: string; color?: string }[];
  maxPoints?: number;
  clearOnReset?: boolean;
}

export interface DisplayDefinition {
  key: string; label: string; unit?: string;
  precision?: number; format?: 'fixed' | 'exponential' | 'auto';
}

export interface ExperimentDefinition {
  objective: string;
  conditions: string[];
  procedure: string[];
  measurements: { key: string; label: string; unit?: string; source: 'manual' | 'readout'; from?: string }[];
  analysisCode: string;
  theory: { label: string; value: number; unit?: string } | null;
}

export interface SimulationSummary {
  id: number; slug: string; title: string; titleEn: string;
  shortDescription: string; category: string; type: SimulationType;
  difficulty: number; targetLevel: TargetLevel; physicsTopics: string[];
  tags: Tag[]; thumbnail: string; status: Status; version: number;
  author: string; createdAt: string; updatedAt: string;
}

export interface Simulation extends SimulationSummary {
  description: string;
  formulas: { text: string; latex?: string; note?: string }[];
  simulationCode: string;
  rendererCode: string;
  parameterDefinitions: ParameterDefinition[];
  graphDefinitions: GraphDefinition[];
  displayDefinitions: DisplayDefinition[];
  runtimeOptions: { dt?: number; speed?: number; maxSubsteps?: number };
  experiment: ExperimentDefinition | null;
  sortOrder: number;
}

export interface VersionSummary {
  id: number; version: number; summary: string; changedAt: string; changedBy: string;
}

export interface Problem { level: 'error' | 'warning'; message: string; where?: string }

export const TYPE_LABELS: Record<SimulationType, string> = {
  simulation: 'シミュレーション',
  experiment: '実験',
  visualization: '可視化',
  model: 'モデル',
  calculator: '計算機',
};

export const LEVEL_LABELS: Record<TargetLevel, string> = {
  'middle-school': '中学',
  'high-school': '高校',
  undergraduate: '大学',
  graduate: '大学院',
};
