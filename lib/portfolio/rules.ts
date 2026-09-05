import { number, sum } from '../analytics';
import type { Row } from '../types';
import type { Evidence, ReviewRule, Candidate, RuleContext } from './contracts';
export const record = (
  file: string,
  key: string,
  label: string,
  fields: Row,
): Evidence => ({ id: file + ':' + key, file, label, fields });
const bandEvidence = (m: Row) =>
  record(
    'mandates.csv',
    m.mandate_code + '|' + m.asset_class,
    'Supplied mandate limits',
    m,
  );
const denominator = (c: RuleContext) => c.positions.map((p) => p.evidence);
const validBand = (m: Row | undefined) =>
  m &&
  number(m.min_pct) !== null &&
  number(m.max_pct) !== null &&
  Number(m.min_pct) >= 0 &&
  Number(m.max_pct) <= 100 &&
  Number(m.min_pct) <= Number(m.max_pct);
const mandateRule: ReviewRule = {
  id: 'mandate-allocation-v1',
  description:
    'Recalculate asset-class weights within each non-custody portfolio and compare with its supplied min/max bands.',
  evaluate(c) {
    if (c.portfolio.service_model === 'Custody') return [];
    const out: Candidate[] = [];
    const classes = new Set([
      ...c.positions.map((p) => p.assetClass),
      ...c.mandates.map((m) => m.asset_class),
    ]);
    for (const cls of classes) {
      const bands = c.mandates.filter((m) => m.asset_class === cls);
      const band = bands[0];
      if (bands.length !== 1 || !validBand(band)) {
        out.push({
          category: 'Data quality',
          title: cls + ' mandate not assessed',
          detail:
            'A unique valid mandate band is unavailable for this asset class.',
          reason:
            'Missing or conflicting limits cannot establish a mandate exception.',
          nextStep:
            'Confirm the applicable mandate limits before discussing an allocation change.',
          audience: 'internal',
          evidence: bands.map(bandEvidence),
        });
        continue;
      }
      const value = sum(
        c.positions.filter((p) => p.assetClass === cls).map((p) => p.value),
      );
      const weight = (value / c.total) * 100;
      if (
        weight < Number(band.min_pct) - 1e-8 ||
        weight > Number(band.max_pct) + 1e-8
      )
        out.push({
          category: 'Allocation',
          title: cls + ' outside supplied range',
          detail: `${cls} is ${weight.toFixed(2)}% of this portfolio; the supplied range is ${band.min_pct}%–${band.max_pct}%.`,
          reason:
            'This is a portfolio-level mandate exception, not a legal conclusion or an instruction to sell.',
          nextStep:
            'Confirm the client’s current preferences and review the allocation with the investment specialist before any changes.',
          audience: 'client_review',
          evidence: [
            ...denominator(c),
            bandEvidence(band),
            record(
              'calculation',
              c.portfolio.portfolio_id + '|' + cls,
              'Allocation calculation',
              {
                asset_class: cls,
                asset_value_usd: String(value),
                portfolio_value_usd: String(c.total),
                weight_pct: String(weight),
              },
            ),
          ],
        });
    }
    return out;
  },
};
const concentrationRule: ReviewRule = {
  id: 'position-concentration-v1',
  description:
    'Assess single-position limits only where the instrument explicitly has concentration_limit_applies=Y, excluding custody portfolios.',
  evaluate(c) {
    if (c.portfolio.service_model === 'Custody') return [];
    const out: Candidate[] = [];
    for (const p of c.positions) {
      const instrument = c.instruments.get(p.id)!;
      if (instrument.concentration_limit_applies !== 'Y') continue;
      const bands = c.mandates.filter((m) => m.asset_class === p.assetClass);
      const max =
        bands.length === 1 ? number(bands[0].max_single_position_pct) : null;
      if (max === null || max < 0 || max > 100) {
        out.push({
          category: 'Data quality',
          title: p.name + ' limit not assessed',
          detail: 'A valid single-position mandate limit is unavailable.',
          reason:
            'The instrument is subject to concentration assessment, but its limit needs confirmation.',
          nextStep: 'Confirm the limit before communicating an exception.',
          audience: 'internal',
          evidence: [p.evidence],
        });
        continue;
      }
      if (p.weight !== null && p.weight > max + 1e-8)
        out.push({
          category: 'Concentration',
          title: p.name + ' exceeds position limit',
          detail: `This position is ${p.weight.toFixed(2)}% of its portfolio, above the supplied ${max}% single-position maximum.`,
          reason:
            'Concentration is measured within this mandate, not across unrelated client accounts.',
          nextStep:
            'Review the concentration and the client’s priorities with the investment specialist. No trade is proposed by this alert.',
          audience: 'client_review',
          evidence: [
            ...denominator(c),
            bandEvidence(bands[0]),
            record(
              'instruments.csv',
              p.id,
              'Concentration applicability',
              instrument,
            ),
          ],
        });
    }
    return out;
  },
};
const liquidityRule: ReviewRule = {
  id: 'funding-window-v1',
  description:
    'Flag a funding-planning question when a cash-needs window overlaps the next 90 days and the portfolio contains monthly, gated or illiquid holdings. No cash-shortfall calculation.',
  evaluate(c) {
    const horizon = new Date(c.asOf + 'T00:00:00Z');
    horizon.setUTCDate(horizon.getUTCDate() + 90);
    const end = horizon.toISOString().slice(0, 10);
    const needs = c.needs.filter(
      (n) =>
        /^\d{4}-\d{2}-\d{2}$/.test(n.due_from) &&
        /^\d{4}-\d{2}-\d{2}$/.test(n.due_to) &&
        n.due_from <= end &&
        n.due_to >= c.asOf,
    );
    const restricted = c.positions.filter((p) =>
      ['Monthly', 'Quarterly Gate', 'Illiquid'].includes(p.liquidity),
    );
    if (!needs.length || !restricted.length) return [];
    return [
      {
        category: 'Funding access',
        title: 'Payment window overlaps restricted investments',
        detail: `${needs.length} cash-needs record(s) overlap the next 90 days, while this portfolio has ${restricted.length} holding(s) with monthly, gated or illiquid access.`,
        reason:
          'This identifies a planning question. It does not establish a funding deficit or assume these investments will fund the payments. Overlapping obligations are not added together.',
        nextStep:
          'Confirm the next actual payment amounts and dates, available cash elsewhere, access terms and settlement arrangements.',
        audience: 'client_review',
        evidence: [
          ...restricted.map((p) => p.evidence),
          ...needs.map((n) =>
            record(
              'planned_cash_needs.csv',
              n.need_id,
              'Payment window (not summed)',
              n,
            ),
          ),
        ],
      },
    ];
  },
};
const valuationRule: ReviewRule = {
  id: 'valuation-age-v1',
  description:
    'Mark valuations more than 30 calendar days before the supplied snapshot for internal review; this demo threshold does not imply an incorrect valuation.',
  evaluate(c) {
    const aged = c.positions.filter((p) => {
      const age = (Date.parse(c.asOf) - Date.parse(p.valuationDate)) / 86400000;
      return Number.isFinite(age) && age > 30;
    });
    if (!aged.length) return [];
    return [
      {
        category: 'Valuation',
        title: 'Older valuations need context',
        detail: `${aged.length} holding valuation(s) are more than 30 days older than the snapshot.`,
        reason:
          'Some private investments update periodically. An older valuation is not proof of a loss or a pricing error.',
        nextStep:
          'Check the expected valuation cycle and latest available statement before relying on these figures in a client message.',
        audience: 'internal',
        evidence: aged.map((p) => p.evidence),
      },
    ];
  },
};
const commitmentRule: ReviewRule = {
  id: 'uncalled-capital-v1',
  description:
    'Show outstanding uncalled fund commitments as funding-planning questions, using each supplied commitment separately. Do not add them to planned cash needs.',
  evaluate(c) {
    return c.commitments
      .filter(
        (row) =>
          row.portfolio_id === c.portfolio.portfolio_id &&
          number(row.uncalled) !== null &&
          Number(row.uncalled) > 0,
      )
      .map((row) => ({
        category: 'Capital calls' as const,
        title: 'Reserve planning for ' + row.fund_name,
        detail: `${row.currency} ${Number(row.uncalled).toLocaleString('en-US')} remains uncalled. The recorded expected window is ${row.expected_call_window}.`,
        reason:
          'An uncalled commitment is a possible future funding requirement, not an amount due today. It may overlap a planned cash-needs record and is not added to it.',
        nextStep:
          'Confirm the latest fund notice, likely call timing and existing funding arrangements before setting aside or moving assets.',
        audience: 'client_review' as const,
        evidence: [
          record(
            'commitments.csv',
            row.commitment_id,
            'Outstanding fund commitment',
            row,
          ),
        ],
      }));
  },
};
export const defaultRules: ReviewRule[] = [
  mandateRule,
  concentrationRule,
  liquidityRule,
  valuationRule,
  commitmentRule,
];
