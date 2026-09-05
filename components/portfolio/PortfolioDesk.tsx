'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ScanLine, Search, ArrowRight, ShieldCheck, Files } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import type { PortfolioBook, Finding } from '@/lib/portfolio/contracts';
import AlertComposer from './AlertComposer';
import WealthOverview from './WealthOverview';
import IntelligencePanel from './IntelligencePanel';
import ProjectionExplorer from './ProjectionExplorer';
import PortfolioSimulator from './PortfolioSimulator';
import ConversationBrief from './ConversationBrief';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Sparkles, Activity, FileText } from 'lucide-react';
import ScenarioPlanner from './ScenarioPlanner';
const money = (v: number | null) =>
  v === null
    ? 'Not assessed'
    : new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 2,
      }).format(v);
export default function PortfolioDesk({ book }: { book: PortfolioBook }) {
  const [query, setQuery] = useState('');
  const [clientId, setClientId] = useState(
    book.clients.find((c) => c.id === 'CL-0003')?.id || book.clients[0]?.id,
  );
  const [portfolioId, setPortfolioId] = useState('all');
  const [tab, setTab] = useState<
    'overview' | 'findings' | 'holdings' | 'scenario' | 'intelligence' | 'brief'
  >('intelligence');
  const [selected, setSelected] = useState<Finding | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const clients = useMemo(
    () =>
      book.clients.filter((c) =>
        (c.name + ' ' + c.id).toLowerCase().includes(query.toLowerCase()),
      ),
    [book, query],
  );
  const client = book.clients.find((c) => c.id === clientId)!;
  if (!client) return <main>No client records available.</main>;
  const portfolios = client.portfolios.filter(
    (p) => portfolioId === 'all' || p.id === portfolioId,
  );
  const findings = portfolios.flatMap((p) => p.findings);
  const holdings = portfolios.flatMap((p) => p.positions);
  const clientPoints = findings.filter(
    (f) => f.audience === 'client_review',
  ).length;
  const internal = findings.filter((f) => f.audience === 'internal').length;
  const allFindings = book.clients.reduce((n, c) => n + c.findings.length, 0);
  const selectedPortfolio = client.portfolios.find(
    (p) => p.id === selected?.portfolioId,
  );
  const sourceBlocked = selectedPortfolio?.findings.some(
    (f) =>
      f.category === 'Data quality' && f.title !== 'Duplicate records removed',
  );
  return (
    <div className="pd-app">
      <header className="pd-header">
        <Link href="/" className="pd-brand">
          <ScanLine />
          FundingLens<span>PORTFOLIO REVIEW</span>
        </Link>
        <div>
          <span className="pd-demo">Synthetic data · {book.asOf}</span>
          <Link href="/funding-review">
            Funding & communication desk <ArrowRight size={15} />
          </Link>
        </div>
      </header>
      <main className="pd-main">
        <div className="pd-intro">
          <div>
            <p className="eyebrow">
              PRIVATE WEALTH · RELATIONSHIP MANAGER WORKSPACE
            </p>
            <h1>A clearer view of every client.</h1>
            <p>
              Review investments, check exceptions, and prepare an
              evidence-backed client alert.
            </p>
          </div>
          <Button variant="outline" onClick={() => setRulesOpen(true)}>
            <ShieldCheck />
            How checks work
          </Button>
        </div>
        <div className="pd-metrics">
          <div>
            <strong>{book.coverage.clients}</strong>
            <span>Clients in the supplied book</span>
          </div>
          <div>
            <strong>{book.coverage.portfolios}</strong>
            <span>Portfolios covered</span>
          </div>
          <div>
            <strong>{book.coverage.currentHoldings}</strong>
            <span>Current holding records displayed</span>
          </div>
          <div>
            <strong>{allFindings}</strong>
            <span>Findings to review</span>
          </div>
        </div>
        <div className="pd-workspace">
          <aside className="pd-client-list">
            <label htmlFor="pd-search">
              <Search size={16} /> Find a client
            </label>
            <Input
              id="pd-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name or client ID"
            />
            <p className="muted text-sm">
              {clients.length} clients · Select to review
            </p>
            <div className="pd-client-scroll">
              {clients.map((c) => (
                <button
                  key={c.id}
                  className={
                    c.id === client.id ? 'pd-client active' : 'pd-client'
                  }
                  aria-pressed={c.id === client.id}
                  onClick={() => {
                    setClientId(c.id);
                    setPortfolioId('all');
                    setSelected(null);
                  }}
                >
                  <strong>{c.name}</strong>
                  <span>
                    {c.id} · {c.portfolios.length} portfolio(s)
                  </span>
                  <small>
                    {c.findings.length
                      ? `${c.findings.length} review finding(s)`
                      : 'No exceptions found by current rules'}
                  </small>
                </button>
              ))}
              {clients.length === 0 && <p>No clients match this search.</p>}
            </div>
          </aside>
          <section className="pd-client-detail">
            <div className="pd-client-heading">
              <div>
                <p className="eyebrow">
                  {client.id} · {client.risk}
                </p>
                <h2>{client.name}</h2>
                <p className="muted">
                  RM: {client.rm} · Reporting currency: {client.currency}
                </p>
              </div>
              <div className="pd-value">
                <small>All client portfolios · USD</small>
                <strong>{money(client.total)}</strong>
              </div>
            </div>
            <div className="pd-objective">
              <strong>Client objective</strong>
              <p>{client.objective}</p>
            </div>
            <div className="pd-controls">
              <Select
                value={portfolioId}
                onValueChange={(v) => {
                  if (v) setPortfolioId(v);
                }}
              >
                <SelectTrigger aria-label="Portfolio filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All client portfolios</SelectItem>
                  {client.portfolios.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.id} · {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="pd-tabs in-main-tabs">
                <Button
                  variant={tab === 'intelligence' ? 'default' : 'ghost'}
                  aria-pressed={tab === 'intelligence'}
                  onClick={() => setTab('intelligence')}
                >
                  <Sparkles size={17} /> Intelligence
                </Button>
                <Button
                  variant={tab === 'scenario' ? 'default' : 'ghost'}
                  aria-pressed={tab === 'scenario'}
                  onClick={() => setTab('scenario')}
                >
                  <Activity size={17} /> Scenario explorer
                </Button>
                <Button
                  variant={tab === 'brief' ? 'default' : 'ghost'}
                  aria-pressed={tab === 'brief'}
                  onClick={() => setTab('brief')}
                >
                  <FileText size={17} /> Conversation brief
                </Button>
                <Button
                  variant={tab === 'overview' ? 'default' : 'ghost'}
                  aria-pressed={tab === 'overview'}
                  onClick={() => setTab('overview')}
                >
                  Overview
                </Button>
                <Button
                  variant={tab === 'findings' ? 'default' : 'ghost'}
                  aria-pressed={tab === 'findings'}
                  onClick={() => setTab('findings')}
                >
                  Review findings ({findings.length})
                </Button>
                <Button
                  variant={tab === 'holdings' ? 'default' : 'ghost'}
                  aria-pressed={tab === 'holdings'}
                  onClick={() => setTab('holdings')}
                >
                  Investments ({holdings.length})
                </Button>
              </div>
            </div>
            <div className="pd-scope">
              {portfolios.map((p) => (
                <span key={p.id}>
                  {p.id} · {p.service} · {p.mandate}
                  {p.service === 'Custody'
                    ? ' · Mandate checks not applied'
                    : ''}
                </span>
              ))}
            </div>
            {tab === 'overview' && (
              <WealthOverview client={client} portfolios={portfolios} />
            )}
            {tab === 'intelligence' ? (
              <IntelligencePanel
                key={client.id + portfolioId}
                client={client}
                portfolios={portfolios}
                onEvidence={setSelected}
                onBrief={() => setTab('brief')}
                onScenario={() => setTab('scenario')}
              />
            ) : tab === 'brief' ? (
              <ConversationBrief
                key={client.id + portfolioId}
                client={client}
                portfolios={portfolios}
                onEvidence={setSelected}
              />
            ) : tab === 'scenario' ? (
              <Tabs
                key={client.id + portfolioId}
                defaultValue="sale"
                className="in-explorer-tabs"
              >
                <TabsList variant="line">
                  <TabsTrigger value="sale">Goal & sale scenarios</TabsTrigger>
                  <TabsTrigger value="simulator">
                    Portfolio simulator
                  </TabsTrigger>
                  <TabsTrigger value="projection">
                    Wealth projections
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="sale">
                  <ScenarioPlanner
                    key={client.id + portfolioId}
                    client={client}
                    portfolios={portfolios}
                  />
                </TabsContent>
                <TabsContent value="simulator">
                  <PortfolioSimulator
                    portfolios={portfolios}
                    asOf={client.asOf}
                  />
                </TabsContent>
                <TabsContent value="projection">
                  <ProjectionExplorer
                    portfolios={portfolios}
                    asOf={client.asOf}
                  />
                </TabsContent>
              </Tabs>
            ) : tab !== 'holdings' ? (
              <>
                <p className="pd-counts">
                  {clientPoints} client discussion point(s) · {internal}{' '}
                  internal check(s). Findings are review candidates, not
                  recommendations to trade.
                </p>
                <div className="wo-review-heading">
                  <h3>
                    {tab === 'overview'
                      ? 'Start the review here'
                      : 'All review findings'}
                  </h3>
                  {tab === 'overview' && findings.length > 3 && (
                    <Button variant="link" onClick={() => setTab('findings')}>
                      View all {findings.length} findings{' '}
                      <ArrowRight size={15} />
                    </Button>
                  )}
                </div>
                <div className="pd-findings">
                  {(tab === 'overview' ? findings.slice(0, 3) : findings).map(
                    (f) => (
                      <article key={f.id}>
                        <div className="pd-finding-top">
                          <span
                            className={
                              'pd-tag ' +
                              (f.audience === 'internal' ? 'internal' : '')
                            }
                          >
                            {f.category}
                          </span>
                          <small>
                            {f.portfolioId} ·{' '}
                            {f.audience === 'internal'
                              ? 'Internal check'
                              : 'RM review before client contact'}
                          </small>
                        </div>
                        <h3>{f.title}</h3>
                        <p>{f.detail}</p>
                        <Button variant="link" onClick={() => setSelected(f)}>
                          Inspect evidence & next step <ArrowRight size={16} />
                        </Button>
                      </article>
                    ),
                  )}
                  {!findings.length && (
                    <article>
                      <h3>No exceptions identified by these rules</h3>
                      <p>
                        This does not establish suitability, complete risk
                        coverage or a guarantee of investment performance.
                        Review the holdings and client context.
                      </p>
                    </article>
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="pd-counts">
                  Weights are within each portfolio. Values are USD equivalents;
                  investment currency is shown separately.
                </p>
                <div className="pd-table-wrap">
                  <Table>
                    <TableCaption>
                      All supplied current holdings for the selected portfolios
                    </TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Investment</TableHead>
                        <TableHead>Portfolio / asset class</TableHead>
                        <TableHead>Value (USD)</TableHead>
                        <TableHead>Weight</TableHead>
                        <TableHead>Access</TableHead>
                        <TableHead>Valuation date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {holdings.map((p) => (
                        <TableRow key={p.portfolioId + p.id}>
                          <TableCell>
                            <strong>{p.name}</strong>
                            <small>
                              {p.id} · {p.currency}
                            </small>
                          </TableCell>
                          <TableCell>
                            {p.portfolioId}
                            <small>{p.assetClass}</small>
                          </TableCell>
                          <TableCell>{money(p.value)}</TableCell>
                          <TableCell>
                            {p.weight === null
                              ? 'Not assessed'
                              : p.weight.toFixed(2) + '%'}
                          </TableCell>
                          <TableCell>{p.liquidity}</TableCell>
                          <TableCell>{p.valuationDate || 'Unknown'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
            <p className="pd-coverage-note">
              Coverage is limited to the supplied records as of {book.asOf}.
              External accounts and newer transactions are not included. Daily
              dealing does not mean immediately withdrawable cash.
            </p>
          </section>
        </div>
      </main>
      <Sheet
        open={Boolean(selected)}
        onOpenChange={(v) => {
          if (!v) setSelected(null);
        }}
      >
        <SheetContent className="pd-sheet w-full sm:max-w-3xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selected?.title}</SheetTitle>
            <SheetDescription>
              {client.name} · {selected?.portfolioId} · Source snapshot{' '}
              {book.asOf}
            </SheetDescription>
          </SheetHeader>
          {selected && (
            <div className="pd-sheet-body">
              <span className="pd-tag">{selected.category}</span>
              <h3>What the records show</h3>
              <p>{selected.detail}</p>
              <h3>What this means</h3>
              <p>{selected.reason}</p>
              <h3>RM next step</h3>
              <p>{selected.nextStep}</p>
              <details className="pd-evidence">
                <summary>
                  <Files size={16} /> Inspect {selected.evidence.length}{' '}
                  supporting records
                </summary>
                {selected.evidence.map((e, i) => (
                  <details key={e.id + i}>
                    <summary>
                      {e.label} · {e.id}
                    </summary>
                    <dl>
                      {Object.entries(e.fields).map(([k, v]) => (
                        <div key={k}>
                          <dt>{k.replaceAll('_', ' ')}</dt>
                          <dd>{v || 'Not supplied'}</dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                ))}
              </details>
              <small className="muted">
                Analysis rule: {selected.ruleId}. Amounts and exceptions are
                calculated in code.
              </small>
              {selected.audience === 'client_review' && !sourceBlocked ? (
                <AlertComposer
                  key={client.id + selected.id}
                  client={client}
                  finding={selected}
                />
              ) : (
                <div className="pd-internal">
                  <ShieldCheck />
                  <p>
                    Resolve the internal source checks for this portfolio before
                    preparing a client alert. A data-quality finding is not an
                    established investment problem.
                  </p>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
      <Sheet open={rulesOpen} onOpenChange={setRulesOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Transparent portfolio checks</SheetTitle>
            <SheetDescription>
              Deterministic rules applied to the supplied snapshot. These checks
              are not exhaustive investment advice.
            </SheetDescription>
          </SheetHeader>
          <div className="pd-sheet-body">
            {book.ruleDescriptions.map((r) => (
              <article key={r.id}>
                <h3>{r.id}</h3>
                <p>{r.description}</p>
              </article>
            ))}
            <h3>Source quality first</h3>
            <p>
              Missing holdings, invalid values, conflicting duplicates or
              ownership/classification mismatches block percentage analysis.
              Exact duplicates are removed. Client totals are unavailable when a
              portfolio is incomplete.
            </p>
            <h3>Human review before communication</h3>
            <p>
              Client alerts are editable drafts. An RM must check the evidence,
              recipient and wording before copying them. No message is sent
              automatically.
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
