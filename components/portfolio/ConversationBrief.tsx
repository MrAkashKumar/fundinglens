'use client';
import { useState } from 'react';
import type {
  ClientReview,
  PortfolioResult,
  Finding,
} from '@/lib/portfolio/contracts';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import AlertComposer from './AlertComposer';
export default function ConversationBrief({
  client,
  portfolios,
  onEvidence,
}: {
  client: ClientReview;
  portfolios: PortfolioResult[];
  onEvidence: (f: Finding) => void;
}) {
  const available = portfolios
    .filter(
      (p) =>
        !p.findings.some(
          (f) =>
            f.category === 'Data quality' &&
            f.title !== 'Duplicate records removed',
        ),
    )
    .flatMap((p) => p.findings)
    .filter((f) => f.audience === 'client_review');
  const [id, setId] = useState(available[0]?.id || '');
  const [purpose, setPurpose] = useState<'review' | 'request' | 'followup'>(
    'review',
  );
  const finding = available.find((f) => f.id === id);
  return (
    <section className="in-workspace">
      <div className="in-section-heading">
        <div>
          <p className="eyebrow">A CLEAR MESSAGE · A SPECIFIC NEXT STEP</p>
          <h3>Prepare the client conversation</h3>
          <p>
            Choose a verified discussion point, review the wording, and copy the
            draft to your approved channel.
          </p>
        </div>
      </div>
      {!finding ? (
        <div className="in-notice">
          No eligible client discussion points in this selection. Resolve
          internal source checks or review a different portfolio.
        </div>
      ) : (
        <>
          <div className="in-brief-controls">
            <label htmlFor="brief-topic">
              Discussion point
              <Select
                value={id}
                onValueChange={(v) => {
                  if (v) setId(v);
                }}
              >
                <SelectTrigger id="brief-topic" aria-label="Discussion point">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {available.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.portfolioId} · {f.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label htmlFor="brief-purpose">
              Message purpose
              <Select
                value={purpose}
                onValueChange={(v) => {
                  if (v === 'review' || v === 'request' || v === 'followup')
                    setPurpose(v);
                }}
              >
                <SelectTrigger id="brief-purpose" aria-label="Message purpose">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="review">Portfolio review alert</SelectItem>
                  <SelectItem value="request">
                    Request updated information
                  </SelectItem>
                  <SelectItem value="followup">Follow-up / check-in</SelectItem>
                </SelectContent>
              </Select>
            </label>
          </div>
          <article className="in-card">
            <strong>{finding.title}</strong>
            <p>{finding.detail}</p>
            <Button variant="link" onClick={() => onEvidence(finding)}>
              Review supporting evidence
            </Button>
          </article>
          <AlertComposer
            key={client.id + finding.id + purpose}
            client={client}
            finding={finding}
            purpose={purpose}
          />
        </>
      )}
      <p className="muted text-sm">
        Drafts are saved only in this browser. No automatic sending, scheduled
        follow-up, or bank-record updates.
      </p>
    </section>
  );
}
