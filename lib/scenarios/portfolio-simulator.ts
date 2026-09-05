import { z } from 'zod';
import type { PortfolioResult } from '../portfolio/contracts';
import { number } from '../analytics';
export function simulatorClasses(p: PortfolioResult) {
  return [
    ...new Set([
      ...p.positions.map((h) => h.assetClass),
      ...p.mandateBands.map((b) => b.asset_class),
    ]),
  ].sort();
}
export function simulatorBlocked(p: PortfolioResult) {
  return (
    p.total === null ||
    p.total <= 0 ||
    p.findings.some(
      (f) =>
        f.category === 'Data quality' &&
        f.title !== 'Duplicate records removed',
    )
  );
}
// Largest-remainder apportionment keeps the full budget, including rounding cents.
function apportion(total: number, weights: number[]) {
  const raw = weights.map((w) => (total * w) / 100);
  const allocated = raw.map(Math.floor);
  const order = raw
    .map((n, i) => ({ i, remainder: n - allocated[i] }))
    .sort((a, b) => b.remainder - a.remainder || a.i - b.i);
  const remainder = total - allocated.reduce((a, b) => a + b, 0);
  for (let n = 0; n < remainder; n++) allocated[order[n % order.length].i]++;
  return allocated;
}
export function currentAllocation(p: PortfolioResult) {
  if (simulatorBlocked(p)) return [];
  const classes = simulatorClasses(p);
  const weights = classes.map(
    (c) =>
      (p.positions
        .filter((h) => h.assetClass === c)
        .reduce((n, h) => n + h.value, 0) /
        p.total!) *
      100,
  );
  const normalized = apportion(10000, weights);
  return classes.map((assetClass, i) => ({
    assetClass,
    targetPct: normalized[i] / 100,
    shockPct: 0,
  }));
}
const inputSchema = z
  .array(
    z
      .object({
        assetClass: z.string(),
        targetPct: z
          .number()
          .min(0)
          .max(100)
          .refine(
            (n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6,
            'Use at most two decimal places',
          ),
        shockPct: z.number().min(-100).max(100),
      })
      .strict(),
  )
  .min(1)
  .max(30);
export function simulatePortfolio(p: PortfolioResult, raw: unknown) {
  if (simulatorBlocked(p))
    throw new Error('Resolve portfolio source checks before simulation.');
  const inputs = inputSchema.parse(raw);
  const classes = simulatorClasses(p);
  if (
    inputs.length !== classes.length ||
    new Set(inputs.map((i) => i.assetClass)).size !== classes.length ||
    inputs.some((i) => !classes.includes(i.assetClass))
  )
    throw new Error('Include each asset class exactly once.');
  if (inputs.reduce((n, i) => n + Math.round(i.targetPct * 100), 0) !== 10000)
    throw new Error('Target allocation must total exactly 100%.');
  const totalCents = Math.round(p.total! * 100);
  const targets = apportion(
    totalCents,
    inputs.map((i) => i.targetPct),
  );
  const rows = inputs.map((i, index) => {
    const currentCents = p.positions
      .filter((h) => h.assetClass === i.assetClass)
      .reduce((n, h) => n + Math.round(h.value * 100), 0);
    const proposed = targets[index] / 100,
      current = currentCents / 100;
    const bands = p.mandateBands.filter((b) => b.asset_class === i.assetClass);
    const min = bands.length === 1 ? number(bands[0].min_pct) : null,
      max = bands.length === 1 ? number(bands[0].max_pct) : null;
    const assessed =
      p.service !== 'Custody' &&
      min !== null &&
      max !== null &&
      min >= 0 &&
      max <= 100 &&
      min <= max;
    return {
      ...i,
      current,
      proposed,
      change: (targets[index] - currentCents) / 100,
      currentPct: (currentCents / totalCents) * 100,
      min,
      max,
      status: !assessed
        ? 'Not assessed'
        : i.targetPct < min! - 1e-8 || i.targetPct > max! + 1e-8
          ? 'Outside supplied range'
          : 'Within supplied range',
      currentStressed: Math.round(currentCents * (1 + i.shockPct / 100)) / 100,
      proposedStressed:
        Math.round(targets[index] * (1 + i.shockPct / 100)) / 100,
    };
  });
  const sum = (key: 'currentStressed' | 'proposedStressed') =>
    rows.reduce((n, r) => n + Math.round(r[key] * 100), 0) / 100;
  const increases =
    rows.reduce((n, r) => n + Math.max(0, Math.round(r.change * 100)), 0) / 100;
  const reductions =
    rows.reduce((n, r) => n + Math.max(0, -Math.round(r.change * 100)), 0) /
    100;
  return {
    rows,
    total: totalCents / 100,
    increases,
    reductions,
    currentStressed: sum('currentStressed'),
    proposedStressed: sum('proposedStressed'),
    outside: rows.filter((r) => r.status === 'Outside supplied range').length,
  };
}
