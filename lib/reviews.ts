import { createHash } from 'node:crypto';
import {
  number,
  sum,
  difference,
  cleanPositions,
  classifyLiquidity,
} from './analytics';
import type { DataSet } from './data';
import type { Review, Source, Row, DraftContent, Statement } from './types';
export const AS_OF = '2026-08-26';
export const DATES = [
  '2025-12-31',
  '2026-02-27',
  '2026-03-31',
  '2026-06-30',
  AS_OF,
];
export const CASES = [
  {
    id: 'CL-0006',
    short: 'Tran',
    type: 'funding' as const,
    title: 'Confirm the next USD payments',
    issue: 'USD funding & restrictions',
    question: 'Which funds can support the next instalment?',
    action: 'Draft funding questions',
    status: 'Schedule unconfirmed',
    start: '2026-06-30',
    noteIds: ['N-009'],
    needIds: ['CN-007', 'CN-008'],
    unknowns: [
      'Confirm the next instalment amounts and dates, deposit access terms, and actual redemption proceeds.',
      'These records do not establish a cash shortfall. Daily liquidity is a dealing category, not immediately withdrawable cash.',
    ],
  },
  {
    id: 'CL-0003',
    short: 'Margarethe',
    type: 'inheritance' as const,
    title: 'Review portfolio fit and payment funding',
    issue: 'Inherited portfolio & payment',
    question: 'Does the inherited allocation fit her needs?',
    action: 'Draft payment-review update',
    status: 'Mandate review',
    start: '2026-02-27',
    noteIds: ['N-005', 'N-006'],
    needIds: ['CN-004'],
    unknowns: [
      'Confirm the payment funding plan with the appropriate specialist. The recorded payment is not an independently assessed tax liability.',
      'A mandate exception is not a legal conclusion or an instruction to sell.',
    ],
  },
  {
    id: 'CL-0012',
    short: 'Cheung',
    type: 'retirement' as const,
    title: 'Confirm current retirement spending',
    issue: 'Retirement spending differs',
    question: 'Which annual spending amount is current?',
    action: 'Draft retirement-review update',
    status: 'Figures differ',
    start: '2025-12-31',
    noteIds: ['N-016'],
    needIds: ['CN-012'],
    unknowns: [
      'Neither source has been selected as correct. Confirm current living and medical expenses.',
      'The difference is a record discrepancy, not an established funding deficit.',
    ],
  },
];
export class ReviewError extends Error {
  constructor(
    message: string,
    public status = 422,
  ) {
    super(message);
  }
}
export function buildReview(
  dataset: DataSet,
  clientId: string,
  start?: string,
  end = AS_OF,
): Review {
  const config = CASES.find((c) => c.id === clientId);
  if (!config) throw new ReviewError('Client review not found.', 404);
  const comparisonStart = start || config.start;
  if (
    !DATES.includes(comparisonStart) ||
    end !== AS_OF ||
    comparisonStart > end
  )
    throw new ReviewError(
      'Choose a supported comparison date. The current snapshot is 26 August 2026.',
      400,
    );
  const client = dataset.clients.find((c) => c.client_id === clientId);
  if (!client) throw new ReviewError('Essential client record is missing.');
  const portfolios = dataset.portfolios.filter((p) => p.client_id === clientId);
  if (!portfolios.length)
    throw new ReviewError('Essential portfolio records are missing.');
  const pids = new Set(portfolios.map((p) => p.portfolio_id));
  const instruments = new Map(
    dataset.instruments.map((i) => [i.instrument_id, i]),
  );
  const positions = cleanPositions(
    dataset.holdings.filter((h) => pids.has(h.portfolio_id)),
  );
  const warnings = [...positions.issues];
  if (positions.issues.some((x) => x.includes('incomplete')))
    throw new ReviewError(
      'Conflicting or invalid holding records prevent a reliable review. Correct the source data first.',
    );
  const current = classifyLiquidity(
    positions.valid.filter((h) => h.snapshot_date === end),
  );
  if (!current.length)
    throw new ReviewError('Current holdings are unavailable.');
  if (current.some((h) => !instruments.has(h.instrument_id)))
    throw new ReviewError('An essential instrument join is missing.');
  const evidence: Source[] = [];
  function source(
    file: string,
    key: string,
    date: string,
    label: string,
    fields: Row,
    kind: Source['kind'] = 'record',
    inputs?: string[],
  ) {
    const id = `${file}:${key}`;
    if (!evidence.some((e) => e.id === id))
      evidence.push({ id, file, key, date, label, fields, kind, inputs });
    return id;
  }
  const clientRef = source(
    'clients.csv',
    clientId,
    end,
    'Client objective and profile',
    {
      client_id: clientId,
      client_name: client.client_name,
      objectives: client.objectives,
      risk_profile: client.risk_profile,
      reporting_language: client.reporting_language,
    },
  );
  for (const p of portfolios)
    source('portfolios.csv', p.portfolio_id, end, 'Portfolio and mandate', p);
  const holdingRef = (h: Row) =>
    source(
      'holdings.csv',
      `${h.portfolio_id}|${h.snapshot_date}|${h.instrument_id}`,
      h.snapshot_date,
      h.instrument_name ||
        instruments.get(h.instrument_id)?.instrument_name ||
        h.instrument_id,
      h,
    );
  for (const h of current) {
    holdingRef(h);
    const instrument = instruments.get(h.instrument_id)!;
    source(
      'instruments.csv',
      h.instrument_id,
      end,
      'Instrument classification',
      instrument,
    );
    if (h.valuation_date && h.valuation_date < h.snapshot_date)
      warnings.push(
        `${h.instrument_name}: valuation dated ${h.valuation_date}, earlier than this snapshot.`,
      );
    if (h.liquidity_tier === 'Unknown')
      warnings.push(
        `${h.instrument_name}: liquidity classification unavailable.`,
      );
  }
  for (const p of portfolios) {
    const total = sum(
      current
        .filter((h) => h.portfolio_id === p.portfolio_id)
        .map((h) => number(h.market_value_usd)!),
    );
    const expected = number(p.aum_usd_current);
    if (
      expected !== null &&
      expected > 0 &&
      Math.abs(total - expected) / expected > 0.01
    )
      warnings.push(
        `${p.portfolio_id}: holdings and supplied current value differ by more than 1%; reconciliation required.`,
      );
  }
  const total = sum(current.map((h) => number(h.market_value_usd)!));
  if (total <= 0)
    throw new ReviewError('Current portfolio total must be positive.');
  const liquidity = [
    'Daily',
    'Weekly',
    'Monthly',
    'Quarterly Gate',
    'Illiquid',
    'Unknown',
  ]
    .map((tier) => ({
      tier,
      value: sum(
        current
          .filter((h) => h.liquidity_tier === tier)
          .map((h) => number(h.market_value_usd)!),
      ),
      holdings: current
        .filter((h) => h.liquidity_tier === tier)
        .map((h) => ({
          name: h.instrument_name,
          value: number(h.market_value_usd)!,
          currency: h.instrument_ccy,
          assetClass: instruments.get(h.instrument_id)!.asset_class,
          sourceId: holdingRef(h),
        })),
    }))
    .filter((g) => g.holdings.length);
  const history = DATES.map((date) => {
    const rows = positions.valid.filter((h) => h.snapshot_date === date);
    rows.forEach(holdingRef);
    return {
      date,
      value: rows.length
        ? sum(rows.map((h) => number(h.market_value_usd)!))
        : null,
      preInception: portfolios.some((p) => date < p.inception_date),
    };
  });
  const allocation: Review['allocation'] = [];
  const singleExceptions: Review['singleExceptions'] = [];
  // Mandates are portfolio-specific, never applied to a combined client total.
  for (const p of portfolios) {
    const holdings = current.filter((h) => h.portfolio_id === p.portfolio_id);
    const pv = sum(holdings.map((h) => number(h.market_value_usd)!));
    const bands = dataset.mandates.filter(
      (m) => m.mandate_code === p.mandate_code,
    );
    const classes = new Set([
      ...bands.map((m) => m.asset_class),
      ...holdings.map((h) => instruments.get(h.instrument_id)!.asset_class),
    ]);
    for (const assetClass of classes) {
      const matched = holdings.filter(
        (h) => instruments.get(h.instrument_id)!.asset_class === assetClass,
      );
      const value = sum(matched.map((h) => number(h.market_value_usd)!));
      const band = bands.find((b) => b.asset_class === assetClass);
      const assessment = p.service_model !== 'Custody' && Boolean(band);
      const min = assessment ? number(band!.min_pct) : null;
      const max = assessment ? number(band!.max_pct) : null;
      const weight = pv > 0 ? (100 * value) / pv : 0;
      const sourceIds = matched.map(holdingRef);
      if (band)
        sourceIds.push(
          source(
            'mandates.csv',
            `${p.mandate_code}|${assetClass}`,
            end,
            'Mandate allocation band',
            band,
          ),
        );
      if (
        p.service_model !== 'Custody' &&
        (!band || min === null || max === null)
      )
        warnings.push(
          `${assetClass}: mandate limits unavailable; not assessed.`,
        );
      allocation.push({
        assetClass:
          portfolios.length > 1
            ? `${p.portfolio_id} · ${assetClass}`
            : assetClass,
        value,
        weight,
        min,
        max,
        exception:
          min === null || max === null ? null : weight < min || weight > max,
        sourceIds,
      });
    }
    if (p.service_model !== 'Custody')
      for (const h of holdings) {
        const instrument = instruments.get(h.instrument_id)!;
        const band = bands.find(
          (b) => b.asset_class === instrument.asset_class,
        );
        const max = number(band?.max_single_position_pct);
        const weight = pv ? (100 * number(h.market_value_usd)!) / pv : 0;
        if (
          instrument.concentration_limit_applies === 'Y' &&
          max !== null &&
          weight > max
        )
          singleExceptions.push({
            name: h.instrument_name,
            weight,
            max,
            sourceIds: [
              holdingRef(h),
              source(
                'mandates.csv',
                `${p.mandate_code}|${band!.asset_class}`,
                end,
                'Single-position mandate limit',
                band!,
              ),
            ],
          });
        if (
          instrument.sustainability_excluded === 'Y' &&
          bands.some((b) => /sustainab/i.test(b.mandate_name))
        )
          warnings.push(
            `${h.instrument_name}: review the sustainability exclusion in the supplied mandate.`,
          );
      }
  }
  const notes = config.noteIds.map((id) =>
    dataset.notes.find((n) => n.note_id === id && n.note_date <= end),
  );
  if (notes.some((n) => !n))
    throw new ReviewError('Required client context note is missing.');
  const noteRefs = notes.map((n) =>
    source('rm_notes.json', n!.note_id, n!.note_date, 'Attributed RM note', n!),
  );
  const needs = config.needIds.map((id) =>
    dataset.needs.find((n) => n.need_id === id),
  );
  if (needs.some((n) => !n))
    throw new ReviewError('Required obligation record is missing.');
  const obligations = needs.map((n) => ({
    id: n!.need_id,
    description: n!.description,
    amount: number(n!.amount),
    currency: n!.currency,
    from: n!.due_from,
    to: n!.due_to,
    recurrence: n!.recurrence,
    certainty: n!.certainty,
    sourceIds: [
      source(
        'planned_cash_needs.csv',
        n!.need_id,
        end,
        'Planned cash need',
        n!,
      ),
    ],
    note:
      n!.recurrence === 'One-off'
        ? 'Supplied payment record; funding plan needs confirmation.'
        : 'Timing and current instalment amounts require confirmation.',
  }));
  if (obligations.some((o) => o.amount === null))
    throw new ReviewError('An essential cash-needs amount is invalid.');
  let redemptionRef = '';
  if (config.type === 'funding') {
    const commitment = dataset.commitments.find(
      (c) => c.commitment_id === 'COM-003' && c.client_id === clientId,
    );
    const txn = dataset.transactions.find(
      (t) => t.transaction_id === 'TXN-0008' && t.client_id === clientId,
    );
    if (!commitment || !txn)
      throw new ReviewError(
        'Required capital-call or redemption record is missing.',
      );
    const call = obligations.find((o) => o.id === 'CN-008')!;
    call.sourceIds.push(
      source(
        'commitments.csv',
        commitment.commitment_id,
        end,
        'Linked capital-call source (not additional obligation)',
        commitment,
      ),
    );
    call.note =
      'Linked to COM-003; one exposure, two sources. Call dates remain unconfirmed.';
    redemptionRef = source(
      'transactions.csv',
      txn.transaction_id,
      txn.trade_date,
      'Redemption request — not confirmed cash',
      txn,
    );
    if (
      txn.transaction_type !== 'Redemption Request' ||
      number(txn.amount) !== 0
    )
      throw new ReviewError(
        'Redemption record changed; review the case mapping before drafting.',
      );
  }
  const facts: Review['facts'] = [
    {
      id: 'portfolio-value',
      label: 'Portfolio value',
      value: total,
      currency: 'USD',
      sources: current.map(holdingRef),
    },
  ];
  let spendingRefs: string[] = [];
  if (config.type === 'inheritance') {
    const equity = allocation.find((a) => a.assetClass === 'Equity');
    if (!equity || equity.max === null)
      throw new ReviewError('Equity mandate comparison is unavailable.');
    facts.push(
      {
        id: 'equity-weight',
        label: 'Equity allocation',
        value: equity.weight,
        unit: '%',
        sources: equity.sourceIds,
      },
      {
        id: 'equity-max',
        label: 'Supplied mandate maximum',
        value: equity.max,
        unit: '%',
        sources: equity.sourceIds,
      },
      {
        id: 'equity-excess',
        label: 'Above supplied maximum',
        value: Math.max(0, equity.weight - equity.max),
        unit: 'percentage points',
        sources: equity.sourceIds,
      },
    );
  }
  if (config.type === 'retirement') {
    const match = client.objectives.match(
      /USD\s*([\d.]+)m\s*(?:per|a)\s*year/i,
    );
    if (!match)
      throw new ReviewError(
        'The annual spending objective needs manual interpretation.',
      );
    const stated = Number(match[1]) * 1e6;
    const planned = obligations[0].amount!;
    const calc = source(
      'calculation',
      'annual-spending-difference',
      end,
      'Difference between recorded annual amounts',
      {
        formula: 'planned cash need − stated objective',
        stated: String(stated),
        planned: String(planned),
        difference: String(planned - stated),
      },
      'calculation',
      [clientRef, ...obligations[0].sourceIds],
    );
    spendingRefs = [clientRef, ...obligations[0].sourceIds, calc];
    facts.push(
      {
        id: 'stated-spending',
        label: 'Client objective',
        value: stated,
        currency: 'USD',
        unit: '/ year',
        sources: [clientRef],
      },
      {
        id: 'planned-spending',
        label: 'Planned cash need',
        value: planned,
        currency: 'USD',
        unit: '/ year',
        sources: obligations[0].sourceIds,
      },
      {
        id: 'spending-difference',
        label: 'Annual amount to reconcile',
        value: planned - stated,
        currency: 'USD',
        unit: '/ year',
        sources: spendingRefs,
      },
    );
  }
  const eventRows =
    config.type === 'retirement'
      ? dataset.events.filter(
          (e) =>
            e.event_date >= comparisonStart &&
            e.event_date <= end &&
            /duration|fixed income/i.test(e.primary_transmission),
        )
      : [];
  const events = eventRows.map((e, i) => ({
    date: e.event_date,
    description: e.description,
    channel: e.primary_transmission,
    sourceId: source(
      'event_log.csv',
      `${e.event_date}|${e.event_type}|${i}`,
      e.event_date,
      'Relevant event context — not quantified attribution',
      e,
    ),
  }));
  const st = (text: string, evidenceIds: string[]): Statement => ({
    text,
    evidenceIds,
  });
  let template: DraftContent;
  if (config.type === 'funding') {
    const liquidityRefs = current
      .filter((h) => h.liquidity_tier !== 'Daily')
      .map(holdingRef);
    template = {
      opening: st(
        'I would like to review the timing of your upcoming US dollar payments with you.',
        [clientRef, ...obligations.flatMap((o) => o.sourceIds)],
      ),
      whyItMatters: st(
        'Some investments have withdrawal restrictions, and proceeds from the requested fund redemption remain unconfirmed.',
        [...liquidityRefs, redemptionRef, ...noteRefs],
      ),
      questions: [
        st(
          'What are the next confirmed university-fee and capital-call amounts and dates?',
          obligations.flatMap((o) => o.sourceIds),
        ),
        st(
          'What deposit access terms and redemption proceeds have been confirmed?',
          [...liquidityRefs, redemptionRef],
        ),
      ],
      nextStep: st(
        'Once we confirm these details, we can discuss accessible funding options and currency arrangements before considering any changes.',
        [clientRef, ...noteRefs],
      ),
      caveat: st(
        'The records do not establish a cash shortfall; payment timing and available proceeds still need confirmation.',
        [...obligations.flatMap((o) => o.sourceIds), redemptionRef],
      ),
    };
  } else if (config.type === 'inheritance') {
    const equity = allocation.find((a) => a.assetClass === 'Equity')!;
    template = {
      opening: st(
        'I would like to help you understand how your inherited investments fit your preference for stability.',
        [clientRef, ...noteRefs],
      ),
      whyItMatters: st(
        equity.exception
          ? 'The equity allocation is outside the supplied mandate band, and an upcoming payment also requires planning.'
          : 'The supplied allocation and upcoming payment should be reviewed together.',
        [...equity.sourceIds, ...obligations[0].sourceIds],
      ),
      questions: [
        st(
          'What arrangements are confirmed for the upcoming payment?',
          obligations[0].sourceIds,
        ),
        st(
          'What would help you feel more comfortable with the inherited portfolio?',
          [clientRef, ...noteRefs],
        ),
      ],
      nextStep: st(
        'Let us review the holdings and payment funding with the appropriate specialist before considering any changes.',
        [clientRef, ...obligations[0].sourceIds],
      ),
      caveat: st(
        'The payment amount is a supplied record, and the mandate comparison is not a legal or tax conclusion.',
        [...equity.sourceIds, ...obligations[0].sourceIds],
      ),
    };
  } else
    template = {
      opening: st(
        'I would like to check that our planning reflects your current living and medical expenses.',
        [clientRef, ...noteRefs],
      ),
      whyItMatters: st(
        'Our records contain different annual spending amounts, alongside your concerns about bond values.',
        [...spendingRefs, ...noteRefs],
      ),
      questions: [
        st(
          'Which annual spending amount reflects your current living and medical needs?',
          spendingRefs,
        ),
      ],
      nextStep: st(
        'Once we confirm the current requirement, we can discuss upcoming withdrawals and the trade-offs of available options.',
        [clientRef, ...noteRefs],
      ),
      caveat: st(
        'Neither spending record has been selected as correct, and the difference is not an established funding deficit.',
        spendingRefs,
      ),
    };
  const inputVersion = createHash('sha256')
    .update(
      JSON.stringify({
        version: 'fundinglens-3',
        clientId,
        comparisonStart,
        end,
        evidence,
      }),
    )
    .digest('hex')
    .slice(0, 24);
  return {
    clientId,
    inputVersion,
    asOf: end,
    comparisonStart,
    comparisonEnd: end,
    client: {
      name: client.client_name,
      short: config.short,
      risk: client.risk_profile,
      language: client.reporting_language,
      goal: client.objectives,
      bookingCentre: client.booking_centre,
      portfolioId: portfolios.map((p) => p.portfolio_id).join(', '),
      inception: portfolios[0].inception_date,
    },
    type: config.type,
    title: config.title,
    question: config.question,
    action: config.action,
    status:
      config.type === 'inheritance'
        ? allocation.some((a) => a.exception)
          ? 'Outside supplied limits'
          : 'Within supplied limits'
        : config.status,
    unknowns: config.unknowns,
    total,
    liquidity,
    allocation,
    history,
    change: difference(
      history.find((h) => h.date === comparisonStart)?.value ?? null,
      total,
    ),
    obligations,
    facts,
    evidence,
    warnings,
    template,
    events,
    singleExceptions,
  };
}
