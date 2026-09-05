'use client';
import { useEffect, useRef, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  ReferenceLine,
  Legend,
} from 'recharts';
import { afterSaleAllocation } from '@/lib/scenarios/allocation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ClientReview, PortfolioResult } from '@/lib/portfolio/contracts';
import {
  analyzeScenarios,
  eligibility,
  positionKey,
  scenarioClientText,
  type ScenarioAnalysis,
} from '@/lib/scenarios/model';
const money = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(n);
type Explanation = { summary: string; tradeoffs: string[]; checks: string[] };
export default function ScenarioPlanner({
  client,
  portfolios,
}: {
  client: ClientReview;
  portfolios: PortfolioResult[];
}) {
  const [target, setTarget] = useState('');
  const [cash, setCash] = useState('0');
  const [cost, setCost] = useState('1');
  const [deadline, setDeadline] = useState('');
  const [eligibleIds, setEligibleIds] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [analysis, setAnalysis] = useState<ScenarioAnalysis | null>(null);
  const [selectedId, setSelectedId] = useState('minimum');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [message, setMessage] = useState('');
  const [draft, setDraft] = useState('');
  const [draftChecked, setDraftChecked] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const seq = useRef(0);
  useEffect(() => () => controller.current?.abort(), []);
  const positions = portfolios.flatMap((portfolio) =>
    portfolio.positions.map((p) => ({
      p,
      reason: eligibility(client, portfolio, p),
    })),
  );
  const valid = positions.filter((p) => !p.reason);
  function invalidate() {
    seq.current++;
    controller.current?.abort();
    setAnalysis(null);
    setExplanation(null);
    setConfirmed(false);
    setDraft('');
    setReviewed(false);
    setDraftChecked(false);
    setBusy(false);
    setError('');
    setMessage('');
  }
  function calculate() {
    try {
      const result = analyzeScenarios(client, {
        clientId: client.id,
        portfolioIds: portfolios.map((p) => p.id),
        eligibleIds,
        target: Number(target),
        externalCash: Number(cash),
        costPct: Number(cost),
        deadline,
      });
      setAnalysis(result);
      setSelectedId('minimum');
      setError('');
      setExplanation(null);
      setDraft('');
      setReviewed(false);
      setDraftChecked(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid scenario inputs.');
    }
  }
  async function explain() {
    if (!analysis) return;
    const current = ++seq.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const timeout = setTimeout(() => abort.abort(), 23000);
    setBusy(true);
    setMessage('');
    try {
      const r = await fetch('/api/scenario-explanation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(analysis.input),
        signal: abort.signal,
      });
      const body = (await r.json()) as Explanation & { error?: string };
      if (!r.ok) throw new Error(body.error || 'AI explanation failed');
      if (seq.current === current) setExplanation(body);
    } catch (e) {
      if (seq.current === current)
        setMessage(
          e instanceof Error && e.name === 'AbortError'
            ? 'AI explanation timed out. Calculated scenarios remain available.'
            : e instanceof Error
              ? e.message
              : 'AI explanation unavailable.',
        );
    } finally {
      clearTimeout(timeout);
      if (seq.current === current) setBusy(false);
    }
  }
  const selected = analysis?.scenarios.find((s) => s.id === selectedId);
  const mix = selected
    ? [...new Set(positions.map(({ p }) => p.assetClass))].map(
        (assetClass) => ({
          name: assetClass,
          before: positions
            .filter(({ p }) => p.assetClass === assetClass)
            .reduce((s, { p }) => s + p.value, 0),
          after:
            positions
              .filter(({ p }) => p.assetClass === assetClass)
              .reduce((s, { p }) => s + p.value, 0) -
            selected.sales
              .filter((p) => p.assetClass === assetClass)
              .reduce((s, p) => s + p.gross, 0),
        }),
      )
    : [];
  return (
    <section className="sp">
      <div className="sp-title">
        <p className="eyebrow">CUSTOM CASH GOAL · PARTIAL-SALE SCENARIOS</p>
        <h3>How much would need to be sold?</h3>
        <p>
          Compare partial sales using the supplied holdings. The minimum is a
          mathematical estimate under your assumptions, not an AI trade
          recommendation.
        </p>
      </div>
      <div className="sp-inputs">
        <div>
          <label htmlFor="sp-target">Cash objective · USD</label>
          <Input
            id="sp-target"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="e.g. 1000000"
            value={target}
            onChange={(e) => {
              invalidate();
              setTarget(e.target.value);
            }}
          />
        </div>
        <div>
          <label htmlFor="sp-deadline">Needed by</label>
          <Input
            id="sp-deadline"
            type="date"
            min={client.asOf}
            value={deadline}
            onChange={(e) => {
              invalidate();
              setDeadline(e.target.value);
            }}
          />
        </div>
        <div>
          <label htmlFor="sp-cash">
            Confirmed cash outside these portfolios · USD
          </label>
          <Input
            id="sp-cash"
            type="number"
            min="0"
            step="0.01"
            value={cash}
            onChange={(e) => {
              invalidate();
              setCash(e.target.value);
            }}
          />
        </div>
        <div>
          <label htmlFor="sp-cost">Assumed sale-cost allowance · %</label>
          <Input
            id="sp-cost"
            type="number"
            min="0"
            max="20"
            step="0.1"
            value={cost}
            onChange={(e) => {
              invalidate();
              setCost(e.target.value);
            }}
          />
          <small>
            1% is an illustrative default, not an actual fee or tax estimate.
          </small>
        </div>
      </div>
      <details className="sp-candidates" open>
        <summary>
          Choose holdings to include · {eligibleIds.length} selected /{' '}
          {valid.length} candidates
        </summary>
        <p>
          Only daily-dealing, non-cash holdings valued at the snapshot are
          candidates. Portfolios linked to credit collateral and unresolved data
          checks are excluded. No candidate is selected automatically.
        </p>
        <Button
          variant="outline"
          onClick={() => {
            invalidate();
            setEligibleIds(valid.map(({ p }) => positionKey(p)));
          }}
        >
          Select all available candidates
        </Button>
        <div className="sp-holding-list">
          {positions.map(({ p, reason }) => (
            <label
              key={positionKey(p)}
              htmlFor={'sp-' + positionKey(p)}
              className={reason ? 'excluded' : ''}
            >
              <Checkbox
                id={'sp-' + positionKey(p)}
                disabled={Boolean(reason)}
                checked={eligibleIds.includes(positionKey(p))}
                onCheckedChange={(v) => {
                  invalidate();
                  setEligibleIds(
                    v
                      ? [...eligibleIds, positionKey(p)]
                      : eligibleIds.filter((id) => id !== positionKey(p)),
                  );
                }}
              />
              <span>
                <strong>{p.name}</strong>
                <small>
                  {p.portfolioId} · {p.currency} · {money(p.value)} USD
                  equivalent
                </small>
                {reason && <small>Excluded: {reason}</small>}
              </span>
            </label>
          ))}
        </div>
      </details>
      <label className="review-check" htmlFor="sp-confirm">
        <Checkbox
          id="sp-confirm"
          checked={confirmed}
          onCheckedChange={(v) => setConfirmed(v === true)}
        />
        <span>
          I confirm the selected candidates are available for this illustration
          and the external cash is separate. Actual settlement, FX, taxes and
          suitability still require review.
        </span>
      </label>
      <Button
        disabled={
          !confirmed || !target || !deadline || cash === '' || cost === ''
        }
        onClick={calculate}
      >
        Compare minimum, 10%, 20% and 50%
      </Button>
      {error && (
        <p role="alert" className="sp-error">
          {error}
        </p>
      )}
      {analysis && selected && (
        <div className="sp-results">
          <div className="sp-result-heading">
            <h3>
              {analysis.minimumFeasible
                ? 'Target is covered in the model'
                : 'Selected holdings cannot cover the target'}
            </h3>
            <p>
              {analysis.minimumFeasible
                ? 'This is an arithmetic result; it does not confirm funds will be available by the deadline.'
                : 'A funding gap remains after selling all selected candidates. Review the goal, timing or separately confirmed funding sources.'}
            </p>
          </div>
          <div className="wo-metrics">
            <article>
              <span>Minimum modeled sale required</span>
              <strong>{money(analysis.requiredGross)}</strong>
              <small>
                {((analysis.requiredGross / analysis.total) * 100).toFixed(2)}%
                of selected portfolio · before costs
              </small>
            </article>
            <article>
              <span>Eligible holding value</span>
              <strong>{money(analysis.eligibleValue)}</strong>
              <small>Only RM-selected candidates</small>
            </article>
            <article>
              <span>Cash goal</span>
              <strong>{money(analysis.input.target)}</strong>
              <small>By {analysis.input.deadline} · USD</small>
            </article>
          </div>
          <div className="sp-chart">
            <h4>Compare modeled funding with the goal</h4>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={analysis.scenarios.map((s) => ({
                  ...s,
                  short:
                    s.id === 'minimum'
                      ? 'Minimum'
                      : s.id === 'fewest'
                        ? 'Fewest'
                        : s.id.replace('sell-', '') + '%',
                }))}
                margin={{ top: 20, right: 20, left: 20, bottom: 10 }}
              >
                <CartesianGrid vertical={false} stroke="#e2e9ee" />
                <XAxis dataKey="short" />
                <YAxis
                  tickFormatter={(v) =>
                    new Intl.NumberFormat('en', { notation: 'compact' }).format(
                      Number(v),
                    )
                  }
                />
                <Tooltip formatter={(v) => money(Number(v))} />
                <ReferenceLine
                  y={analysis.input.target}
                  stroke="#b65e32"
                  strokeDasharray="5 4"
                  label="Cash goal"
                />
                <Bar
                  dataKey="funding"
                  name="External cash + net sale proceeds"
                  fill="#177b75"
                  radius={[5, 5, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="pd-table-wrap">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Scenario</TableHead>
                  <TableHead>Gross sale</TableHead>
                  <TableHead>Net proceeds</TableHead>
                  <TableHead>Gap / surplus</TableHead>
                  <TableHead>Remaining invested</TableHead>
                  <TableHead>Compare</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analysis.scenarios.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <strong>{s.label}</strong>
                      <small>
                        {s.soldPct.toFixed(2)}% actually modeled ·{' '}
                        {s.sales.length} holding(s)
                        {s.eligibleCapped
                          ? ' · capped by eligible holdings'
                          : ''}
                      </small>
                    </TableCell>
                    <TableCell>{money(s.gross)}</TableCell>
                    <TableCell>{money(s.net)}</TableCell>
                    <TableCell>
                      {s.gap > 0
                        ? money(s.gap) + ' gap'
                        : money(s.surplus) + ' surplus'}
                    </TableCell>
                    <TableCell>{money(s.remaining)}</TableCell>
                    <TableCell>
                      <Button
                        variant={selectedId === s.id ? 'default' : 'outline'}
                        onClick={() => {
                          setSelectedId(s.id);
                          setDraft('');
                          setReviewed(false);
                          setDraftChecked(false);
                        }}
                      >
                        Inspect
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="wo-note">
            10%, 20% and 50% refer to the selected portfolio’s gross value,
            distributed across eligible holdings. If eligible holdings are
            insufficient, the actual modeled percentage is lower. Minimum and
            fewest-position variants sell the same value; they differ in which
            positions remain.
          </p>
          <section className="sp-selected">
            <h3>{selected.label}</h3>
            <p>
              Estimated costs: {money(selected.cost)} · Net proceeds:{' '}
              {money(selected.net)} · Funding gap: {money(selected.gap)}
            </p>
            <div className="pd-table-wrap">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Holding / record</TableHead>
                    <TableHead>Sell value</TableHead>
                    <TableHead>% of holding</TableHead>
                    <TableHead>Value remaining</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selected.sales.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <strong>{s.name}</strong>
                        <small>
                          {s.id} · holdings.csv · {client.asOf}
                        </small>
                      </TableCell>
                      <TableCell>{money(s.gross)}</TableCell>
                      <TableCell>{s.percent.toFixed(2)}%</TableCell>
                      <TableCell>{money(s.remaining)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {!selected.sales.length && (
              <p>
                No sale modeled. Check the external-cash assumption or the
                remaining funding gap.
              </p>
            )}
            <div className="sp-chart">
              <h4>Selected portfolio: before and after modeled sales</h4>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={mix}
                  margin={{ top: 10, right: 15, left: 20, bottom: 10 }}
                >
                  <CartesianGrid vertical={false} stroke="#e2e9ee" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis
                    tickFormatter={(v) =>
                      new Intl.NumberFormat('en', {
                        notation: 'compact',
                      }).format(Number(v))
                    }
                  />
                  <Tooltip formatter={(v) => money(Number(v))} />
                  <Legend />
                  <Bar dataKey="before" name="Before (USD)" fill="#879fae" />
                  <Bar dataKey="after" name="After (USD)" fill="#177b75" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="wo-note">
              Remaining asset values are not a post-sale suitability assessment.
              The fewest-position option may change concentration significantly.
            </p>
          </section>
          <section className="sp-selected">
            <h3>After-sale allocation checks</h3>
            <p>
              Recalculated within each portfolio against supplied asset-class
              limits. Cash proceeds are assumed withdrawn. This does not assess
              tax, single-position limits or overall suitability.
            </p>
            <div className="pd-table-wrap">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Portfolio / asset class</TableHead>
                    <TableHead>Before</TableHead>
                    <TableHead>After</TableHead>
                    <TableHead>Supplied range</TableHead>
                    <TableHead>Review</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {afterSaleAllocation(portfolios, selected).map((a) => (
                    <TableRow key={a.portfolioId + a.assetClass}>
                      <TableCell>
                        {a.portfolioId} · {a.assetClass}
                      </TableCell>
                      <TableCell>
                        {a.beforePct === null
                          ? '—'
                          : a.beforePct.toFixed(2) + '%'}
                      </TableCell>
                      <TableCell>
                        {a.afterPct === null
                          ? '—'
                          : a.afterPct.toFixed(2) + '%'}
                      </TableCell>
                      <TableCell>
                        {a.min === null || a.max === null
                          ? 'Unavailable'
                          : `${a.min}%–${a.max}%`}
                      </TableCell>
                      <TableCell>{a.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
          <section className="sp-ai">
            <h3>AI explanation for the RM</h3>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void explain()}
            >
              {busy ? 'Explaining…' : 'Explain the comparison with AI'}
            </Button>
            {explanation && (
              <div>
                <p>
                  <strong>
                    AI-generated explanation · verify against the calculations
                  </strong>
                </p>
                <p>{explanation.summary}</p>
                <h4>Trade-offs</h4>
                <ul>
                  {explanation.tradeoffs.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
                <h4>Checks before discussing action</h4>
                <ul>
                  {explanation.checks.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            )}
            <output aria-live="polite">{message}</output>
          </section>
          <details className="sp-assumptions">
            <summary>Calculation assumptions and limitations</summary>
            <ul>
              {analysis.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </details>
          <section className="sp-client">
            <h3>Prepare a client discussion summary</h3>
            <Button
              variant="outline"
              onClick={() => {
                setDraft(scenarioClientText(client, analysis, selected));
                setReviewed(false);
                setDraftChecked(false);
              }}
            >
              Draft summary for selected scenario
            </Button>
            {draft && (
              <>
                <label htmlFor="sp-client-draft">Client message</label>
                <Textarea
                  id="sp-client-draft"
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    setReviewed(false);
                    setDraftChecked(false);
                  }}
                />
                <label className="review-check" htmlFor="sp-client-check">
                  <Checkbox
                    id="sp-client-check"
                    checked={draftChecked}
                    onCheckedChange={(v) => setDraftChecked(v === true)}
                  />
                  <span>
                    I reviewed the assumptions, recipient, figures and wording.
                  </span>
                </label>
                <Button
                  disabled={!draftChecked || !draft.trim()}
                  onClick={() => setReviewed(true)}
                >
                  Mark summary reviewed
                </Button>
                {reviewed && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      void navigator.clipboard
                        .writeText(draft)
                        .then(() =>
                          setMessage(
                            'Reviewed summary copied. No trades or messages were sent.',
                          ),
                        )
                        .catch(() =>
                          setMessage(
                            'Copy unavailable; select the reviewed text manually.',
                          ),
                        );
                    }}
                  >
                    Copy reviewed summary
                  </Button>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
