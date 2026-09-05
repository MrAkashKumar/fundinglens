import { PortfolioReviewService } from '../lib/portfolio/service';
import { DatasetPortfolioRepository } from '../lib/portfolio/repository';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'csv-parse/sync';
import { buildReview } from '../lib/reviews';
import { number, difference } from '../lib/analytics';
import {
  validateDraft,
  editRevision,
  reviewRevision,
  canPreview,
  fallback,
} from '../lib/briefing';
import type { DataSet } from '../lib/data';
import type { Revision } from '../lib/types';
const files = {
  clients: 'clients',
  creditFacilities: 'credit_facilities',
  portfolios: 'portfolios',
  holdings: 'holdings',
  instruments: 'instruments',
  mandates: 'mandates',
  needs: 'planned_cash_needs',
  commitments: 'commitments',
  transactions: 'transactions',
  events: 'event_log',
  market: 'market_context',
};
const data = {
  ...Object.fromEntries(
    Object.entries(files).map(([key, file]) => [
      key,
      parse(
        readFileSync(new URL(`../data/${file}.csv`, import.meta.url), 'utf8'),
        { columns: true, skip_empty_lines: true, bom: true, trim: true },
      ),
    ]),
  ),
  notes: JSON.parse(
    readFileSync(new URL('../data/rm_notes.json', import.meta.url), 'utf8'),
  ),
} as DataSet;
const tran = buildReview(data, 'CL-0006');
void test('Tran liquidity partitions are mutually exclusive and match supplied positions', () => {
  assert.equal(tran.total, 18072993.49);
  assert.equal(
    tran.liquidity.find((x) => x.tier === 'Daily')?.value,
    12508972.19,
  );
  assert.equal(
    tran.liquidity.find((x) => x.tier === 'Monthly')?.value,
    2071005.92,
  );
  assert.equal(
    Math.round(tran.liquidity.reduce((a, b) => a + b.value, 0) * 100),
    Math.round(tran.total * 100),
  );
});
void test('Capital calls count once; zero redemption request is not cash proceeds', () => {
  assert.equal(tran.obligations.filter((x) => x.id === 'CN-008').length, 1);
  assert.equal(
    tran.obligations.find((x) => x.id === 'CN-008')?.sourceIds.length,
    2,
  );
  assert.match(
    tran.obligations.find((x) => x.id === 'CN-008')!.note,
    /one exposure/,
  );
  assert.ok(tran.evidence.some((x) => x.key === 'TXN-0008'));
  assert.equal(tran.obligations.length, 2);
});
void test('Inherited portfolio equity is assessed against its own conservative mandate', () => {
  const r = buildReview(data, 'CL-0003');
  const e = r.allocation.find((x) => x.assetClass === 'Equity')!;
  assert.equal(Number(e.weight.toFixed(2)), 71.46);
  assert.equal(e.max, 30);
  assert.equal(e.exception, true);
  assert.equal(r.obligations[0].amount, 3400000);
  assert.equal(r.obligations[0].currency, 'EUR');
  assert.ok(r.history.some((x) => x.preInception));
});
void test('Retirement discrepancy remains a discrepancy', () => {
  const r = buildReview(data, 'CL-0012');
  assert.ok(r.facts.some((x) => x.value === 180000));
  assert.match(r.unknowns.join(' '), /not an established funding deficit/);
});
void test('All curated templates cite real evidence and contain no generated quantities', () => {
  for (const id of ['CL-0006', 'CL-0003', 'CL-0012']) {
    const r = buildReview(data, id);
    validateDraft(r.template, r);
    assert.equal(fallback(r, 'api_not_configured').mode, 'template_fallback');
  }
});
void test('Missing essential records, conflicting positions and invalid dates fail explicitly', () => {
  const copy = structuredClone(data);
  copy.clients = copy.clients.filter((x) => x.client_id !== 'CL-0006');
  assert.throws(() => buildReview(copy, 'CL-0006'), /missing/);
  assert.throws(() => buildReview(data, 'CL-9999'), /not found/);
  assert.throws(() => buildReview(data, 'CL-0006', '2026-01-01'), /supported/);
  const bad = structuredClone(data);
  const row = bad.holdings.find((x) => x.portfolio_id === 'PF-0008')!;
  bad.holdings.push({ ...row, market_value_usd: '999' });
  assert.throws(() => buildReview(bad, 'CL-0006'), /Conflicting/);
});
void test('Exact duplicates do not inflate totals; unknown liquidity is visible', () => {
  const copy = structuredClone(data);
  copy.holdings.push({
    ...copy.holdings.find(
      (x) => x.portfolio_id === 'PF-0008' && x.snapshot_date === '2026-08-26',
    )!,
  });
  assert.equal(buildReview(copy, 'CL-0006').total, tran.total);
  copy.holdings = copy.holdings.map((x) =>
    x.portfolio_id === 'PF-0008' ? { ...x, liquidity_tier: '' } : x,
  );
  const r = buildReview(copy, 'CL-0006');
  assert.equal(r.liquidity[0].tier, 'Unknown');
  assert.ok(r.warnings.some((x) => x.includes('classification unavailable')));
});
void test('Numerical and citation hallucinations are rejected', () => {
  const d = structuredClone(tran.template);
  d.opening.text = 'You have USD 1000000 ready to withdraw.';
  assert.throws(() => validateDraft(d, tran), /Unsupported/);
  d.opening.text = 'Please review the funding schedule.';
  d.opening.evidenceIds = ['invented'];
  assert.throws(() => validateDraft(d, tran), /Unknown evidence/);
});
void test('Any edit or changed input invalidates review; another client cannot preview', () => {
  const draft: Revision = {
    id: 'test',
    clientId: tran.clientId,
    inputVersion: tran.inputVersion,
    revision: 1,
    text: 'Please confirm the next payment date.',
    mode: 'template_fallback',
    status: 'draft',
    updatedAt: new Date().toISOString(),
    evidenceIds: [],
  };
  const approved = reviewRevision(draft, tran.inputVersion);
  assert.ok(canPreview(approved, tran));
  assert.equal(
    canPreview(editRevision(approved, 'Updated questions for review.'), tran),
    false,
  );
  assert.equal(canPreview(approved, { ...tran, clientId: 'CL-0003' }), false);
  assert.equal(
    canPreview(approved, { ...tran, inputVersion: 'changed' }),
    false,
  );
  assert.throws(() =>
    reviewRevision({ ...draft, status: 'rejected' }, tran.inputVersion),
  );
  assert.throws(() =>
    reviewRevision({ ...draft, text: ' ' }, tran.inputVersion),
  );
  assert.notEqual(
    buildReview(data, 'CL-0006', '2025-12-31').inputVersion,
    tran.inputVersion,
  );
});
void test('Missing amounts and zero comparison values never become misleading percentages', () => {
  assert.equal(number(''), null);
  assert.equal(number('NaN'), null);
  assert.equal(difference(0, 100).percent, null);
  assert.equal(difference(null, 100).absolute, null);
});

