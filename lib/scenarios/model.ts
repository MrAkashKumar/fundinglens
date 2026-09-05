import { z } from 'zod';
import type {
  ClientReview,
  Position,
  PortfolioResult,
} from '../portfolio/contracts';
export const scenarioInputSchema = z
  .object({
    clientId: z.string(),
    portfolioIds: z.array(z.string()).min(1).max(24),
    eligibleIds: z.array(z.string()).min(0).max(300),
    target: z.number().positive().max(1e10),
    externalCash: z.number().nonnegative().max(1e10),
    costPct: z.number().min(0).max(20),
    deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict();
export type ScenarioInput = z.infer<typeof scenarioInputSchema>;
export const positionKey = (p: Position) => p.portfolioId + '|' + p.id;
export function eligibility(
  client: ClientReview,
  portfolio: PortfolioResult,
  p: Position,
) {
  if (
    portfolio.total === null ||
    portfolio.total <= 0 ||
    portfolio.findings.some(
      (f) =>
        f.category === 'Data quality' &&
        f.title !== 'Duplicate records removed',
    )
  )
    return 'Source data needs reconciliation';
  if (client.collateralPortfolioIds.includes(portfolio.id))
    return 'Portfolio linked to a credit collateral record';
  if (p.assetClass === 'Cash and Equivalents')
    return 'Cash is not a sale candidate';
  if (p.liquidity !== 'Daily') return 'Not classified as daily dealing';
  if (p.valuationDate !== client.asOf)
    return 'Valuation does not match the snapshot';
  if (p.value <= 0) return 'No positive holding value';
  return null;
}
export type Sale = {
  id: string;
  name: string;
  portfolioId: string;
  assetClass: string;
  currency: string;
  before: number;
  gross: number;
  percent: number;
  remaining: number;
};
export type SaleScenario = {
  id: string;
  label: string;
  gross: number;
  cost: number;
  net: number;
  funding: number;
  gap: number;
  surplus: number;
  remaining: number;
  soldPct: number;
  eligibleCapped: boolean;
  sales: Sale[];
};
export type ScenarioAnalysis = {
  input: ScenarioInput;
  total: number;
  eligibleValue: number;
  requiredGross: number;
  minimumFeasible: boolean;
  scenarios: SaleScenario[];
  notes: string[];
};
const cents = (n: number) => Math.round(n * 100);
export function analyzeScenarios(
  client: ClientReview,
  raw: ScenarioInput,
): ScenarioAnalysis {
  const input = scenarioInputSchema.parse(raw);
  if (input.clientId !== client.id)
    throw new Error('Client does not match the scenario.');
  if (
    input.deadline < client.asOf ||
    !Number.isFinite(Date.parse(input.deadline))
  )
    throw new Error('Choose a valid deadline on or after the source snapshot.');
  if (
    new Set(input.portfolioIds).size !== input.portfolioIds.length ||
    new Set(input.eligibleIds).size !== input.eligibleIds.length
  )
    throw new Error('Duplicate selections are not allowed.');
  const portfolios = input.portfolioIds.map((id) => {
    const p = client.portfolios.find((p) => p.id === id);
    if (!p || p.total === null)
      throw new Error('Selected portfolio is unavailable.');
    return p;
  });
  const totalC = portfolios.reduce((n, p) => n + cents(p.total!), 0);
  if (totalC <= 0) throw new Error('Portfolio total must be positive.');
  const eligible = input.eligibleIds.map((id) => {
    for (const portfolio of portfolios) {
      const p = portfolio.positions.find((p) => positionKey(p) === id);
      if (p) {
        const reason = eligibility(client, portfolio, p);
        if (reason) throw new Error(reason);
        return p;
      }
    }
    throw new Error('Selected holding is not in this portfolio scope.');
  });
  const eligibleC = eligible.reduce((n, p) => n + cents(p.value), 0);
  const targetC = cents(input.target);
  const cashC = cents(input.externalCash);
  const gapC = Math.max(0, targetC - cashC);
  const costRate = input.costPct / 100;
  const requiredC = Math.ceil(gapC / (1 - costRate));
  function calculate(
    id: string,
    label: string,
    requested: number,
    style: 'proportional' | 'fewest',
  ): SaleScenario {
    const grossC = Math.min(requested, eligibleC);
    let left = grossC;
    const ordered =
      style === 'fewest'
        ? [...eligible].sort(
            (a, b) =>
              b.value - a.value || positionKey(a).localeCompare(positionKey(b)),
          )
        : eligible;
    const allocations = ordered.map((p, i) => {
      const sell =
        style === 'fewest'
          ? Math.min(cents(p.value), left)
          : Math.min(
              cents(p.value),
              i === ordered.length - 1
                ? left
                : Math.floor((grossC * cents(p.value)) / eligibleC),
            );
      left -= sell;
      return { p, sell };
    });
    if (left > 0)
      for (const a of allocations) {
        const extra = Math.min(left, cents(a.p.value) - a.sell);
        a.sell += extra;
        left -= extra;
      }
    const actual = allocations.reduce((n, a) => n + a.sell, 0);
    const costC = Math.ceil(actual * costRate - 1e-8);
    const netC = actual - costC;
    const fundingC = cashC + netC;
    return {
      id,
      label,
      gross: actual / 100,
      cost: costC / 100,
      net: netC / 100,
      funding: fundingC / 100,
      gap: Math.max(0, targetC - fundingC) / 100,
      surplus: Math.max(0, fundingC - targetC) / 100,
      remaining: (totalC - actual) / 100,
      soldPct: (actual / totalC) * 100,
      eligibleCapped: requested > eligibleC,
      sales: allocations
        .filter((a) => a.sell > 0)
        .map(({ p, sell }) => ({
          id: positionKey(p),
          name: p.name,
          portfolioId: p.portfolioId,
          assetClass: p.assetClass,
          currency: p.currency,
          before: p.value,
          gross: sell / 100,
          percent: (sell / cents(p.value)) * 100,
          remaining: (cents(p.value) - sell) / 100,
        })),
    };
  }
  return {
    input,
    total: totalC / 100,
    eligibleValue: eligibleC / 100,
    requiredGross: requiredC / 100,
    minimumFeasible: requiredC <= eligibleC,
    scenarios: [
      calculate(
        'minimum',
        'Minimum sale · proportional',
        requiredC,
        'proportional',
      ),
      calculate(
        'fewest',
        'Same funding · fewest positions',
        requiredC,
        'fewest',
      ),
      ...[10, 20, 50].map((pct) =>
        calculate(
          'sell-' + pct,
          `Sell ${pct}% of selected portfolio`,
          Math.floor((totalC * pct) / 100),
          'proportional',
        ),
      ),
    ],
    notes: [
      'Illustrative cash-funding model, not an execution or suitability recommendation.',
      'The minimum assumes divisible positions, unchanged USD-equivalent prices and one uniform cost allowance. Trade lots, taxes and asset-specific costs may increase the required sale.',
      'External cash must be separate from the selected portfolios to avoid double counting. Sale proceeds are assumed withdrawn for the goal; remaining portfolio value excludes those proceeds.',
      'The deadline is recorded but settlement, market access and FX conversion are not verified. A zero modeled gap does not establish payment readiness.',
      'Post-sale mandate suitability, concentration, tax and collateral checks remain for the RM. Fewest positions may materially change diversification.',
    ],
  };
}
export function scenarioClientText(
  client: ClientReview,
  a: ScenarioAnalysis,
  s: SaleScenario,
) {
  return `Dear ${client.name},\n\nWe prepared an illustrative funding scenario for a USD ${a.input.target.toLocaleString('en-US')} objective by ${a.input.deadline}, using the portfolio records dated ${client.asOf}.\n\nScenario: ${s.label}. Modeled sales total USD ${s.gross.toLocaleString('en-US')} (${s.soldPct.toFixed(2)}% of the selected portfolio), leaving USD ${s.remaining.toLocaleString('en-US')} invested. The assumed cost allowance is ${a.input.costPct}%. Modeled net proceeds are USD ${s.net.toLocaleString('en-US')}, alongside USD ${a.input.externalCash.toLocaleString('en-US')} of separately confirmed external cash.\n\n${s.gap > 0 ? `A modeled funding gap of USD ${s.gap.toLocaleString('en-US')} remains.` : 'The arithmetic covers the entered target under these assumptions; availability by the deadline is not confirmed.'}\n\nWe would need to verify tax, execution prices, settlement, FX, trade lots, and the suitability of the remaining portfolio before agreeing any action. No trades have been placed.\n\n${client.rm}`;
}
