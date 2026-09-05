import type { Row } from './types';
export function number(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
export const sum = (values: number[]) =>
  Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100;
export function difference(start: number | null, end: number | null) {
  return {
    absolute: start === null || end === null ? null : end - start,
    percent:
      start === null || end === null || start === 0
        ? null
        : ((end - start) / start) * 100,
  };
}
export function cleanPositions(rows: Row[]) {
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const key = [row.portfolio_id, row.snapshot_date, row.instrument_id].join(
      '|',
    );
    groups.set(key, [...(groups.get(key) || []), row]);
  }
  const valid: Row[] = [];
  const issues: string[] = [];
  for (const [key, group] of groups) {
    if (group.some((r) => JSON.stringify(r) !== JSON.stringify(group[0]))) {
      issues.push(
        `Conflicting duplicate position ${key}; affected totals are incomplete.`,
      );
      continue;
    }
    if (group.length > 1)
      issues.push(
        `Removed ${group.length - 1} exact duplicate position(s): ${key}.`,
      );
    const row = group[0];
    if (
      !row.portfolio_id ||
      !row.snapshot_date ||
      !row.instrument_id ||
      number(row.market_value_usd) === null ||
      number(row.market_value_usd)! < 0
    ) {
      issues.push(`Invalid position ${key}; affected totals are incomplete.`);
      continue;
    }
    valid.push(row);
  }
  return { valid, issues };
}
export function classifyLiquidity(rows: Row[]): Row[] {
  const tiers = ['Daily', 'Weekly', 'Monthly', 'Quarterly Gate', 'Illiquid'];
  return rows.map((r) => ({
    ...r,
    liquidity_tier: tiers.includes(r.liquidity_tier)
      ? r.liquidity_tier
      : 'Unknown',
  }));
}