void test('Communication requests are specific, isolated and evidence-backed', async () => {
  const { communicationTasks, newCommunication } =
    await import('../lib/communications');
  for (const id of ['CL-0006', 'CL-0003', 'CL-0012']) {
    const r = buildReview(data, id);
    for (const task of communicationTasks(r)) {
      assert.ok(
        task.sources.every((id) => r.evidence.some((s) => s.id === id)),
      );
      assert.equal(newCommunication(r, task).clientId, id);
    }
  }
  assert.equal(communicationTasks(tran).length, 2);
});
void test('Follow-ups require external request record; edits invalidate approval', async () => {
  const {
    communicationTasks,
    newCommunication,
    approveMessage,
    isReviewed,
    changeMessage,
    recordEvent,
    makeFollowup,
  } = await import('../lib/communications');
  const task = communicationTasks(tran)[0];
  const draft = newCommunication(tran, task);
  assert.throws(() => makeFollowup(draft, task));
  const reviewed = approveMessage(draft);
  assert.ok(isReviewed(reviewed));
  assert.equal(
    isReviewed(changeMessage(reviewed, 'Changed subject', reviewed.body)),
    false,
  );
  const sent = recordEvent(reviewed, 'Request recorded as sent externally');
  const next = makeFollowup(sent, task);
  assert.equal(next.kind, 'followup');
  assert.equal(isReviewed(next), false);
  assert.equal(next.events[0].body, draft.body);
  assert.throws(() => makeFollowup({ ...sent, closed: true }, task));
});

