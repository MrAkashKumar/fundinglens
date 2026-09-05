'use client';
import { PieChart, Pie, ResponsiveContainer, Tooltip } from 'recharts';
import { Wallet, Layers, Clock, CalendarDays } from 'lucide-react';
import type { ClientReview, PortfolioResult } from '@/lib/portfolio/contracts';
import { summarizePortfolios } from '@/lib/portfolio/summary';
import { number } from '@/lib/analytics';
const colors = [
  '#116e72',
  '#305bb2',
  '#9c78c1',
  '#d69b3e',
  '#74a9b1',
  '#6f859a',
];
const money = (v: number | null, currency = 'USD', compact = false) =>
  v === null
    ? 'Unavailable'
    : new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        notation: compact ? 'compact' : 'standard',
        maximumFractionDigits: 2,
      }).format(v);
export default function WealthOverview({
  client,
  portfolios,
}: {
  client: ClientReview;
  portfolios: PortfolioResult[];
}) {
  const s = summarizePortfolios(portfolios);
  const needs = client.plannedNeeds
    .filter((n) => n.due_to >= client.asOf)
    .sort((a, b) => a.due_from.localeCompare(b.due_from));
  const commitments = client.commitments.filter((c) =>
    portfolios.some((p) => p.id === c.portfolio_id),
  );
  return (
    <div className="wo">
      <div className="wo-metrics">
        <article>
          <Wallet size={18} />
          <span>Selected portfolio value</span>
          <strong title={money(s.total)}>{money(s.total, 'USD', true)}</strong>
          <small>USD equivalents · current snapshot</small>
        </article>
        <article>
          <Layers size={18} />
          <span>Investments covered</span>
          <strong>{s.holdings}</strong>
          <small>Across {portfolios.length} selected portfolio(s)</small>
        </article>
        <article>
          <Clock size={18} />
          <span>Restricted-access holdings</span>
          <strong title={money(s.restricted)}>
            {money(s.restricted, 'USD', true)}
          </strong>
          <small>Monthly, gated or illiquid · not cash</small>
        </article>
      </div>
      {!s.complete ? (
        <div className="wo-unavailable">
          Some source records are incomplete. Charts and combined values are
          withheld until the data checks are resolved.
        </div>
      ) : (
        <div className="wo-charts">
          <section>
            <p className="eyebrow">HOW WEALTH IS INVESTED</p>
            <h3>Investment mix</h3>
            <div className="wo-donut">
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie
                    data={s.assets
                      .filter((a) => a.value > 0)
                      .map((a, i) => ({
                        ...a,
                        fill: colors[i % colors.length],
                      }))}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={64}
                    outerRadius={90}
                    paddingAngle={2}
                    stroke="none"
                    isAnimationActive={false}
                  />
                  <Tooltip formatter={(v) => money(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="wo-legend">
              {s.assets.map((a, i) => (
                <div key={a.name}>
                  <span>
                    <i style={{ background: colors[i % colors.length] }} />
                    {a.name}
                  </span>
                  <strong>
                    {a.percent === null ? '—' : a.percent.toFixed(1) + '%'}
                  </strong>
                  <small>{money(a.value, 'USD', true)}</small>
                </div>
              ))}
            </div>
            <p className="wo-note">
              Descriptive mix for selected portfolios. Mandate limits are
              assessed separately for each portfolio.
            </p>
          </section>
          <section>
            <p className="eyebrow">WHEN INVESTMENTS CAN BE ACCESSED</p>
            <h3>Access profile</h3>
            <div className="wo-access">
              {s.access.map((a, i) => (
                <div key={a.name}>
                  <div>
                    <strong>{a.name}</strong>
                    <span>
                      {money(a.value, 'USD', true)} ·{' '}
                      {a.percent === null ? '—' : a.percent.toFixed(1) + '%'}
                    </span>
                  </div>
                  <div className="wo-bar" aria-hidden="true">
                    <i
                      style={{
                        width: `${a.percent || 0}%`,
                        background: colors[i % colors.length],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="wo-note">
              Daily means a dealing frequency. Settlement, foreign exchange and
              restrictions still affect when cash can be used. Unknown access
              stays separate.
            </p>
          </section>
        </div>
      )}
      <section className="wo-planning">
        <div className="wo-planning-title">
          <div>
            <p className="eyebrow">THE PERSON BEHIND THE PORTFOLIO</p>
            <h3>
              <CalendarDays size={19} /> Life events & funding needs
            </h3>
          </div>
          <span className="pd-tag">{needs.length} recorded need(s)</span>
        </div>
        <p className="wo-note">
          Client-wide payment windows, including education, retirement, property
          or tax needs where supplied. These records are not added together or
          treated as amounts due today.
        </p>
        {needs.length === 0 ? (
          <p>
            No current or future cash-needs records supplied. This does not mean
            the client has no funding needs.
          </p>
        ) : (
          <div className="wo-timeline">
            {needs.map((n) => (
              <article key={n.need_id}>
                <div className="wo-timeline-dot" />
                <div>
                  <small>
                    {n.due_from} → {n.due_to}
                  </small>
                  <h4>{n.description}</h4>
                  <p>
                    {money(number(n.amount), n.currency)}{' '}
                    <span>· {n.recurrence}</span>
                  </p>
                  <small>
                    {n.certainty} · Record {n.need_id}
                  </small>
                  <details>
                    <summary>What to confirm</summary>
                    <p>
                      Confirm the next actual amount and date, whether
                      circumstances changed, and the agreed funding source. The
                      recorded window may cover several instalments.
                    </p>
                    <p>Source: planned_cash_needs.csv · {n.need_id}</p>
                  </details>
                </div>
              </article>
            ))}
          </div>
        )}
        {commitments.length > 0 && (
          <details className="wo-commitments">
            <summary>
              {commitments.length} private-market commitment record(s) · View
              separately
            </summary>
            {commitments.map((c) => (
              <article key={c.commitment_id}>
                <strong>{c.fund_name}</strong>
                <p>
                  {money(number(c.uncalled), c.currency)} uncalled ·{' '}
                  {c.expected_call_window}
                </p>
                <small>
                  commitments.csv · {c.commitment_id} · {c.portfolio_id}
                </small>
              </article>
            ))}
            <p className="wo-note">
              May overlap the payment records above. No combined obligation
              total is calculated.
            </p>
          </details>
        )}
      </section>
    </div>
  );
}
