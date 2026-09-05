'use client';
import { useEffect, useRef, useState } from 'react';
import { Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type {
  ClientReview,
  PortfolioResult,
  Finding,
} from '@/lib/portfolio/contracts';
import {
  intelligenceFindings,
  validateIntelligence,
  type IntelligenceOutput,
} from '@/lib/intelligence/model';
export default function IntelligencePanel({
  client,
  portfolios,
  onEvidence,
  onBrief,
  onScenario,
}: {
  client: ClientReview;
  portfolios: PortfolioResult[];
  onEvidence: (f: Finding) => void;
  onBrief: () => void;
  onScenario: () => void;
}) {
  const findings = intelligenceFindings(portfolios);
  const [result, setResult] = useState<IntelligenceOutput | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function analyze() {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const response = await fetch('/api/portfolio-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: client.id,
          portfolioIds: portfolios.map((p) => p.id),
        }),
        signal: request.signal,
      });
      const value = (await response.json()) as {
        error?: string;
        insights?: unknown;
      };
      if (!response.ok)
        throw new Error(value.error || 'AI analysis unavailable.');
      if (!request.signal.aborted)
        setResult(
          validateIntelligence(
            value.insights ? { insights: value.insights } : value,
            portfolios,
          ),
        );
    } catch (e) {
      if (!request.signal.aborted)
        setError(e instanceof Error ? e.message : 'AI analysis unavailable.');
    } finally {
      if (!request.signal.aborted) setBusy(false);
    }
  }
  const lead = findings[0];
  return (
    <div className="in-workspace">
      <div className="in-section-heading">
        <div>
          <p className="eyebrow">EVIDENCE → UNDERSTANDING → CONVERSATION</p>
          <h3>Intelligence for the next client conversation</h3>
        </div>
        <Button
          onClick={() => void analyze()}
          disabled={busy || !findings.length}
        >
          <Sparkles size={17} />
          {busy
            ? 'Analysing evidence…'
            : result
              ? 'Refresh AI analysis'
              : 'Analyse with AI'}
        </Button>
      </div>
      {lead ? (
        <article className="in-signal">
          <div className="in-signal-label">
            <Sparkles size={22} /> THE SIGNAL BEHIND THE NUMBERS <span>01</span>
          </div>
          <h3>{lead.title}</h3>
          <p className="in-detail">{lead.detail}</p>
          <div className="in-context">
            <strong>WHY THIS NEEDS A REVIEW</strong>
            <p>{lead.reason}</p>
          </div>
          <div className="in-next">
            <strong>Next step for the RM</strong>
            <p>{lead.nextStep}</p>
          </div>
          <div className="in-actions">
            <Button variant="link" onClick={() => onEvidence(lead)}>
              Show supporting evidence <ArrowRight size={16} />
            </Button>
            <span>
              {lead.portfolioId} ·{' '}
              {lead.audience === 'internal'
                ? 'Internal check'
                : 'Client discussion candidate'}
            </span>
          </div>
        </article>
      ) : (
        <article className="in-signal">
          <ShieldCheck />
          <h3>No exceptions found by the current checks.</h3>
          <p>
            This snapshot does not establish suitability or future performance.
            Confirm the client’s objectives and any assets held elsewhere.
          </p>
        </article>
      )}
      <output aria-live="polite">{error}</output>
      {busy && (
        <output className="in-ai-status">
          AI is reading the supplied findings. The calculated evidence stays
          available below.
        </output>
      )}
      {result && (
        <section className="in-ai">
          <p className="eyebrow">
            <Sparkles size={16} /> OPENAI ANALYSIS · RM REVIEW REQUIRED
          </p>
          <h3>A clearer way to frame the discussion</h3>
          {result.insights.map((i) => {
            const f = findings.find((f) => f.id === i.findingId)!;
            return (
              <article key={i.findingId}>
                <strong>{f.title}</strong>
                <p>{i.explanation}</p>
                <blockquote>{i.question}</blockquote>
                <Button variant="link" onClick={() => onEvidence(f)}>
                  Check the source <ArrowRight size={15} />
                </Button>
              </article>
            );
          })}
          <small>
            AI explanations can be wrong. The linked findings are the source of
            record; review wording before use.
          </small>
        </section>
      )}
      <div className="in-grid">
        {findings.slice(1, 4).map((f) => (
          <article className="in-card" key={f.id}>
            <span className="pd-tag">{f.category}</span>
            <h3>{f.title}</h3>
            <p>{f.detail}</p>
            <Button variant="link" onClick={() => onEvidence(f)}>
              Evidence & action <ArrowRight size={15} />
            </Button>
          </article>
        ))}
      </div>
      <div className="in-route">
        <div>
          <h3>From insight to a useful next step</h3>
          <p>
            Compare a cash objective or explore hypothetical portfolio values,
            then prepare a reviewed client message.
          </p>
        </div>
        <Button variant="outline" onClick={onScenario}>
          Explore scenarios <ArrowRight size={16} />
        </Button>
        <Button variant="outline" onClick={onBrief}>
          Conversation brief <ArrowRight size={16} />
        </Button>
      </div>
      <p className="muted text-sm">
        Review order: source quality, funding access, capital calls,
        concentration, allocation, then valuation. This order is a workflow aid,
        not a risk score. {findings.length} finding(s) across the selected
        portfolios; see Review findings for the full list.
      </p>
    </div>
  );
}
