import { createHash } from 'node:crypto';
import { cleanPositions, classifyLiquidity, number, sum } from '../analytics';
import type {
  PortfolioRepository,
  ReviewRule,
  PortfolioBook,
  ClientReview,
  PortfolioResult,
  Finding,
  Position,
  Candidate,
} from './contracts';
import { defaultRules, record } from './rules';
const fingerprint = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 24);
export class PortfolioReviewService {
  constructor(
    private readonly repository: PortfolioRepository,
    private readonly rules: ReviewRule[] = defaultRules,
  ) {}
  reviewBook(asOf: string): PortfolioBook {
    const clients = this.repository
      .clients()
      .map((client) => this.reviewClient(client.client_id, asOf));
    return {
      asOf,
      clients,
      coverage: {
        clients: clients.length,
        portfolios: clients.reduce((n, c) => n + c.portfolios.length, 0),
        currentHoldings: clients.reduce(
          (n, c) =>
            n + c.portfolios.reduce((m, p) => m + p.positions.length, 0),
          0,
        ),
      },
      ruleDescriptions: this.rules.map((r) => ({
        id: r.id,
        description: r.description,
      })),
    };
  }
  reviewClient(id: string, asOf: string): ClientReview {
    const client = this.repository.clients().find((c) => c.client_id === id);
    if (!client) throw new Error('Unknown client');
    const portfolios = this.repository.portfolios(id).map((portfolio) => {
      const raw = this.repository.holdings(portfolio.portfolio_id, asOf);
      const cleaned = cleanPositions(raw);
      const rows = classifyLiquidity(cleaned.valid);
      const instruments = new Map(
        rows.flatMap((h) => {
          const i = this.repository.instrument(h.instrument_id);
          return i ? [[h.instrument_id, i] as const] : [];
        }),
      );
      const problems = [...cleaned.issues];
      if (!raw.length) problems.push('Current holdings are missing.');
      for (const h of rows) {
        if (h.client_id !== id)
          problems.push('Holding client and portfolio ownership do not match.');
        const i = instruments.get(h.instrument_id);
        if (!i || !i.asset_class)
          problems.push('Instrument classification is missing.');
        else if (i.asset_class !== h.asset_class)
          problems.push('Holding and instrument asset classes disagree.');
      }
      const blocked =
        !raw.length || problems.some((p) => !p.startsWith('Removed '));
      const total = blocked
        ? null
        : sum(rows.map((h) => number(h.market_value_usd)!));
      const positions: Position[] = rows.map((h) => ({
        id: h.instrument_id,
        portfolioId: portfolio.portfolio_id,
        name: h.instrument_name,
        assetClass: instruments.get(h.instrument_id)?.asset_class || 'Unknown',
        currency: h.instrument_ccy,
        value: number(h.market_value_usd)!,
        weight:
          total && total > 0
            ? (number(h.market_value_usd)! / total) * 100
            : null,
        liquidity: h.liquidity_tier,
        valuationDate: h.valuation_date,
        evidence: record(
          'holdings.csv',
          `${portfolio.portfolio_id}|${asOf}|${h.instrument_id}`,
          h.instrument_name,
          h,
        ),
      }));
      const findings: Finding[] = [];
      const add = (ruleId: string, candidate: Candidate) => {
        const payload = {
          ...candidate,
          portfolioId: portfolio.portfolio_id,
          ruleId,
        };
        findings.push({ ...payload, id: fingerprint({ asOf, payload }) });
      };
      if (problems.length)
        add('data-integrity-v1', {
          category: 'Data quality',
          title: blocked
            ? 'Assessment blocked by source data'
            : 'Duplicate records removed',
          detail: [...new Set(problems)].join(' '),
          reason: blocked
            ? 'Incomplete or conflicting source data cannot support reliable weights.'
            : 'Exact duplicates were removed before calculating totals.',
          nextStep:
            'Reconcile the supplied records. Do not interpret missing analysis as a clean portfolio.',
          audience: 'internal',
          evidence: raw.map((h) =>
            record(
              'holdings.csv',
              `${h.portfolio_id}|${h.snapshot_date}|${h.instrument_id}`,
              h.instrument_name,
              h,
            ),
          ),
        });
      if (total !== null && total <= 0)
        add('positive-total-v1', {
          category: 'Data quality',
          title: 'Portfolio total is not positive',
          detail: 'Percentage-based checks are unavailable.',
          reason: 'A zero total cannot be used as a weight denominator.',
          nextStep: 'Reconcile holdings and portfolio value.',
          audience: 'internal',
          evidence: positions.map((p) => p.evidence),
        });
      const unknown = positions.filter(
        (p) =>
          p.liquidity === 'Unknown' ||
          !/^\d{4}-\d{2}-\d{2}$/.test(p.valuationDate) ||
          !Number.isFinite(Date.parse(p.valuationDate)) ||
          p.valuationDate > asOf,
      );
      if (unknown.length)
        add('classification-quality-v1', {
          category: 'Data quality',
          title: 'Access or valuation details need confirmation',
          detail: `${unknown.length} holding(s) have unknown liquidity or missing/invalid valuation dates.`,
          reason:
            'Unknown access is not treated as immediately available cash.',
          nextStep:
            'Obtain the missing classifications before discussing liquidity.',
          audience: 'internal',
          evidence: unknown.map((p) => p.evidence),
        });
      if (total !== null && total > 0) {
        const expected = number(portfolio.aum_usd_current);
        if (
          expected !== null &&
          expected > 0 &&
          Math.abs(total - expected) / expected > 0.01
        )
          add('value-reconciliation-v1', {
            category: 'Data quality',
            title: 'Holdings and supplied portfolio value differ',
            detail:
              'The calculated holdings total differs from supplied current USD AUM by more than 1%.',
            reason:
              'Figures need reconciliation; the display uses holdings-derived values.',
            nextStep:
              'Reconcile portfolio totals before communicating conclusions.',
            audience: 'internal',
            evidence: [
              record(
                'portfolios.csv',
                portfolio.portfolio_id,
                'Portfolio reference value',
                portfolio,
              ),
              ...positions.map((p) => p.evidence),
            ],
          });
        for (const rule of this.rules) {
          for (const finding of rule.evaluate({
            portfolio,
            client,
            asOf,
            total,
            positions,
            instruments,
            mandates: this.repository.mandates(portfolio.mandate_code),
            needs: this.repository.needs(id),
            commitments: this.repository.commitments(id),
          }))
            add(rule.id, finding);
        }
      }
      return {
        id: portfolio.portfolio_id,
        name: portfolio.portfolio_name,
        service: portfolio.service_model,
        mandateBands: this.repository.mandates(portfolio.mandate_code),
        mandate: portfolio.mandate_name,
        total,
        positions,
        findings,
      } satisfies PortfolioResult;
    });
    return {
      id,
      name: client.client_name,
      rm: client.rm_name,
      objective: client.objectives,
      risk: client.risk_profile,
      currency: client.base_currency,
      language: client.reporting_language,
      asOf,
      portfolios,
      plannedNeeds: this.repository.needs(id),
      collateralPortfolioIds: this.repository
        .creditFacilities(id)
        .map((row) => row.collateral_portfolio_id),
      commitments: this.repository.commitments(id),
      total:
        portfolios.length && portfolios.every((p) => p.total !== null)
          ? sum(portfolios.map((p) => p.total!))
          : null,
      findings: portfolios.flatMap((p) => p.findings),
    };
  }
}