void test('Public fixed-case drafts deduplicate simultaneous generation and reuse results', async () => {
  const { reuseDraft } = await import('../lib/draft-cache');
  let count = 0;
  const generate = async () => {
    count++;
    return fallback(tran, 'api_not_configured');
  };
  const results = await Promise.all([
    reuseDraft('test-cache', generate),
    reuseDraft('test-cache', generate),
  ]);
  assert.equal(count, 1);
  assert.deepEqual(results[0], results[1]);
  await reuseDraft('test-cache', generate);
  assert.equal(count, 1);
});

void test('AI intake must use exact note excerpts, valid fields and no duplicates', async () => {
  const { validateExtraction } = await import('../lib/intake');
  const note =
    'Client said tuition is USD 80,000 due 15 October. Operations will confirm access.';
  assert.equal(
    validateExtraction(
      {
        items: [
          {
            fieldId: 'payment',
            quote: 'Client said tuition is USD 80,000 due 15 October.',
          },
        ],
      },
      note,
      'funding',
    ).items.length,
    1,
  );
  assert.throws(() =>
    validateExtraction(
      { items: [{ fieldId: 'payment', quote: 'Tuition is USD 50,000.' }] },
      note,
      'funding',
    ),
  );
  assert.throws(() =>
    validateExtraction(
      { items: [{ fieldId: 'invented', quote: note }] },
      note,
      'funding',
    ),
  );
  assert.throws(() =>
    validateExtraction(
      {
        items: [
          { fieldId: 'payment', quote: note },
          { fieldId: 'payment', quote: note },
        ],
      },
      note,
      'funding',
    ),
  );
});
void test('Sparse intake preserves unanswered questions and existing facts', async () => {
  const { composeIntakeDraft, hasCredential } = await import('../lib/intake');
  const original = JSON.stringify(tran);
  const result = composeIntakeDraft(tran, {
    followup: 'Discuss on 21 September.',
  });
  assert.match(result, /Discuss on 21 September/);
  assert.match(result, /remains to be confirmed/);
  assert.match(result, /redemption request is not confirmed proceeds/);
  assert.equal(JSON.stringify(tran), original);
  assert.ok(hasCredential('sk-proj-' + 'x'.repeat(32)));
  assert.equal(hasCredential('Tuition remains unconfirmed'), false);
});

void test('AI health reports verified only after a successful provider check', async () => {
  const { checkAIHealth } = await import('../lib/ai-health');
  let calls = 0;
  const probe = async () => {
    calls++;
  };
  const missing = await checkAIHealth(false, probe);
  assert.equal(calls, 0);
  assert.equal(missing.status, 'not_configured');
  assert.equal(missing.verified, false);
  const available = await checkAIHealth(true, probe);
  assert.equal(available.verified, true);
  assert.ok(available.checkedAt);
  const failed = await checkAIHealth(true, async () => {
    throw new Error('private provider detail');
  });
  assert.equal(failed.status, 'unavailable');
  assert.equal(failed.verified, false);
  assert.equal(
    JSON.stringify(failed).includes('private provider detail'),
    false,
  );
});

