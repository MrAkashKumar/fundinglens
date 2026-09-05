'use client';
import { useEffect, useRef, useState } from 'react';
import { Sparkles, Globe2, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
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
import {
  eventPresets,
  eventClasses,
  presetShocks,
  analyzeEvent,
  validateEventAI,
  type EventInput,
  type EventAIOutput,
} from '@/lib/scenarios/events';
import type { ClientReview, PortfolioResult } from '@/lib/portfolio/contracts';
const money = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
const pct = (n: number) => (n > 0 ? '+' : '') + n.toFixed(2) + '%';
const names = {
  down: 'Downside example',
  middle: 'Middle example',
  up: 'Upside example',
};
export default function EventSimulator({
  client,
  portfolios,
}: {
  client: ClientReview;
  portfolios: PortfolioResult[];
}) {
  const classes = eventClasses(portfolios);
  const [eventId, setEventId] = useState<EventInput['eventId']>('rates');
  const [customTitle, setCustomTitle] = useState('');
  const makeInputs = (id: EventInput['eventId']) =>
    presetShocks(id, classes).map((s) => ({
      ...s,
      down: String(s.down),
      middle: String(s.middle),
      up: String(s.up),
    }));
  const [inputs, setInputs] = useState(() => makeInputs('rates'));
  const [result, setResult] = useState<ReturnType<typeof analyzeEvent> | null>(
    null,
  );
  const [requestInput, setRequestInput] = useState<EventInput | null>(null);
  const [error, setError] = useState('');
  const [ai, setAI] = useState<EventAIOutput | null>(null);
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  function invalidate() {
    controller.current?.abort();
    setBusy(false);
    setAI(null);
    setResult(null);
    setRequestInput(null);
    setError('');
  }
  const event = eventPresets.find((p) => p.id === eventId)!;
  const assessed = result?.filter((p) => !p.blocked) || [];
  const chart = assessed.map((p) => ({
    name: p.id,
    down: p.outcomes[0].pct,
    middle: p.outcomes[1].pct,
    up: p.outcomes[2].pct,
  }));
  async function explain() {
    if (!requestInput) return;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError('');
    setAI(null);
    try {
      const r = await fetch('/api/event-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestInput),
        signal: abort.signal,
      });
      const value = (await r.json()) as {
        error?: string;
        summary?: unknown;
        reviews?: unknown;
      };
      if (!r.ok)
        throw new Error(value.error || 'AI interpretation unavailable.');
      if (!abort.signal.aborted)
        setAI(
          validateEventAI(
            { summary: value.summary, reviews: value.reviews },
            assessed.map((p) => p.id),
          ),
        );
    } catch (e) {
      if (!abort.signal.aborted)
        setError(
          e instanceof Error ? e.message : 'AI interpretation unavailable.',
        );
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  }
  return (
    <section className="in-workspace ev-workspace">
      <div className="in-section-heading">
        <div>
          <p className="eyebrow">
            <Globe2 size={16} /> WORLD EVENTS → PORTFOLIO IMPACT
          </p>
          <h3>What if the world changes?</h3>
          <p>
            Test a hypothetical event against {portfolios.length} selected
            portfolio(s). See modeled price changes, the exposures driving them,
            and questions for the RM.
          </p>
        </div>
        <span className="ev-status">Scenario analysis · No live news feed</span>
      </div>
      <div className="ev-events" aria-label="Choose a hypothetical event">
        {eventPresets.map((p) => (
          <button
            type="button"
            key={p.id}
            aria-pressed={eventId === p.id}
            className={eventId === p.id ? 'active' : ''}
            onClick={() => {
              invalidate();
              setEventId(p.id);
              setInputs(makeInputs(p.id));
            }}
          >
            <Globe2 size={18} />
            <strong>{p.title}</strong>
            <span>
              {p.id === 'custom'
                ? 'Start from zero shocks'
                : 'Illustrative preset · Edit all assumptions'}
            </span>
          </button>
        ))}
      </div>
      <div className="ev-context">
        <strong>{event.description}</strong>
        <p>{event.review}</p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          invalidate();
          try {
            if (eventId === 'custom' && !customTitle.trim())
              throw new Error('Name the hypothetical event first.');
            if (
              inputs.some((s) =>
                [s.down, s.middle, s.up].some((v) => !v.trim()),
              )
            )
              throw new Error('Complete every shock input.');
            const shocks = inputs.map((s) => ({
              ...s,
              down: Number(s.down),
              middle: Number(s.middle),
              up: Number(s.up),
            }));
            const output = analyzeEvent(portfolios, shocks);
            setResult(output);
            setRequestInput({
              clientId: client.id,
              portfolioIds: portfolios.map((p) => p.id),
              eventId,
              customTitle,
              shocks,
            });
          } catch (e) {
            setError(
              e instanceof Error && !e.message.startsWith('[')
                ? e.message
                : 'Use shocks between −100% and +100%, with downside ≤ middle ≤ upside for every class.',
            );
          }
        }}
      >
        {eventId === 'custom' && (
          <label className="ev-title" htmlFor="ev-title">
            Hypothetical event
            <Input
              id="ev-title"
              value={customTitle}
              maxLength={160}
              required
              placeholder="For example: shipping disruption raises energy costs"
              onChange={(e) => {
                invalidate();
                setCustomTitle(e.target.value);
              }}
            />
          </label>
        )}
        <div className="in-notice">
          <strong>Review the assumptions before running.</strong> Preset
          percentages are arbitrary examples, not calibrated estimates.
          “Downside” and “upside” mean the lower and higher cases entered
          here—not the worst or best possible outcome. No likelihood is
          assigned.
        </div>
        <details className="pd-evidence ev-assumptions" open>
          <summary>Asset-class price shocks (%) · editable</summary>
          <div className="pd-table-wrap">
            <Table>
              <TableCaption>
                One-time price changes applied equally within each asset class.
                No annualization or forecast horizon. Custom / unrecognized
                classes start at zero.
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset class</TableHead>
                  <TableHead>Downside</TableHead>
                  <TableHead>Middle</TableHead>
                  <TableHead>Upside</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inputs.map((s, i) => (
                  <TableRow key={s.assetClass}>
                    <TableCell>{s.assetClass}</TableCell>
                    {(['down', 'middle', 'up'] as const).map((key) => (
                      <TableCell key={key}>
                        <Input
                          aria-label={
                            s.assetClass + ' ' + names[key] + ' shock percent'
                          }
                          type="number"
                          required
                          min={-100}
                          max={100}
                          step="any"
                          value={s[key]}
                          onChange={(e) => {
                            invalidate();
                            setInputs(
                              inputs.map((r, j) =>
                                i === j ? { ...r, [key]: e.target.value } : r,
                              ),
                            );
                          }}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </details>
        <div className="sim-actions">
          <Button type="submit" disabled={!classes.length}>
            Compare portfolio outcomes
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              invalidate();
              setInputs(makeInputs(eventId));
            }}
          >
            Reset assumptions
          </Button>
          <span className="muted text-sm">
            Holdings snapshot: {client.asOf}
          </span>
        </div>
      </form>
      <output aria-live="polite">{error}</output>
      {result && (
        <>
          <div className="in-section-heading">
            <div>
              <p className="eyebrow">CONDITIONAL RESULTS · USD</p>
              <h3>Each portfolio reacts differently</h3>
              <p>
                Same assumptions, different asset mix. {assessed.length}{' '}
                assessed; {result.length - assessed.length} blocked by source
                checks.
              </p>
            </div>
            <Button
              onClick={() => void explain()}
              disabled={busy || !assessed.length}
            >
              <Sparkles size={17} />
              {busy ? 'Reading scenario…' : 'Explain with AI'}
            </Button>
          </div>
          {assessed.length > 0 && (
            <figure
              className="in-chart"
              aria-label="Three modeled percentage changes per portfolio; values also listed below"
            >
              <ResponsiveContainer
                width="100%"
                height={Math.max(280, assessed.length * 100)}
              >
                <BarChart
                  layout="vertical"
                  data={chart}
                  margin={{ right: 35, left: 5, top: 10, bottom: 10 }}
                >
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v) => v + '%'} />
                  <YAxis type="category" dataKey="name" width={90} />
                  <ReferenceLine x={0} stroke="#8090a5" />
                  <Tooltip formatter={(v) => pct(Number(v))} />
                  <Legend />
                  <Bar dataKey="down" name="Downside example" fill="#bc6f52" />
                  <Bar dataKey="middle" name="Middle example" fill="#8797b0" />
                  <Bar dataKey="up" name="Upside example" fill="#278574" />
                </BarChart>
              </ResponsiveContainer>
            </figure>
          )}
          {ai && (
            <section className="in-ai">
              <p className="eyebrow">
                <Sparkles size={16} /> AI INTERPRETATION · VERIFY BEFORE USE
              </p>
              <p>{ai.summary}</p>
              {ai.reviews.map((r) => (
                <article key={r.portfolioId}>
                  <strong>{r.portfolioId}</strong>
                  <p>{r.interpretation}</p>
                  <blockquote>{r.check}</blockquote>
                </article>
              ))}
              <small>
                AI reviews up to three assessed portfolios. All calculated
                results remain below. It does not verify current events or
                validate the shock assumptions.
              </small>
            </section>
          )}
          {result.map((p) => (
            <article key={p.id} className="ev-portfolio">
              <header>
                <div>
                  <p className="eyebrow">{p.id}</p>
                  <h3>{p.name}</h3>
                </div>
                <strong>
                  {p.total === null ? 'Value unavailable' : money(p.total)}
                </strong>
              </header>
              {p.blocked ? (
                <p className="in-notice">
                  Resolve internal source checks before using scenario results
                  for this portfolio.
                </p>
              ) : (
                <>
                  <div className="ev-outcomes">
                    {p.outcomes.map((o) => (
                      <section key={o.key}>
                        <span>
                          {o.key === 'down' ? (
                            <ArrowDownRight size={17} />
                          ) : o.key === 'up' ? (
                            <ArrowUpRight size={17} />
                          ) : null}
                          {names[o.key]}
                        </span>
                        <strong>{pct(o.pct)}</strong>
                        <p>
                          {o.change > 0 ? '+' : ''}
                          {money(o.change)} modeled change
                        </p>
                        <small>Value after shock: {money(o.after)}</small>
                      </section>
                    ))}
                  </div>
                  <div className="ev-driver">
                    <strong>Largest absolute downside contributor</strong>
                    <p>
                      {[...p.rows]
                        .sort((a, b) => Math.abs(b.down) - Math.abs(a.down))
                        .slice(0, 1)
                        .map(
                          (r) =>
                            `${r.name} · ${money(r.down)} under the downside inputs. This reflects its size and assigned class shock, not a security-specific forecast.`,
                        )}
                    </p>
                  </div>
                  <details className="pd-evidence">
                    <summary>
                      Trace the result to {p.rows.length} holdings
                    </summary>
                    <div className="pd-table-wrap">
                      <Table>
                        <TableCaption>
                          Each change = holding’s USD value × asset-class shock.
                          Values shown to whole dollars; calculations round each
                          holding’s change to cents.
                        </TableCaption>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Holding / source date</TableHead>
                            <TableHead>Asset class / access</TableHead>
                            <TableHead>Current USD</TableHead>
                            <TableHead>Downside Δ</TableHead>
                            <TableHead>Middle Δ</TableHead>
                            <TableHead>Upside Δ</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {p.rows.map((r) => (
                            <TableRow key={r.id}>
                              <TableCell>
                                {r.name}
                                <small>
                                  {r.id} · {r.valuationDate}
                                </small>
                              </TableCell>
                              <TableCell>
                                {r.assetClass}
                                <small>{r.liquidity}</small>
                              </TableCell>
                              <TableCell>{money(r.value)}</TableCell>
                              <TableCell>{money(r.down)}</TableCell>
                              <TableCell>{money(r.middle)}</TableCell>
                              <TableCell>{money(r.up)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </details>
                </>
              )}
            </article>
          ))}
        </>
      )}
      <details className="pd-evidence">
        <summary>Model limits and background sources</summary>
        <p>
          The model applies hypothetical price shocks to the supplied synthetic
          holdings. It does not include dividends, interest income, FX, trading
          costs, taxes, cash flows, credit defaults, correlations or liquidity
          effects. Structured products have nonlinear payoffs and alternatives
          may have stale valuations; class-level proxies cannot price them
          accurately. Zero cash shock excludes changes in interest earned and
          purchasing power. There is no live event feed, upcoming-event
          forecast, probability estimate or backtested return model.
        </p>
        <p>
          Background mechanisms:{' '}
          <a
            href="https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins/what-are"
            target="_blank"
            rel="noreferrer"
          >
            Investor.gov on bond interest-rate sensitivity
          </a>{' '}
          ·{' '}
          <a
            href="https://www.imf.org/en/Blogs/Articles/2025/04/14/how-rising-geopolitical-risks-weigh-on-asset-prices"
            target="_blank"
            rel="noreferrer"
          >
            IMF on geopolitical risk and asset prices
          </a>
          . These sources do not support the preset shock magnitudes.
        </p>
      </details>
    </section>
  );
}
