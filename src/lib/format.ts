import type { DisplayDefinition } from './types';

/** Formats a readout so columns of numbers stay aligned and legible. */
export function formatValue(value: unknown, def?: DisplayDefinition): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  const n = Number(value);
  if (!Number.isFinite(n)) return typeof value === 'string' ? value : '—';
  const precision = def?.precision ?? 3;
  const mode = def?.format ?? 'auto';
  if (mode === 'exponential') return n.toExponential(precision);
  if (mode === 'fixed') return n.toFixed(precision);
  const abs = Math.abs(n);
  if (abs !== 0 && (abs >= 1e6 || abs < 1e-4)) return n.toExponential(Math.min(precision, 4));
  return n.toFixed(precision);
}

export function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export const TRACE_COLORS = ['#5ac8fa', '#ffb454', '#8ce99a', '#ff8fa3', '#c0a6ff', '#4ad9c0'];

/** CSV export shared by the graph panel and the experiment table. */
export function toCsv(rows: (string | number)[][]): string {
  return rows
    .map((row) => row.map((cell) => {
      const s = String(cell ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(','))
    .join('\n');
}

export function download(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