void test('Portfolio service reviews every supplied client and portfolio', async () => {
  const { DatasetPortfolioRepository } =
    await import('../lib/portfolio/repository');
  const { PortfolioReviewService } = await import('../lib/portfolio/service');
  const book = new PortfolioReviewService(
    new DatasetPortfolioRepository(data),
  ).reviewBook('2026-08-26');
  assert.equal(book.clients.length, 20);
  assert.equal(book.coverage.portfolios, 24);
  assert.equal(
    book.coverage.currentHoldings,
    data.holdings.filter((h) => h.snapshot_date === '2026-08-26').length,
  );
  const marg = book.clients.find((c) => c.id === 'CL-0003')!;
  assert.ok(
    marg.findings.some(
      (f) => f.category === 'Allocation' && f.detail.includes('71.46%'),
    ),
  );
  for (const c of book.clients)
    for (const p of c.portfolios)
      if (p.service === 'Custody')
        assert.ok(
          !p.findings.some((f) =>
            ['Allocation', 'Concentration'].includes(f.category),
          ),
        );
});
void test('Broken portfolio data blocks weights, totals and client allocation findings', async () => {
  const { DatasetPortfolioRepository } =
    await import('../lib/portfolio/repository');
  const { PortfolioReviewService } = await import('../lib/portfolio/service');
  const broken = structuredClone(data);
  broken.holdings.find(
    (h) => h.portfolio_id === 'PF-0005' && h.snapshot_date === '2026-08-26',
  )!.market_value_usd = '';
  const r = new PortfolioReviewService(
    new DatasetPortfolioRepository(broken),
  ).reviewClient('CL-0003', '2026-08-26');
  assert.equal(r.total, null);
  assert.ok(
    r.findings.some((f) => f.title === 'Assessment blocked by source data'),
  );
  assert.ok(!r.findings.some((f) => f.category === 'Allocation'));
  assert.ok(
    r.portfolios.flatMap((p) => p.positions).every((p) => p.weight === null),
  );
});
void test('Portfolio rules are replaceable and missing rules do not fabricate exceptions', async () => {
  const { DatasetPortfolioRepository } =
    await import('../lib/portfolio/repository');
  const { PortfolioReviewService } = await import('../lib/portfolio/service');
  const r = new PortfolioReviewService(
    new DatasetPortfolioRepository(data),
    [],
  ).reviewClient('CL-0003', '2026-08-26');
  assert.ok(!r.findings.some((f) => f.category === 'Allocation'));
});
void test('Portfolio alerts preserve evidence and block internal-only findings', async () => {
  const { DatasetPortfolioRepository } =
    await import('../lib/portfolio/repository');
  const { PortfolioReviewService } = await import('../lib/portfolio/service');
  const { alertDraft } = await import('../lib/portfolio/alerts');
  const r = new PortfolioReviewService(
    new DatasetPortfolioRepository(data),
  ).reviewClient('CL-0003', '2026-08-26');
  const f = r.findings.find((f) => f.category === 'Allocation')!;
  assert.match(alertDraft(r, f), /71.46%/);
  assert.match(alertDraft(r, f), /No portfolio changes/);
  assert.throws(() => alertDraft(r, { ...f, audience: 'internal' }));
  const updated = structuredClone(data);
  updated.holdings.find(
    (h) => h.portfolio_id === 'PF-0005' && h.snapshot_date === '2026-08-26',
  )!.market_value_usd = '1';
  const other = new PortfolioReviewService(
    new DatasetPortfolioRepository(updated),
  ).reviewClient('CL-0003', '2026-08-26');
  assert.ok(!other.findings.some((x) => x.id === f.id));
});

void test('Wealth overview totals and chart segments reconcile without counting holdings twice', async () => {
  const { DatasetPortfolioRepository } =
    await import('../lib/portfolio/repository');
  const { PortfolioReviewService } = await import('../lib/portfolio/service');
  const { summarizePortfolios } = await import('../lib/portfolio/summary');
  const r = new PortfolioReviewService(
    new DatasetPortfolioRepository(data),
  ).reviewClient('CL-0006', '2026-08-26');
  const s = summarizePortfolios(r.portfolios);
  assert.equal(s.total, 18072993.49);
  assert.equal(
    Math.round(s.assets.reduce((n, a) => n + a.value, 0) * 100),
    Math.round(s.total! * 100),
  );
  assert.equal(
    Math.round(s.access.reduce((n, a) => n + a.value, 0) * 100),
    Math.round(s.total! * 100),
  );
  assert.equal(s.restricted, 5564021.3);
  const incomplete = summarizePortfolios([{ ...r.portfolios[0], total: null }]);
  assert.equal(incomplete.total, null);
  assert.equal(incomplete.assets.length, 0);
  assert.equal(incomplete.restricted, null);
});
void test('Capital-call planning preserves individual records and never adds overlapping planned needs', async () => {
  const { DatasetPortfolioRepository } =
    await import('../lib/portfolio/repository');
  const { PortfolioReviewService } = await import('../lib/portfolio/service');
  const r = new PortfolioReviewService(
    new DatasetPortfolioRepository(data),
  ).reviewClient('CL-0006', '2026-08-26');
  const f = r.findings.filter((f) => f.category === 'Capital calls');
  assert.equal(f.length, 1);
  assert.match(f[0].detail, /3,000,000/);
  assert.match(f[0].reason, /not added/);
  assert.equal(f[0].evidence[0].fields.commitment_id, 'COM-003');
  assert.equal(r.plannedNeeds.filter((n) => n.need_id === 'CN-008').length, 1);
});

