import { z } from 'zod';
import type { ClientReview, PortfolioResult } from '../portfolio/contracts';
export const intelligenceInput = z
  .object({
    clientId: z.string().min(1).max(80),
    portfolioIds: z.array(z.string().min(1).max(80)).min(1).max(24),
  })
  .strict();
export function scopedPortfolios(client: ClientReview, ids: string[]) {
  if (
    !ids.length ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !client.portfolios.some((p) => p.id === id))
  )
    throw new Error('Invalid portfolio scope');
  return client.portfolios.filter((p) => ids.includes(p.id));
}
export function intelligenceFindings(portfolios: PortfolioResult[]) {
  const order = [
    'Data quality',
    'Funding access',
    'Capital calls',
    'Concentration',
    'Allocation',
    'Valuation',
  ];
  return portfolios
    .flatMap((p) => p.findings)
    .sort(
      (a, b) =>
        order.indexOf(a.category) - order.indexOf(b.category) ||
        a.id.localeCompare(b.id),
    );
}
export const intelligenceOutput = z
  .object({
    insights: z
      .array(
        z
          .object({
            findingId: z.string(),
            explanation: z.string().min(1).max(700),
            question: z.string().min(1).max(400),
          })
          .strict(),
      )
      .min(1)
      .max(3),
  })
  .strict();
export type IntelligenceOutput = z.infer<typeof intelligenceOutput>;
export function validateIntelligence(
  raw: unknown,
  portfolios: PortfolioResult[],
) {
  const result = intelligenceOutput.parse(raw);
  const ids = new Set(intelligenceFindings(portfolios).map((f) => f.id));
  if (
    new Set(result.insights.map((i) => i.findingId)).size !==
      result.insights.length ||
    result.insights.some(
      (i) =>
        !ids.has(i.findingId) ||
        /\d|[$€£%]|guarantee|must (buy|sell)/i.test(i.explanation + i.question),
    )
  )
    throw new Error('Unsupported AI output');
  return result;
}
export const projectionInput = z
  .object({
    startingValue: z.number().positive().max(1e12),
    years: z.number().int().min(1).max(30),
    low: z.number().min(-100).max(50),
    central: z.number().min(-100).max(50),
    high: z.number().min(-100).max(50),
    contribution: z.number().min(0).max(1e10),
    goal: z.number().positive().max(1e13),
  })
  .strict()
  .refine(
    (i) => i.low <= i.central && i.central <= i.high,
    'Use increasing return assumptions: lower ≤ central ≤ higher.',
  );
export type ProjectionInput = z.infer<typeof projectionInput>;
export function projectWealth(raw: ProjectionInput) {
  const input = projectionInput.parse(raw);
  const rows = [
    {
      year: 0,
      lower: input.startingValue,
      central: input.startingValue,
      higher: input.startingValue,
    },
  ];
  for (let year = 1; year <= input.years; year++) {
    const prev = rows[year - 1];
    rows.push({
      year,
      lower: prev.lower * (1 + input.low / 100) + input.contribution,
      central: prev.central * (1 + input.central / 100) + input.contribution,
      higher: prev.higher * (1 + input.high / 100) + input.contribution,
    });
  }
  const last = rows[rows.length - 1];
  return {
    input,
    rows,
    outcomes: (['lower', 'central', 'higher'] as const).map((key) => ({
      key,
      value: last[key],
      gap: Math.max(0, input.goal - last[key]),
      surplus: Math.max(0, last[key] - input.goal),
    })),
  };
}
