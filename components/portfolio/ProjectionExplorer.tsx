'use client';
import { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  TableCaption,
} from '@/components/ui/table';
import type { PortfolioResult } from '@/lib/portfolio/contracts';
import { summarizePortfolios } from '@/lib/portfolio/summary';
import { projectWealth } from '@/lib/intelligence/model';
const money = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
export default function ProjectionExplorer({
  portfolios,
  asOf,
}: {
  portfolios: PortfolioResult[];
  asOf: string;
}) {
  const summary = summarizePortfolios(portfolios);
  const [fields, setFields] = useState({
    years: '5',
    low: '-5',
    central: '0',
    high: '5',
    contribution: '0',
    goal: '',
  });
  const [result, setResult] = useState<ReturnType<typeof projectWealth> | null>(
    null,
  );
  const [error, setError] = useState('');
  const blocked =
    !summary.total ||
    portfolios.some((p) =>
      p.findings.some(
        (f) =>
          f.category === 'Data quality' &&
          f.title !== 'Duplicate records removed',
      ),
    );
  const labels = {
    years: 'Horizon (years)',
    low: 'Lower annual return (%)',
    central: 'Central annual return (%)',
    high: 'Higher annual return (%)',
    contribution: 'Annual addition (USD)',
    goal: 'Future wealth goal (USD)',
  };
  return (
    <section className="in-projection">
      <div className="in-section-heading">
        <div>
          <p className="eyebrow">WHAT IF · ASSUMPTIONS YOU CONTROL</p>
          <h3>Explore a possible path to the wealth goal</h3>
          <p>
            Start with{' '}
            {summary.total === null
              ? 'unavailable value'
              : money(summary.total)}{' '}
            across the selected portfolios, as of {asOf}.
          </p>
        </div>
      </div>
      <p className="in-notice">
        These are mathematical illustrations, not AI predictions. The example
        rates −5%, 0% and +5% are arbitrary inputs, with no assigned
        probability. They do not describe the likely return of these holdings.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            if (blocked)
              throw new Error(
                'Resolve source checks before projecting values.',
              );
            if (Object.values(fields).some((v) => !v.trim()))
              throw new Error('Complete every assumption.');
            setResult(
              projectWealth({
                startingValue: summary.total!,
                ...Object.fromEntries(
                  Object.entries(fields).map(([k, v]) => [k, Number(v)]),
                ),
              } as Parameters<typeof projectWealth>[0]),
            );
            setError('');
          } catch {
            setResult(null);
            setError(
              'Check inputs: horizon 1–30 whole years; returns −100% to 50% in increasing order; additions ≥ 0 and goal > 0. Resolve any source checks first.',
            );
          }
        }}
      >
        <div className="in-form-grid">
          {(Object.keys(fields) as Array<keyof typeof fields>).map((key) => (
            <label key={key} htmlFor={'projection-' + key}>
              {labels[key]}
              <Input
                id={'projection-' + key}
                type="number"
                required
                step={key === 'years' ? '1' : 'any'}
                min={
                  key === 'years'
                    ? 1
                    : key === 'goal'
                      ? 0.01
                      : key === 'contribution'
                        ? 0
                        : -100
                }
                max={
                  key === 'years'
                    ? 30
                    : key === 'goal'
                      ? 1e13
                      : key === 'contribution'
                        ? 1e10
                        : 50
                }
                value={fields[key]}
                placeholder={key === 'goal' ? 'Enter client goal' : undefined}
                onChange={(e) => {
                  setFields({ ...fields, [key]: e.target.value });
                  setResult(null);
                  setError('');
                }}
              />
            </label>
          ))}
        </div>
        <Button type="submit" disabled={blocked}>
          Calculate illustrative paths
        </Button>
      </form>
      {blocked && (
        <output>
          Projection unavailable until the selected portfolio values and source
          checks are resolved.
        </output>
      )}
      <output aria-live="polite">{error}</output>
      {result && (
        <>
          <div className="in-outcomes">
            {result.outcomes.map((o) => (
              <article key={o.key}>
                <span>{o.key} assumption</span>
                <strong>{money(o.value)}</strong>
                <small>
                  {o.gap > 0
                    ? `${money(o.gap)} below goal`
                    : `${money(o.surplus)} above goal`}
                </small>
              </article>
            ))}
          </div>
          <figure
            className="in-chart"
            aria-label="Hypothetical portfolio values by year under three annual return assumptions; exact values in the table below"
          >
            <ResponsiveContainer width="100%" height={320}>
              <LineChart
                data={result.rows}
                margin={{ left: 14, right: 30, top: 20, bottom: 12 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="year" tickFormatter={(v) => 'Year ' + v} />
                <YAxis
                  tickFormatter={(v) =>
                    new Intl.NumberFormat('en-US', {
                      notation: 'compact',
                      style: 'currency',
                      currency: 'USD',
                    }).format(Number(v))
                  }
                  width={85}
                />
                <Tooltip formatter={(v) => money(Number(v))} />
                <Legend />
                <ReferenceLine
                  y={result.input.goal}
                  stroke="#755397"
                  strokeDasharray="5 5"
                  label="Goal"
                  ifOverflow="extendDomain"
                />
                <Line
                  dataKey="lower"
                  name={`Lower (${result.input.low}%)`}
                  stroke="#b36b39"
                  dot={false}
                  strokeWidth={2}
                />
                <Line
                  dataKey="central"
                  name={`Central (${result.input.central}%)`}
                  stroke="#253f60"
                  dot={false}
                  strokeWidth={3}
                />
                <Line
                  dataKey="higher"
                  name={`Higher (${result.input.high}%)`}
                  stroke="#16836e"
                  dot={false}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </figure>
          <details className="pd-evidence">
            <summary>View exact annual values</summary>
            <Table>
              <TableCaption>
                USD illustrations before fees, tax and inflation; display
                rounded to whole dollars
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Year</TableHead>
                  <TableHead>Lower</TableHead>
                  <TableHead>Central</TableHead>
                  <TableHead>Higher</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((r) => (
                  <TableRow key={r.year}>
                    <TableCell>{r.year}</TableCell>
                    <TableCell>{money(r.lower)}</TableCell>
                    <TableCell>{money(r.central)}</TableCell>
                    <TableCell>{money(r.higher)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </details>
          <div className="in-context">
            <strong>How to use this in the review</strong>
            <p>
              {result.outcomes[1].gap > 0
                ? 'The central assumption leaves a gap. Compare a longer horizon, additional contributions, or a revised goal with the client.'
                : 'The central assumption reaches the modeled goal. Test the lower assumption before treating the plan as resilient.'}{' '}
              A larger assumed return does not establish that a different
              investment is suitable.
            </p>
          </div>
        </>
      )}
      <details className="pd-evidence">
        <summary>Method and what is missing</summary>
        <p>
          Each year: prior value × (1 + assumed annual return) + annual
          addition. Additions occur at year end. Each rate applies to the entire
          selected portfolio in USD, including cash. No withdrawals, fees,
          taxes, inflation, FX moves, correlations, volatility or rebalancing
          are modeled. Planned cash needs and sale scenarios are not deducted
          here. The lines are separate constant-rate examples, not a confidence
          interval or a forecast trained on market history.
        </p>
      </details>
    </section>
  );
}
