import { z } from 'zod';
import type { PortfolioResult } from '../portfolio/contracts';
import { simulatorBlocked } from './portfolio-simulator';
export const eventPresets = [
  {
    id: 'rates',
    title: 'Unexpected Fed rate increase',
    description:
      'Explore tighter financial conditions and a milder reaction if the increase was already priced in.',
    review:
      'Check bond duration, floating-rate exposure, credit spreads and borrowing costs. A policy-rate increase is not the same as an equal move in every market yield.',
    shocks: {
      Equity: [-15, -6, 2],
      'Fixed Income': [-10, -4, 1],
      Alternatives: [-12, -5, 2],
      Commodities: [-10, -3, 5],
      'Structured Products': [-20, -7, 2],
      'Cash and Equivalents': [0, 0, 0],
    },
  },
  {
    id: 'policy',
    title: 'Trump / US tariff announcement',
    description:
      'Explore an adverse trade-policy surprise versus a contained reaction or subsequent relief.',
    review:
      'Verify the actual announcement, implementation date, affected countries and company revenue exposure. This template does not assert that an announcement occurred.',
    shocks: {
      Equity: [-20, -8, 5],
      'Fixed Income': [-6, -2, 3],
      Alternatives: [-15, -6, 3],
      Commodities: [-12, -4, 7],
      'Structured Products': [-25, -10, 4],
      'Cash and Equivalents': [0, 0, 0],
    },
  },
  {
    id: 'conflict',
    title: 'War or conflict escalation',
    description:
      'Explore a broad risk-off shock, a contained disruption, or a milder outcome after de-escalation.',
    review:
      'Check geography, energy exposure, sanctions and market access. Different commodities and companies can respond in opposite directions.',
    shocks: {
      Equity: [-30, -12, 4],
      'Fixed Income': [-12, -3, 4],
      Alternatives: [-22, -9, 3],
      Commodities: [-15, 5, 20],
      'Structured Products': [-35, -15, 3],
      'Cash and Equivalents': [0, 0, 0],
    },
  },
  {
    id: 'custom',
    title: 'My own event',
    description:
      'Write a hypothetical event and enter the asset-class shocks you want to test.',
    review:
      'Establish a plausible transmission mechanism and verify current exposures before interpreting the scenario.',
    shocks: {
      Equity: [0, 0, 0],
      'Fixed Income': [0, 0, 0],
      Alternatives: [0, 0, 0],
      Commodities: [0, 0, 0],
      'Structured Products': [0, 0, 0],
      'Cash and Equivalents': [0, 0, 0],
    },
  },
] as const;
export const shockSchema = z
  .object({
    assetClass: z.string().min(1).max(80),
    down: z.number().min(-100).max(100),
    middle: z.number().min(-100).max(100),
    up: z.number().min(-100).max(100),
  })
  .strict()
  .refine(
    (s) => s.down <= s.middle && s.middle <= s.up,
    'Each asset class must have downside ≤ middle ≤ upside.',
  );
export const eventInputSchema = z
  .object({
    clientId: z.string().min(1).max(80),
    portfolioIds: z.array(z.string().min(1).max(80)).min(1).max(24),
    eventId: z.enum(['rates', 'policy', 'conflict', 'custom']),
    customTitle: z.string().max(160),
    shocks: z.array(shockSchema).min(1).max(30),
  })
  .strict();
export type EventInput = z.infer<typeof eventInputSchema>;
export function eventClasses(portfolios: PortfolioResult[]) {
  return [
    ...new Set(portfolios.flatMap((p) => p.positions.map((h) => h.assetClass))),
  ].sort();
}
export function presetShocks(id: EventInput['eventId'], classes: string[]) {
  const preset = eventPresets.find((p) => p.id === id)!;
  return classes.map((assetClass) => {
    const values = (preset.shocks as Record<string, readonly number[]>)[
      assetClass
    ];
    return {
      assetClass,
      down: values?.[0] ?? 0,
      middle: values?.[1] ?? 0,
      up: values?.[2] ?? 0,
    };
  });
}
export function analyzeEvent(portfolios: PortfolioResult[], raw: unknown) {
  const shocks = z.array(shockSchema).min(1).max(30).parse(raw);
  const classes = eventClasses(portfolios);
  if (
    new Set(shocks.map((s) => s.assetClass)).size !== shocks.length ||
    shocks.length !== classes.length ||
    shocks.some((s) => !classes.includes(s.assetClass))
  )
    throw new Error('Every observed asset class needs one explicit shock row.');
  return portfolios.map((p) => {
    if (simulatorBlocked(p))
      return {
        id: p.id,
        name: p.name,
        blocked: true as const,
        total: p.total,
        rows: [],
        outcomes: [],
      };
    const rows = p.positions.map((h) => {
      const s = shocks.find((s) => s.assetClass === h.assetClass)!;
      const cents = Math.round(h.value * 100);
      return {
        id: h.id,
        name: h.name,
        assetClass: h.assetClass,
        value: h.value,
        valuationDate: h.valuationDate,
        liquidity: h.liquidity,
        down: Math.round((cents * s.down) / 100) / 100,
        middle: Math.round((cents * s.middle) / 100) / 100,
        up: Math.round((cents * s.up) / 100) / 100,
      };
    });
    const outcomes = (['down', 'middle', 'up'] as const).map((key) => {
      const change =
        rows.reduce((n, r) => n + Math.round(r[key] * 100), 0) / 100;
      return {
        key,
        change,
        after: (Math.round(p.total! * 100) + Math.round(change * 100)) / 100,
        pct: (change / p.total!) * 100,
      };
    });
    return {
      id: p.id,
      name: p.name,
      blocked: false as const,
      total: p.total!,
      rows,
      outcomes,
    };
  });
}
export const eventAIOutput = z
  .object({
    summary: z.string().min(1).max(700),
    reviews: z
      .array(
        z
          .object({
            portfolioId: z.string(),
            interpretation: z.string().min(1).max(600),
            check: z.string().min(1).max(400),
          })
          .strict(),
      )
      .min(1)
      .max(3),
  })
  .strict();
export type EventAIOutput = z.infer<typeof eventAIOutput>;
export function validateEventAI(raw: unknown, eligibleIds: string[]) {
  const result = eventAIOutput.parse(raw);
  if (
    new Set(result.reviews.map((r) => r.portfolioId)).size !==
      result.reviews.length ||
    result.reviews.some((r) => !eligibleIds.includes(r.portfolioId))
  )
    throw new Error('Unknown or duplicate portfolio reference.');
  const prose =
    result.summary +
    result.reviews.map((r) => r.interpretation + r.check).join(' ');
  if (/\d|[$€£%]|guarantee|must (buy|sell)/i.test(prose))
    throw new Error('Unsupported numerical or trading statement.');
  return result;
}