void test('Partial-sale scenarios fund the objective with minimal cents-based gross sales', async () => {
  const { DatasetPortfolioRepository } =
    await import('../lib/portfolio/repository');
  const { PortfolioReviewService } = await import('../lib/portfolio/service');
  const { analyzeScenarios, eligibility, positionKey } =
    await import('../lib/scenarios/model');
  const c = new PortfolioReviewService(
    new DatasetPortfolioRepository(data),
  ).reviewClient('CL-0006', '2026-08-26');
  const ids = c.portfolios.flatMap((p) =>
    p.positions.filter((h) => !eligibility(c, p, h)).map(positionKey),
  );
  const a = analyzeScenarios(c, {
    clientId: c.id,
    portfolioIds: c.portfolios.map((p) => p.id),
    eligibleIds: ids,
    target: 1000000,
    externalCash: 100000,
    costPct: 1,
    deadline: '2026-10-01',
  });
  const m = a.scenarios[0];
  assert.equal(m.gap, 0);
  assert.equal(m.gross, 909090.91);
  assert.equal(m.net, 900000);
  assert.equal(a.scenarios[1].gross, m.gross);
  assert.ok(a.scenarios[1].sales.length <= m.sales.length);
  assert.equal(
    Math.round((m.remaining + m.gross) * 100),
    Math.round(a.total * 100),
  );
  for (const s of a.scenarios)
    for (const sale of s.sales) {
      assert.ok(sale.gross <= sale.before);
      assert.ok(sale.remaining >= 0);
    }
  assert.ok(a.scenarios[4].soldPct <= 50);
});
void test('Infeasible goals show gaps, no eligible holdings sell nothing, and external cash can avoid a sale', async () => {
  const { DatasetPortfolioRepository } =
    await import('../lib/portfolio/repository');
  const { PortfolioReviewService } = await import('../lib/portfolio/service');
  const { analyzeScenarios } = await import('../lib/scenarios/model');
  const c = new PortfolioReviewService(
    new DatasetPortfolioRepository(data),
  ).reviewClient('CL-0006', '2026-08-26');
  const input = {
    clientId: c.id,
    portfolioIds: c.portfolios.map((p) => p.id),
    eligibleIds: [],
    target: 1000000,
    externalCash: 0,
    costPct: 1,
    deadline: '2026-10-01',
  };
  const a = analyzeScenarios(c, input);
  assert.equal(a.minimumFeasible, false);
  assert.equal(a.scenarios[0].gap, 1000000);
  assert.equal(a.scenarios[0].gross, 0);
  const funded = analyzeScenarios(c, { ...input, externalCash: 1000000 });
  assert.equal(funded.scenarios[0].gross, 0);
  assert.equal(funded.scenarios[0].gap, 0);
  assert.equal(funded.minimumFeasible, true);
});
void test('Planner refuses restricted, collateral-linked, duplicate and out-of-scope holdings', async () => {
  const { DatasetPortfolioRepository } =
    await import('../lib/portfolio/repository');
  const { PortfolioReviewService } = await import('../lib/portfolio/service');
  const { analyzeScenarios, positionKey } =
    await import('../lib/scenarios/model');
  const service = new PortfolioReviewService(
    new DatasetPortfolioRepository(data),
  );
  const c = service.reviewClient('CL-0006', '2026-08-26');
  const p = c.portfolios[0];
  const restricted = p.positions.find((h) => h.liquidity === 'Monthly')!;
  const input = {
    clientId: c.id,
    portfolioIds: [p.id],
    eligibleIds: [positionKey(restricted)],
    target: 1000,
    externalCash: 0,
    costPct: 1,
    deadline: '2026-10-01',
  };
  assert.throws(() => analyzeScenarios(c, input));
  assert.throws(() =>
    analyzeScenarios(c, { ...input, eligibleIds: ['PF-0005|other'] }),
  );
  assert.throws(() =>
    analyzeScenarios(c, { ...input, portfolioIds: [p.id, p.id] }),
  );
  const borrower = service.reviewClient('CL-0002', '2026-08-26');
  assert.ok(borrower.collateralPortfolioIds.includes('PF-0003'));
  const pledged = borrower.portfolios.find((p) => p.id === 'PF-0003')!;
  assert.throws(
    () =>
      analyzeScenarios(borrower, {
        ...input,
        clientId: borrower.id,
        portfolioIds: [pledged.id],
        eligibleIds: [positionKey(pledged.positions[0])],
      }),
    /collateral|Source/,
  );
});

