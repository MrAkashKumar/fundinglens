'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  CircleHelp,
  Files,
  Flag,
  History,
  Layers,
  LoaderCircle,
  ScanLine,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import {
  Sidebar,
  SidebarProvider,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
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
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  canPreview,
  draftText,
  editRevision,
  reviewRevision,
  revisionSchema,
  statements,
} from '@/lib/briefing';
import Communications from '@/components/Communications';
import QuickIntake from '@/components/QuickIntake';
import BatchReview from '@/components/BatchReview';
import type { Briefing, Review, Revision } from '@/lib/types';
const MENU = [
  { id: 'CL-0006', name: 'Tran', issue: 'USD funding & restrictions' },
  { id: 'CL-0003', name: 'Margarethe', issue: 'Inherited portfolio & payment' },
  { id: 'CL-0012', name: 'Cheung', issue: 'Retirement spending differs' },
];
const money = (value: number, currency = 'USD', compact = false) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 2 : 2,
  }).format(value);
const date = (d: string) =>
  new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
const fallbackLabels: Record<string, string> = {
  rm_intake: 'Prepared from source records and RM-checked note fields',
  api_not_configured: 'Template · AI is not configured',
  authentication_failed: 'Template · API authentication failed',
  rate_limited: 'Template · AI rate limit reached',
  timeout: 'Template · AI request timed out',
  invalid_output: 'Template · AI output did not pass validation',
  provider_unavailable: 'Template · AI unavailable',
  incomplete_or_refused: 'Template · AI response incomplete',
  invalid_provider_configuration:
    'Template · API configuration needs attention',
};
type HistoryEntry = { action: string; at: string; revision: number };
function CaseMenu({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (id: string) => void;
}) {
  const { setOpenMobile } = useSidebar();
  return (
    <SidebarMenu>
      {MENU.map((c, i) => (
        <SidebarMenuItem key={c.id}>
          <SidebarMenuButton
            className="client-button"
            isActive={selected === c.id}
            aria-label={`Open ${c.name} review`}
            onClick={() => {
              setOpenMobile(false);
              onSelect(c.id);
            }}
          >
            <span className="client-number">0{i + 1}</span>
            <span>
              <strong>{c.name}</strong>
              <small>{c.issue}</small>
            </span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}
export default function FundingDesk({
  initialReview,
}: {
  initialReview: Review;
}) {
  const [review, setReview] = useState(initialReview),
    [stage, setStage] = useState<'facts' | 'editor' | 'preview'>('facts');
  const [revision, setRevision] = useState<Revision | null>(null),
    [log, setLog] = useState<HistoryEntry[]>([]),
    [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false),
    [drafting, setDrafting] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const [sourceIds, setSourceIds] = useState<string[] | null>(null),
    [sourcesOpen, setSourcesOpen] = useState(false),
    [historyOpen, setHistoryOpen] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const requestId = useRef(0),
    abort = useRef<AbortController | null>(null),
    currentReview = useRef(review);
  useEffect(() => {
    currentReview.current = review;
  }, [review]);
  const openSources = (ids?: string[]) => {
    setSourceIds(ids || null);
    setSourcesOpen(true);
  };
  // Restore browser-only persisted review state after source selection changes.
  /* oxlint-disable react/react-compiler -- Synchronize saved browser state with the selected source version. */
  useEffect(() => {
    setConfirmed(false);
    setStage('facts');
    setRevision(null);
    setLog([]);
    try {
      const raw = localStorage.getItem('fundinglens:' + review.clientId);
      if (raw) {
        const saved = JSON.parse(raw);
        const r = revisionSchema.safeParse(saved.revision);
        if (Array.isArray(saved.log))
          setLog(
            saved.log
              .filter(
                (e: HistoryEntry) =>
                  typeof e.action === 'string' &&
                  typeof e.at === 'string' &&
                  Number.isFinite(e.revision),
              )
              .slice(-50),
          );
        if (
          r.success &&
          r.data.inputVersion === review.inputVersion &&
          r.data.clientId === review.clientId
        ) {
          setRevision(r.data);
          setMessage('Saved draft restored for these source inputs.');
        } else if (r.success)
          setMessage(
            'Source selection changed. Previous review is no longer current.',
          );
      }
    } catch {
      setMessage(
        'History is unavailable; this review will continue in memory.',
      );
    }
  }, [review.clientId, review.inputVersion]);
  /* oxlint-enable react/react-compiler */
  useEffect(
    () => () => {
      abort.current?.abort();
    },
    [],
  );
  function save(next: Revision, action: string) {
    setRevision(next);
    const entries = [
      ...log,
      { action, at: new Date().toISOString(), revision: next.revision },
    ].slice(-50);
    setLog(entries);
    try {
      localStorage.setItem(
        'fundinglens:' + review.clientId,
        JSON.stringify({ revision: next, log: entries }),
      );
    } catch {
      setMessage('History will not persist; local storage is unavailable.');
    }
  }
  const loadCase = useCallback(async (id: string, start?: string) => {
    const seq = ++requestId.current;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setLoading(true);
    setDrafting(false);
    setError('');
    setMessage('');
    setSourcesOpen(false);
    setHistoryOpen(false);
    setStage('facts');
    setConfirmed(false);
    try {
      const res = await fetch(
        `/api/reviews/${encodeURIComponent(id)}${start ? '?start=' + encodeURIComponent(start) : ''}`,
        { signal: controller.signal },
      );
      const body = (await res.json()) as Review & Briefing & { error?: string };
      if (!res.ok) throw new Error(body.error || 'Unable to load the case.');
      if (seq !== requestId.current) return;
      setReview(body);
      setHistoryExpanded(false);
    } catch (e) {
      if (
        seq === requestId.current &&
        !(e instanceof Error && e.name === 'AbortError')
      )
        setError(e instanceof Error ? e.message : 'Unable to load this case.');
    } finally {
      if (seq === requestId.current) setLoading(false);
    }
  }, []);
  async function generate() {
    const seq = ++requestId.current;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setDrafting(true);
    setError('');
    setConfirmed(false);
    setMessage('Preparing an evidence-backed draft…');
    const timeout = setTimeout(() => controller.abort(), 23000);
    try {
      const res = await fetch('/api/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: review.clientId,
          comparisonStart: review.comparisonStart,
          comparisonEnd: review.comparisonEnd,
          inputVersion: review.inputVersion,
        }),
        signal: controller.signal,
      });
      const body = (await res.json()) as Review & Briefing & { error?: string };
      if (!res.ok) throw new Error(body.error || 'Unable to prepare a draft.');
      const b = body as Briefing;
      if (
        seq !== requestId.current ||
        b.clientId !== currentReview.current.clientId ||
        b.inputVersion !== currentReview.current.inputVersion
      )
        return;
      const next: Revision = {
        id: crypto.randomUUID(),
        clientId: review.clientId,
        inputVersion: review.inputVersion,
        revision: (revision?.revision || 0) + 1,
        text: draftText(b.content),
        mode: b.mode,
        fallbackReason: b.fallbackReason,
        status: 'draft',
        updatedAt: new Date().toISOString(),
        evidenceIds: [
          ...new Set(statements(b.content).flatMap((s) => s.evidenceIds)),
        ],
      };
      save(next, 'Draft created');
      setStage('editor');
      setMessage(
        b.mode === 'live_ai'
          ? 'AI draft ready for your review.'
          : 'Evidence-based template ready. ' +
              (fallbackLabels[b.fallbackReason || ''] ||
                'Live AI unavailable.'),
      );
    } catch (e) {
      if (seq === requestId.current) {
        setError(
          e instanceof Error && e.name === 'AbortError'
            ? 'The request took too long. Please retry; your case facts are still available.'
            : e instanceof Error
              ? e.message
              : 'Drafting failed.',
        );
        setMessage('');
      }
    } finally {
      clearTimeout(timeout);
      if (seq === requestId.current) setDrafting(false);
    }
  }
  function prepareIntake(text: string, evidenceIds: string[]) {
    abort.current?.abort();
    requestId.current++;
    setDrafting(false);
    save(
      {
        id: crypto.randomUUID(),
        clientId: review.clientId,
        inputVersion: review.inputVersion,
        revision: (revision?.revision || 0) + 1,
        text,
        mode: 'template_fallback',
        fallbackReason: 'rm_intake',
        status: 'draft',
        updatedAt: new Date().toISOString(),
        evidenceIds,
      },
      'Client draft prepared from RM-checked intake',
    );
    setConfirmed(false);
    setStage('editor');
    setMessage(
      'Draft prepared from source records and RM-checked details. Review the full message before sharing.',
    );
  }
  function approve() {
    if (!revision || !confirmed) return;
    try {
      save(
        reviewRevision(revision, review.inputVersion),
        'Reviewed by Priscilla Ong',
      );
      setStage('preview');
      setMessage('This version is reviewed. No message has been sent.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Review failed.');
    }
  }
  function reject() {
    if (!revision) return;
    save(
      {
        ...revision,
        status: 'rejected',
        reviewedAt: undefined,
        updatedAt: new Date().toISOString(),
      },
      'Draft rejected',
    );
    setConfirmed(false);
    setStage('facts');
    setMessage('Draft rejected. You can prepare a new version.');
  }
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: { signal: AbortSignal },
          ) => unknown;
        };
      }
    ).modelContext;
    if (!context) return;
    const lifecycle = new AbortController();
    try {
      Promise.resolve(
        context.registerTool(
          {
            name: 'open_funding_review',
            title: 'Open a FundingLens client review',
            description:
              'Select one of the three curated client reviews. Does not draft, approve, send, or change financial records.',
            inputSchema: {
              type: 'object',
              properties: {
                clientId: { type: 'string', enum: MENU.map((c) => c.id) },
              },
              required: ['clientId'],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false },
            execute: async (input: unknown) => {
              const id = (input as { clientId?: string })?.clientId;
              if (!MENU.some((c) => c.id === id))
                throw new Error('Unknown client review');
              await loadCase(id!);
              await new Promise((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(resolve)),
              );
              if (currentReview.current.clientId !== id)
                throw new Error('The requested review did not load');
              return {
                clientId: currentReview.current.clientId,
                title: currentReview.current.title,
              };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {
      /* Optional browser capability. */
    }
    return () => lifecycle.abort();
  }, [loadCase]);
  const busy = loading || drafting;
  const fact = (id: string) => review.facts.find((f) => f.id === id);
  const equity = review.allocation.find((a) => a.assetClass === 'Equity');
  const sourceList = sourceIds
    ? review.evidence.filter((s) => sourceIds.includes(s.id))
    : review.evidence.filter(
        (s) => s.file !== 'holdings.csv' || s.date === review.asOf,
      );
  const displayedStep = stage === 'facts' ? 1 : stage === 'editor' ? 2 : 3;
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="brand">
            <ScanLine />
            FundingLens
          </div>
          <p className="rail-subtitle">CLIENT FUNDING REVIEW</p>
        </SidebarHeader>
        <SidebarContent>
          <div className="rail-label">3 client reviews</div>
          <CaseMenu selected={review.clientId} onSelect={loadCase} />
          <div className="rail-footer">
            <ShieldCheck size={18} />
            <p>
              Synthetic challenge data
              <br />
              As of {date(review.asOf)}
              <br />
              <span>Curated demo · Local review</span>
            </p>
          </div>
        </SidebarContent>
      </Sidebar>
      <main className="workspace">
        <header className="topbar">
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <Link href="/">← Portfolio review desk</Link>
          </div>
          <div className="identity">
            <span>
              Priscilla Ong<small>Asia desk</small>
            </span>
            <b>PO</b>
          </div>
        </header>
        <div className="content-wrap" aria-busy={busy}>
          <div className="steps">
            {['Check facts', 'Review draft', 'Client preview'].map(
              (step, i) => (
                <span
                  key={step}
                  className={displayedStep === i + 1 ? 'active' : ''}
                  aria-current={displayedStep === i + 1 ? 'step' : undefined}
                >
                  <b>{i + 1 < displayedStep ? <Check size={13} /> : i + 1}</b>
                  {step}
                </span>
              ),
            )}
          </div>
          {error && (
            <div className="error-banner" role="alert">
              {error}
              <Button
                variant="ghost"
                onClick={() =>
                  loadCase(review.clientId, review.comparisonStart)
                }
              >
                Reload case
              </Button>
            </div>
          )}
          {stage === 'facts' && (
            <>
              <div className="page-title title-row">
                <div>
                  <p className="eyebrow">
                    {review.clientId} · {review.client.portfolioId} ·{' '}
                    {review.client.risk}
                  </p>
                  <h1>{review.title}</h1>
                  <p className="muted">{review.client.name}</p>
                </div>
                <span className="status-pill">
                  <CircleHelp size={14} />
                  {review.status}
                </span>
              </div>
              <BatchReview onSelect={loadCase} />
              <QuickIntake
                key={review.inputVersion}
                review={review}
                onDraft={prepareIntake}
                onSources={openSources}
              />
              <section className="surface">
                <div className="goal">
                  <Flag size={19} />
                  <div>
                    <span className="eyebrow">Client’s goal</span>
                    <p>{review.client.goal}</p>
                    <small className="muted">
                      Recorded reporting language: {review.client.language} ·
                      English prototype
                    </small>
                  </div>
                </div>
                <p className="eyebrow">What needs checking</p>
                <h2>{review.question}</h2>
                {review.type === 'funding' && (
                  <div className="fact-columns">
                    <div>
                      <h3>
                        <CalendarDays />
                        Upcoming obligations
                      </h3>
                      {review.obligations.map((o) => (
                        <article key={o.id}>
                          <div className="record-heading">
                            <strong>
                              {o.id === 'CN-007'
                                ? 'University fees'
                                : 'Private equity calls'}
                            </strong>
                            <span className="amount">
                              {o.id === 'CN-007'
                                ? 'USD'
                                : money(o.amount!, o.currency, true)}
                            </span>
                          </div>
                          <p>
                            {date(o.from)}–{date(o.to)}
                          </p>
                          <p>
                            {o.recurrence} · {o.certainty}
                          </p>
                          <small>
                            {o.id === 'CN-007'
                              ? 'Next instalment amount needs confirmation'
                              : o.note}
                          </small>
                          <Button
                            variant="link"
                            className="source-link"
                            onClick={() => openSources(o.sourceIds)}
                          >
                            {o.id === 'CN-007'
                              ? 'View the multi-year record'
                              : 'View linked records'}{' '}
                            <ArrowRight size={12} />
                          </Button>
                        </article>
                      ))}
                      <article>
                        <strong>Redemption requested</strong>
                        <p>
                          Request recorded 12 May 2026 · Future September
                          estimate
                        </p>
                        <small>
                          Proceeds unconfirmed; request amount is zero
                        </small>
                        <Button
                          variant="link"
                          className="source-link"
                          onClick={() =>
                            openSources(['transactions.csv:TXN-0008'])
                          }
                        >
                          Check redemption record <ArrowRight size={12} />
                        </Button>
                      </article>
                    </div>
                    <div>
                      <h3>
                        <Layers />
                        Investment access
                      </h3>
                      {review.liquidity.map((g) => (
                        <article className="liquidity-row" key={g.tier}>
                          <div className="record-heading">
                            <strong>{g.tier}</strong>
                            <span className="amount">
                              {money(g.value, 'USD', true)}
                            </span>
                          </div>
                          <p>
                            {g.tier === 'Daily'
                              ? 'Dealing category; settlement, FX and encumbrances still matter'
                              : g.holdings.map((h) => h.name).join(', ')}
                          </p>
                          {g.tier === 'Monthly' && (
                            <small>
                              Cash-classified deposit; access restrictions apply
                            </small>
                          )}
                          <Button
                            variant="link"
                            className="source-link"
                            onClick={() =>
                              openSources(g.holdings.map((h) => h.sourceId))
                            }
                          >
                            {g.holdings.length} holding
                            {g.holdings.length > 1 ? 's' : ''} · view sources
                          </Button>
                        </article>
                      ))}
                      <p className="micro muted">
                        USD equivalents · {date(review.asOf)} · Rounded display
                      </p>
                    </div>
                  </div>
                )}
                {review.type === 'inheritance' && (
                  <div className="fact-columns">
                    <div>
                      <h3>
                        <Layers />
                        Equity allocation
                      </h3>
                      <div className="comparison-box">
                        <span className="muted text-sm">
                          Current equity weight
                        </span>
                        <div className="big-number">
                          {fact('equity-weight')?.value.toFixed(2)}
                          <span>%</span>
                        </div>
                        <div className="allocation-track" aria-hidden="true">
                          <i
                            style={{
                              width: `${Math.min(100, equity?.weight || 0)}%`,
                            }}
                          />
                        </div>
                        <span className="muted text-sm block mt-5">
                          Supplied mandate maximum
                        </span>
                        <div className="big-number secondary-number">
                          {fact('equity-max')?.value}
                          <span>%</span>
                        </div>
                        <div className="allocation-track">
                          <i
                            className="limit"
                            style={{
                              width: `${Math.min(100, equity?.max || 0)}%`,
                            }}
                          />
                        </div>
                        <p className="mt-4 text-sm">
                          {fact('equity-excess')?.value.toFixed(2)} percentage
                          points above maximum
                        </p>
                        <Button
                          className="source-link"
                          variant="link"
                          onClick={() => openSources(equity?.sourceIds)}
                        >
                          Check allocation calculation <ArrowRight />
                        </Button>
                      </div>
                    </div>
                    <div>
                      <h3>
                        <CalendarDays />
                        Upcoming payment
                      </h3>
                      {review.obligations.map((o) => (
                        <article key={o.id}>
                          <p>
                            {date(o.from)}–{date(o.to)}
                          </p>
                          <div className="big-number payment-number">
                            {money(o.amount!, o.currency, true)}
                          </div>
                          <p>{o.description}</p>
                          <small>
                            Supplied record; funding arrangements need
                            confirmation
                          </small>
                          <Button
                            variant="link"
                            className="source-link"
                            onClick={() => openSources(o.sourceIds)}
                          >
                            View payment record <ArrowRight />
                          </Button>
                        </article>
                      ))}
                      <article>
                        <strong>Conservative preference</strong>
                        <p>
                          Discuss the inherited holdings patiently and confirm
                          the client’s priorities before changes.
                        </p>
                        <Button
                          variant="link"
                          className="source-link"
                          onClick={() =>
                            openSources(
                              review.evidence
                                .filter((s) => s.file === 'rm_notes.json')
                                .map((s) => s.id),
                            )
                          }
                        >
                          Read attributed RM notes <ArrowRight />
                        </Button>
                      </article>
                    </div>
                  </div>
                )}
                {review.type === 'retirement' && (
                  <>
                    <div className="spending-grid">
                      {['stated-spending', 'planned-spending'].map((id) => {
                        const f = fact(id)!;
                        return (
                          <div className="comparison-box" key={id}>
                            <p className="eyebrow">{f.label}</p>
                            <div className="big-number">
                              {money(f.value, 'USD', true)}
                            </div>
                            <p className="muted text-sm">USD per year</p>
                            <Button
                              variant="link"
                              className="source-link"
                              onClick={() => openSources(f.sources)}
                            >
                              Check this record <ArrowRight />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                    <div className="reconcile">
                      <span className="reconcile-icon">
                        <Files size={21} />
                      </span>
                      <div>
                        <strong>
                          {money(fact('spending-difference')!.value)} / year to
                          reconcile
                        </strong>
                        <p>
                          Confirm the current requirement before preparing a
                          withdrawal discussion.
                        </p>
                      </div>
                    </div>
                  </>
                )}
                <div className="notice">
                  <CircleHelp size={18} />
                  <div>
                    {review.unknowns.map((u) => (
                      <p key={u}>{u}</p>
                    ))}
                  </div>
                </div>
                {review.warnings.length > 0 && (
                  <details className="data-warnings">
                    <summary>
                      {review.warnings.length} source-data note
                      {review.warnings.length > 1 ? 's' : ''}
                    </summary>
                    <ul>
                      {review.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </details>
                )}
                <div className="action-row">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="ghost" onClick={() => openSources()}>
                      <Files />
                      View source records
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setHistoryOpen(true)}
                    >
                      <History />
                      Review history
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {revision && revision.status !== 'rejected' && (
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => {
                          setStage(
                            canPreview(revision, review) ? 'preview' : 'editor',
                          );
                          setConfirmed(false);
                        }}
                      >
                        {canPreview(revision, review)
                          ? 'Open reviewed preview'
                          : 'Resume draft'}
                      </Button>
                    )}
                    <Button disabled={busy} onClick={generate}>
                      {drafting ? (
                        <LoaderCircle className="animate-spin" />
                      ) : (
                        <Sparkles />
                      )}
                      {drafting ? 'Preparing draft…' : review.action}
                      <ArrowRight />
                    </Button>
                  </div>
                </div>
              </section>
              <Communications
                key={review.inputVersion}
                review={review}
                onSources={openSources}
              />
              <section className="history-panel">
                <div className="history-heading">
                  <div>
                    <p className="eyebrow">Portfolio context</p>
                    <h2>What changed over time?</h2>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => setHistoryExpanded(!historyExpanded)}
                    aria-expanded={historyExpanded}
                  >
                    {historyExpanded ? 'Hide history' : 'Explore history'}
                    <ChevronDown
                      className={historyExpanded ? 'rotate-180' : ''}
                    />
                  </Button>
                </div>
                {historyExpanded && (
                  <div className="history-content">
                    <div className="history-controls">
                      <div>
                        <span className="muted text-sm">Compare from</span>
                        <Select
                          value={review.comparisonStart}
                          onValueChange={(v) => {
                            if (v) void loadCase(review.clientId, v);
                          }}
                        >
                          <SelectTrigger aria-label="Comparison start date">
                            <SelectValue>
                              {date(review.comparisonStart)}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {review.history.map((h) => (
                              <SelectItem key={h.date} value={h.date}>
                                {date(h.date)}
                                {h.preInception ? ' · Pre-onboarding' : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <span className="muted text-sm">
                          To current snapshot
                        </span>
                        <strong>{date(review.asOf)}</strong>
                      </div>
                      <div>
                        <span className="muted text-sm">
                          Portfolio value change
                        </span>
                        <strong>
                          {review.change.absolute === null
                            ? 'Unavailable'
                            : money(review.change.absolute, 'USD', true)}{' '}
                          <small>
                            (
                            {review.change.percent === null
                              ? 'unavailable'
                              : `${review.change.percent >= 0 ? '+' : ''}${review.change.percent.toFixed(2)}%`}
                            )
                          </small>
                        </strong>
                      </div>
                    </div>
                    <section
                      className="value-chart"
                      aria-label="Portfolio values in US dollars across five snapshots"
                    >
                      <ResponsiveContainer width="100%" height={220}>
                        <AreaChart
                          data={review.history}
                          margin={{ top: 10, right: 18, left: 0, bottom: 5 }}
                        >
                          <defs>
                            <linearGradient
                              id="valueFill"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="0%"
                                stopColor="var(--primary)"
                                stopOpacity={0.22}
                              />
                              <stop
                                offset="100%"
                                stopColor="var(--primary)"
                                stopOpacity={0.01}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            vertical={false}
                            stroke="var(--border)"
                          />
                          <XAxis
                            dataKey="date"
                            tickFormatter={(d) =>
                              new Date(d + 'T00:00:00Z').toLocaleDateString(
                                'en-GB',
                                {
                                  month: 'short',
                                  day: 'numeric',
                                  timeZone: 'UTC',
                                },
                              )
                            }
                            tick={{
                              fontSize: 12,
                              fill: 'var(--muted-foreground)',
                            }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            width={64}
                            tickFormatter={(n) =>
                              `${(Number(n) / 1e6).toFixed(0)}m`
                            }
                            tick={{
                              fontSize: 12,
                              fill: 'var(--muted-foreground)',
                            }}
                            axisLine={false}
                            tickLine={false}
                            domain={['auto', 'auto']}
                          />
                          <Tooltip
                            formatter={(v) => [
                              money(Number(v)),
                              'Portfolio value',
                            ]}
                            labelFormatter={(d) => date(String(d))}
                            contentStyle={{
                              background: 'var(--card)',
                              borderColor: 'var(--border)',
                              borderRadius: 8,
                              color: 'var(--foreground)',
                            }}
                          />
                          <Area
                            dataKey="value"
                            type="linear"
                            stroke="var(--primary)"
                            fill="url(#valueFill)"
                            strokeWidth={2}
                            isAnimationActive={false}
                            dot={{ r: 3 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </section>
                    <div className="snapshot-values">
                      {review.history.map((h) => (
                        <div key={h.date}>
                          <span>{date(h.date)}</span>
                          <strong>
                            {h.value === null
                              ? 'Unavailable'
                              : money(h.value, 'USD', true)}
                          </strong>
                          {h.preInception && (
                            <small>Supplied pre-onboarding history</small>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="chart-caveat">
                      USD values · Changes may include transactions,
                      withdrawals, income, fees, and FX. This is not investment
                      return or quantified market attribution.
                    </p>
                    {review.events.length > 0 && (
                      <div className="events">
                        <h3>Relevant event context</h3>
                        {review.events.map((e) => (
                          <div className="event" key={e.sourceId}>
                            <span>{date(e.date)}</span>
                            <p>{e.description}</p>
                            <Button
                              variant="link"
                              className="source-link"
                              onClick={() => openSources([e.sourceId])}
                            >
                              View event source
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>
            </>
          )}
          {stage === 'editor' && revision && (
            <>
              <div className="page-title title-row">
                <div>
                  <p className="eyebrow">Prepared for RM review</p>
                  <h1>Review the client update</h1>
                  <p className="muted">{review.client.name}</p>
                </div>
                <span className="status-pill">
                  {revision.mode === 'live_ai'
                    ? 'AI draft'
                    : 'Evidence-based template'}
                </span>
              </div>
              <section className="surface">
                <div className="editor-meta">
                  <label htmlFor="draft-text">Client message</label>
                  <span>
                    Revision {revision.revision} ·{' '}
                    {revision.status === 'reviewed'
                      ? 'Reviewed'
                      : 'Review required'}
                  </span>
                </div>
                {revision.mode === 'template_fallback' && (
                  <p className="fallback-info">
                    {fallbackLabels[revision.fallbackReason || ''] ||
                      'Template used because AI was unavailable.'}
                  </p>
                )}
                <Textarea
                  id="draft-text"
                  className="draft-text"
                  value={revision.text}
                  onChange={(e) => {
                    save(
                      editRevision(revision, e.target.value),
                      'Draft edited',
                    );
                    setConfirmed(false);
                  }}
                />
                <div className="draft-provenance">
                  <Button
                    variant="link"
                    onClick={() => openSources(revision.evidenceIds)}
                  >
                    <Files />
                    Inspect draft evidence
                  </Button>
                  <span>Manual edits require your factual review.</span>
                </div>
                <div className="notice">
                  <CircleHelp size={18} />
                  <p>{review.unknowns[0]}</p>
                </div>
                <label htmlFor="review-confirm" className="review-check">
                  <Checkbox
                    id="review-confirm"
                    checked={confirmed}
                    onCheckedChange={(v) => setConfirmed(v === true)}
                    aria-label="I checked the facts, wording, and unresolved questions"
                  />
                  <span>
                    I have checked the facts, wording, and unresolved questions
                    in this version.
                  </span>
                </label>
                <div className="action-row">
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setStage('facts')}>
                      <ArrowLeft />
                      Back to facts
                    </Button>
                    <Button variant="ghost" onClick={reject}>
                      <X />
                      Reject draft
                    </Button>
                  </div>
                  <Button
                    disabled={!confirmed || !revision.text.trim()}
                    onClick={approve}
                  >
                    <CheckCheck />
                    Review & preview
                    <ArrowRight />
                  </Button>
                </div>
              </section>
            </>
          )}
          {stage === 'preview' && canPreview(revision, review) && (
            <>
              <div className="page-title title-row">
                <div>
                  <p className="eyebrow">Reviewed version</p>
                  <h1>What the client sees</h1>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setStage('editor');
                    setConfirmed(false);
                  }}
                >
                  Edit update
                </Button>
              </div>
              <div className="comm-actions">
                <Button
                  variant="outline"
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(
                        `Dear ${review.client.name},\n\n${revision!.text}\n\nPriscilla Ong`,
                      )
                      .then(() => setMessage('Reviewed client message copied.'))
                      .catch(() =>
                        setMessage(
                          'Copy unavailable. Select the preview text manually.',
                        ),
                      );
                  }}
                >
                  Copy reviewed client message
                </Button>
                <Button variant="outline" onClick={() => window.print()}>
                  Print / save as PDF
                </Button>
              </div>
              <div className="client-preview">
                <div className="preview-brand">
                  <ScanLine />
                  FundingLens
                </div>
                <p className="eyebrow mt-8">A note from Priscilla</p>
                <h2>
                  {review.type === 'funding'
                    ? 'Preparing for your upcoming payments'
                    : review.type === 'inheritance'
                      ? 'Reviewing your inherited portfolio'
                      : 'Planning around your current income needs'}
                </h2>
                <p className="preview-greeting">Dear {review.client.name},</p>
                <div className="preview-copy">{revision!.text}</div>
                {review.facts.filter((f) => f.id !== 'portfolio-value').length >
                  0 && (
                  <div className="preview-facts">
                    {review.facts
                      .filter(
                        (f) =>
                          f.id !== 'portfolio-value' &&
                          f.id !== 'equity-excess',
                      )
                      .map((f) => (
                        <div key={f.id}>
                          <span>{f.label}</span>
                          <strong>
                            {f.currency
                              ? money(f.value, f.currency, true)
                              : f.value.toFixed(2)}
                            {f.unit ? ' ' + f.unit : ''}
                          </strong>
                        </div>
                      ))}
                    <small>Supplied records · {date(review.asOf)}</small>
                  </div>
                )}
                <div className="preview-signature">
                  <span>PO</span>
                  <div>
                    <strong>Priscilla Ong</strong>
                    <small>
                      Reviewed revision {revision!.revision} · Prepared for
                      discussion
                    </small>
                    <small>Source snapshot: {date(review.asOf)}</small>
                  </div>
                </div>
                <p className="preview-footer">
                  English prototype · {review.client.language} is the recorded
                  reporting language.
                  <br />
                  No message has been sent.
                </p>
              </div>
              <Button
                variant="ghost"
                className="mt-5"
                onClick={() => setStage('facts')}
              >
                <ArrowLeft />
                Back to facts
              </Button>
            </>
          )}
          <div className="live-status" aria-live="polite">
            {loading ? (
              <>
                <LoaderCircle className="animate-spin" size={15} />
                Loading source records…
              </>
            ) : (
              message
            )}
          </div>
          <footer className="workspace-footer">
            <span>FundingLens · Synthetic data · Public demo</span>
            <span>Sources first. RM review always.</span>
          </footer>
        </div>
      </main>
      <Sheet open={sourcesOpen} onOpenChange={setSourcesOpen}>
        <SheetContent className="evidence-sheet sm:max-w-2xl w-full overflow-y-auto">
          <SheetHeader>
            <p className="eyebrow">
              {review.client.short} · Inspectable evidence
            </p>
            <SheetTitle>Source records</SheetTitle>
            <SheetDescription>
              Exact fields from the supplied synthetic dataset. Notes are
              attributed statements; calculations use the listed inputs.
            </SheetDescription>
          </SheetHeader>
          <div className="evidence-list">
            {sourceList.map((s) => (
              <details key={s.id} className="evidence-record">
                <summary>
                  <span>
                    <strong>{s.label}</strong>
                    <small>
                      {s.file} · {s.key}
                    </small>
                  </span>
                  <ChevronDown size={16} />
                </summary>
                <div className="source-fields">
                  <p className="micro muted">Observation date: {s.date}</p>
                  {Object.entries(s.fields)
                    .filter(([, v]) => v !== undefined && v !== '')
                    .map(([key, value]) => (
                      <div key={key}>
                        <dt>{key.replaceAll('_', ' ')}</dt>
                        <dd>{String(value)}</dd>
                      </div>
                    ))}
                  {s.inputs && (
                    <p className="micro">Inputs: {s.inputs.join(', ')}</p>
                  )}
                </div>
              </details>
            ))}
          </div>
        </SheetContent>
      </Sheet>
      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Review history</SheetTitle>
            <SheetDescription>
              {review.client.name} · Device-local demonstration history. It is
              not an immutable audit log.
            </SheetDescription>
          </SheetHeader>
          <div className="history-log">
            {log.length === 0 ? (
              <p className="muted">
                No draft actions yet. Prepare an update to begin.
              </p>
            ) : (
              [...log].reverse().map((e, i) => (
                <div key={i}>
                  <strong>{e.action}</strong>
                  <p>
                    Revision {e.revision} · {new Date(e.at).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </SidebarProvider>
  );
}
