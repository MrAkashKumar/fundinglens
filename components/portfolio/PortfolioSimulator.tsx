'use client';
import { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { PortfolioResult } from '@/lib/portfolio/contracts';
import {
  currentAllocation,
  simulatePortfolio,
  simulatorBlocked,
} from '@/lib/scenarios/portfolio-simulator';
const money = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(n);
export default function PortfolioSimulator({
  portfolios,
  asOf,
}: {
  portfolios: PortfolioResult[];
  asOf: string;
}) {
  const [id, setId] = useState(portfolios[0]?.id || '');
  const portfolio = portfolios.find((p) => p.id === id);
  return (
    <section className="in-workspace">
      <div className="in-section-heading">
        <div>
          <p className="eyebrow">PORTFOLIO LAB · COMPARE BEFORE CHANGING</p>
          <h3>Build and test a different investment mix</h3>
          <p>
            Adjust the asset-class weights, then compare the same hypothetical
            market shock across both portfolios.
          </p>
        </div>
      </div>
      <label htmlFor="sim-portfolio">Portfolio to simulate</label>
      <Select
        value={id}
        onValueChange={(v) => {
          if (v) setId(v);
        }}
      >
        <SelectTrigger id="sim-portfolio" aria-label="Portfolio to simulate">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {portfolios.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.id} · {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {portfolio && (
        <SimulatorEditor key={portfolio.id} portfolio={portfolio} asOf={asOf} />
      )}
    </section>
  );
}
function SimulatorEditor({
  portfolio,
  asOf,
}: {
  portfolio: PortfolioResult;
  asOf: string;
}) {
  const initial = () =>
    currentAllocation(portfolio).map((r) => ({
      ...r,
      targetPct: String(r.targetPct),
      shockPct: '0',
    }));
  const [inputs, setInputs] = useState(initial);
  const [result, setResult] = useState<ReturnType<
    typeof simulatePortfolio
  > | null>(null);
  const [error, setError] = useState('');
  const total = inputs.reduce(
    (n, r) => n + (r.targetPct.trim() ? Number(r.targetPct) : 0),
    0,
  );
  if (simulatorBlocked(portfolio))
    return (
      <div className="in-notice">
        Simulation unavailable. Resolve this portfolio’s missing values or
        internal source checks first.
      </div>
    );
  function change(index: number, key: 'targetPct' | 'shockPct', value: string) {
    setInputs(inputs.map((r, i) => (i === index ? { ...r, [key]: value } : r)));
    setResult(null);
    setError('');
  }
  return (
    <>
      <div className="in-notice">
        Starting value: <strong>{money(portfolio.total!)}</strong> · Snapshot{' '}
        {asOf}. This reallocates the same USD budget. No extra cash, sales from
        other portfolios, fees or taxes are included.
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            if (inputs.some((r) => !r.targetPct.trim() || !r.shockPct.trim()))
              throw new Error('Complete every allocation and shock input.');
            setResult(
              simulatePortfolio(
                portfolio,
                inputs.map((r) => ({
                  ...r,
                  targetPct: Number(r.targetPct),
                  shockPct: Number(r.shockPct),
                })),
              ),
            );
            setError('');
          } catch (e) {
            setResult(null);
            setError(
              e instanceof Error && !e.message.startsWith('[')
                ? e.message
                : 'Check target weights (0–100%, two decimals) and market shocks (−100% to +100%).',
            );
          }
        }}
      >
        <div className="pd-table-wrap">
          <Table>
            <TableCaption>
              Targets must total 100%. Shock means a one-time assumed value
              change; zero is the starting assumption, not a forecast.
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Asset class</TableHead>
                <TableHead>Current value</TableHead>
                <TableHead>Target weight %</TableHead>
                <TableHead>Market shock %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inputs.map((r, i) => (
                <TableRow key={r.assetClass}>
                  <TableCell>{r.assetClass}</TableCell>
                  <TableCell>
                    {money(
                      portfolio.positions
                        .filter((h) => h.assetClass === r.assetClass)
                        .reduce((n, h) => n + h.value, 0),
                    )}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      aria-label={r.assetClass + ' target weight percent'}
                      value={r.targetPct}
                      min={0}
                      max={100}
                      step="0.01"
                      required
                      onChange={(e) => change(i, 'targetPct', e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      aria-label={r.assetClass + ' market shock percent'}
                      value={r.shockPct}
                      min={-100}
                      max={100}
                      step="any"
                      required
                      onChange={(e) => change(i, 'shockPct', e.target.value)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="sim-actions">
          <strong aria-live="polite">
            Allocated: {Number.isFinite(total) ? total.toFixed(2) : '—'}% / 100%
          </strong>
          <Button type="submit">Simulate this portfolio</Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setInputs(initial());
              setResult(null);
              setError('');
            }}
          >
            Reset to current mix
          </Button>
        </div>
      </form>
      <output aria-live="polite">{error}</output>
      {result && (
        <>
          <div className="in-outcomes">
            <article>
              <span>Modeled reductions</span>
              <strong>{money(result.reductions)}</strong>
              <small>Reassigned within the same portfolio</small>
            </article>
            <article>
              <span>Modeled increases</span>
              <strong>{money(result.increases)}</strong>
              <small>Before trading costs and taxes</small>
            </article>
            <article>
              <span>Mandate exceptions</span>
              <strong>{result.outside}</strong>
              <small>
                {portfolio.service === 'Custody'
                  ? 'Custody: mandate checks not applied'
                  : 'Proposed weights vs supplied bands'}
              </small>
            </article>
          </div>
          <h3>Current mix vs your proposed mix</h3>
          <figure
            className="in-chart"
            aria-label="Current and proposed asset-class weights; exact values follow"
          >
            <ResponsiveContainer
              width="100%"
              height={Math.max(270, result.rows.length * 65)}
            >
              <BarChart
                data={result.rows}
                layout="vertical"
                margin={{ left: 0, right: 30, top: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tickFormatter={(v) => v + '%'}
                />
                <YAxis
                  type="category"
                  dataKey="assetClass"
                  width={140}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip formatter={(v) => Number(v).toFixed(2) + '%'} />
                <Legend />
                <Bar
                  dataKey="currentPct"
                  name="Current weight"
                  fill="#a6b2c3"
                  radius={[0, 3, 3, 0]}
                />
                <Bar
                  dataKey="targetPct"
                  name="Proposed weight"
                  fill="#77588f"
                  radius={[0, 3, 3, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </figure>
          <div className="pd-table-wrap">
            <Table>
              <TableCaption>
                Illustrative allocation changes, not executable orders. Positive
                changes mean increases; negative changes mean reductions.
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset class</TableHead>
                  <TableHead>Proposed value</TableHead>
                  <TableHead>Change</TableHead>
                  <TableHead>Mandate range</TableHead>
                  <TableHead>Check</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((r) => (
                  <TableRow key={r.assetClass}>
                    <TableCell>{r.assetClass}</TableCell>
                    <TableCell>{money(r.proposed)}</TableCell>
                    <TableCell>
                      {r.change > 0 ? '+' : ''}
                      {money(r.change)}
                    </TableCell>
                    <TableCell>
                      {r.min === null || r.max === null
                        ? 'Unavailable'
                        : `${r.min}–${r.max}%`}
                    </TableCell>
                    <TableCell>{r.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <article className="in-signal">
            <p className="eyebrow">SAME SHOCK · TWO DIFFERENT ALLOCATIONS</p>
            <h3>How would each mix respond?</h3>
            <div className="in-outcomes">
              <article>
                <span>Current after shock</span>
                <strong>{money(result.currentStressed)}</strong>
                <small>
                  Change: {money(result.currentStressed - result.total)}
                </small>
              </article>
              <article>
                <span>Proposed after shock</span>
                <strong>{money(result.proposedStressed)}</strong>
                <small>
                  Change: {money(result.proposedStressed - result.total)}
                </small>
              </article>
              <article>
                <span>Proposed minus current</span>
                <strong>
                  {money(result.proposedStressed - result.currentStressed)}
                </strong>
                <small>Only under the entered shocks</small>
              </article>
            </div>
            <p className="in-detail">
              {inputs.every((r) => Number(r.shockPct) === 0)
                ? 'Enter a negative or positive shock for an asset class to test a market move.'
                : 'A better result in this one scenario does not establish a better or suitable portfolio. Test different shocks and review the mandate before discussing changes.'}
            </p>
          </article>
        </>
      )}
      <details className="pd-evidence">
        <summary>Assumptions and review requirements</summary>
        <p>
          Target values use the current portfolio total, with cents distributed
          to preserve the budget. Each asset class receives its entered one-time
          shock: value × (1 + shock / 100). This assumes the proposed mix can be
          established before the shock. Access restrictions, collateral pledges,
          security selection, lot sizes, transaction costs, tax, FX and
          single-security concentration are not tested. A class absent from
          current holdings may appear when the supplied mandate includes it. No
          investments are traded or bank records changed.
        </p>
      </details>
    </>
  );
}