void test('Post-sale allocation uses each remaining portfolio denominator and excludes custody assessments', async () => {
  const { afterSaleAllocation } = await import('../lib/scenarios/allocation');
  const { DatasetPortfolioRepository } =
    await import('../lib/portfolio/repository');
  const { PortfolioReviewService } = await import('../lib/portfolio/service');
  const { analyzeScenarios, eligibility, positionKey } =
    await import('../lib/scenarios/model');
  const c = new PortfolioReviewService(
    new DatasetPortfolioRepository(data),
  ).reviewClient('CL-0003', '2026-08-26');
  const p = c.portfolios[0];
  const eligible = p.positions.filter((h) => !eligibility(c, p, h));
  const a = analyzeScenarios(c, {
    clientId: c.id,
    portfolioIds: [p.id],
    eligibleIds: eligible.map(positionKey),
    target: 1000000,
    externalCash: 0,
    costPct: 0,
    deadline: '2026-10-01',
  });
  const rows = afterSaleAllocation(c.portfolios, a.scenarios[0]);
  assert.ok(
    Math.abs(rows.reduce((n, r) => n + (r.afterPct || 0), 0) - 100) < 1e-8,
  );
  assert.ok(
    afterSaleAllocation([{ ...p, service: 'Custody' }], a.scenarios[0]).every(
      (r) => r.status === 'Not assessed',
    ),
  );
});

import {
  projectWealth,
  scopedPortfolios,
  validateIntelligence,
} from '../lib/intelligence/model';
import { alertDraft } from '../lib/portfolio/alerts';
void test('Wealth projections compound annually with additions at year end, preserving negative-return paths', () => {
  const r = projectWealth({
    startingValue: 1000,
    years: 2,
    low: -10,
    central: 0,
    high: 10,
    contribution: 100,
    goal: 1500,
  });
  assert.deepEqual(r.rows[1], {
    year: 1,
    lower: 1000,
    central: 1100,
    higher: 1200,
  });
  assert.equal(r.rows[2].lower, 1000);
  assert.equal(r.rows[2].central, 1200);
  assert.equal(r.rows[2].higher, 1420);
  assert.equal(r.outcomes[1].gap, 300);
  const wiped = projectWealth({
    startingValue: 1000,
    years: 1,
    low: -100,
    central: 0,
    high: 10,
    contribution: 0,
    goal: 100,
  });
  assert.equal(wiped.outcomes[0].value, 0);
  assert.equal(wiped.outcomes[2].surplus, 1000);
});
void test('Projection inputs reject impossible rates, unordered assumptions, invalid horizons and NaN', () => {
  const base = {
    startingValue: 1000,
    years: 5,
    low: -5,
    central: 0,
    high: 5,
    contribution: 0,
    goal: 1500,
  };
  for (const change of [
    { years: 1.5 },
    { years: 31 },
    { low: -101 },
    { low: 10 },
    { high: NaN },
    { goal: 0 },
    { contribution: -1 },
  ])
    assert.throws(() => projectWealth({ ...base, ...change }));
});
void test('Intelligence enforces portfolio ownership and source-linked unique AI findings', () => {
  const client = new PortfolioReviewService(
    new DatasetPortfolioRepository(data),
  ).reviewClient('CL-0006', '2026-08-26');
  assert.throws(() => scopedPortfolios(client, ['another-client-portfolio']));
  assert.throws(() =>
    scopedPortfolios(client, [
      client.portfolios[0].id,
      client.portfolios[0].id,
    ]),
  );
  const f = client.findings[0];
  assert.ok(f);
  const item = {
    findingId: f.id,
    explanation: 'Review the supplied evidence with the specialist.',
    question: 'Has the relevant client context changed?',
  };
  assert.equal(
    validateIntelligence({ insights: [item] }, client.portfolios).insights[0]
      .findingId,
    f.id,
  );
  assert.throws(() =>
    validateIntelligence(
      { insights: [{ ...item, findingId: 'invented' }] },
      client.portfolios,
    ),
  );
  assert.throws(() =>
    validateIntelligence({ insights: [item, item] }, client.portfolios),
  );
  assert.throws(() =>
    validateIntelligence(
      { insights: [{ ...item, explanation: 'Expect 20% growth' }] },
      client.portfolios,
    ),
  );
});
void test('Purpose-specific communication stays tied to the source without claiming a prior conversation', () => {
  const client = new PortfolioReviewService(
    new DatasetPortfolioRepository(data),
  ).reviewClient('CL-0006', '2026-08-26');
  const finding = client.findings.find((f) => f.audience === 'client_review')!;
  assert.ok(finding);
  const request = alertDraft(client, finding, 'request');
  const followup = alertDraft(client, finding, 'followup');
  assert.ok(request.includes(finding.detail));
  assert.match(request, /secure channel/);
  assert.match(followup, /whether there are any updates/);
  assert.doesNotMatch(followup, /as we discussed|previous message/);
  assert.notEqual(request, followup);
});

import {
  currentAllocation,
  simulatePortfolio,
} from '../lib/scenarios/portfolio-simulator';
void test('Portfolio simulator preserves the budget and compares identical shocks fairly', () => {
  const client = new PortfolioReviewService(
    new DatasetPortfolioRepository(data),
  ).reviewClient('CL-0006', '2026-08-26');
  const p = client.portfolios[0];
  const input = currentAllocation(p);
  assert.equal(
    input.reduce((n, r) => n + Math.round(r.targetPct * 100), 0),
    10000,
  );
  const first = simulatePortfolio(p, input);
  assert.equal(
    first.rows.reduce((n, r) => n + Math.round(r.proposed * 100), 0),
    Math.round(p.total! * 100),
  );
  assert.equal(
    Math.round(first.increases * 100),
    Math.round(first.reductions * 100),
  );
  assert.equal(first.currentStressed, p.total);
  assert.equal(first.proposedStressed, p.total);
  const changed = input.map((r, i) => ({
    ...r,
    targetPct: i === 0 ? 100 : 0,
    shockPct: i === 0 ? -20 : 0,
  }));
  const result = simulatePortfolio(p, changed);
  assert.equal(result.proposedStressed, Math.round(p.total! * 100 * 0.8) / 100);
  assert.equal(result.rows[0].proposed, p.total);
  assert.equal(
    Math.round(result.increases * 100),
    Math.round(result.reductions * 100),
  );
});
void test('Simulator blocks invalid budgets, duplicate classes and incomplete source data', () => {
  const p = new PortfolioReviewService(
    new DatasetPortfolioRepository(data),
  ).reviewClient('CL-0006', '2026-08-26').portfolios[0];
  const input = currentAllocation(p);
  assert.throws(() =>
    simulatePortfolio(
      p,
      input.map((r, i) => ({
        ...r,
        targetPct: i === 0 ? r.targetPct + 1 : r.targetPct,
      })),
    ),
  );
  assert.throws(() => simulatePortfolio(p, [...input, input[0]]));
  assert.throws(() =>
    simulatePortfolio(
      p,
      input.map((r) => ({ ...r, shockPct: -101 })),
    ),
  );
  assert.throws(() => simulatePortfolio({ ...p, total: null }, input));
  assert.ok(
    simulatePortfolio({ ...p, service: 'Custody' }, input).rows.every(
      (r) => r.status === 'Not assessed',
    ),
  );
});
