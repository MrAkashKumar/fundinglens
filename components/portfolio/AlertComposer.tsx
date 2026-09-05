'use client';
/* oxlint-disable react/react-compiler -- Restore browser-local draft on mount; approval is never restored. */
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import type { ClientReview, Finding } from '@/lib/portfolio/contracts';
import { alertDraft } from '@/lib/portfolio/alerts';
export default function AlertComposer({
  client,
  finding,
  purpose = 'review',
}: {
  client: ClientReview;
  finding: Finding;
  purpose?: 'review' | 'request' | 'followup';
}) {
  const [body, setBody] = useState(() => alertDraft(client, finding, purpose));
  const [reviewed, setReviewed] = useState(false);
  const [checked, setChecked] = useState(false);
  const [preview, setPreview] = useState(false);
  const [status, setStatus] = useState('');
  const key =
    'fundinglens:portfolio-alert:' +
    client.id +
    ':' +
    finding.id +
    (purpose === 'review' ? '' : ':' + purpose);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const saved = JSON.parse(raw) as { body?: unknown };
        if (typeof saved.body === 'string' && saved.body.length <= 12000)
          setBody(saved.body);
      }
    } catch {
      setStatus('Saved draft unavailable. You can continue in this session.');
    }
    /* oxlint-disable-next-line react/react-compiler */
  }, [key]);
  function persist(text: string) {
    setBody(text);
    setReviewed(false);
    setChecked(false);
    setPreview(false);
    try {
      localStorage.setItem(key, JSON.stringify({ body: text }));
    } catch {
      setStatus('Draft is available in this session only.');
    }
  }
  return (
    <section className="pd-alert">
      <p className="eyebrow">CLIENT COMMUNICATION · RM REVIEW REQUIRED</p>
      <h3>
        {purpose === 'request'
          ? 'Request updated client information'
          : purpose === 'followup'
            ? 'Prepare a client check-in'
            : 'Prepare a portfolio review alert'}
      </h3>
      <p className="muted">
        Intended recipient: {client.name}. English draft; recorded reporting
        language: {client.language}. Review preferences and recipient
        authorisation before sharing.
      </p>
      <label htmlFor="portfolio-alert">Client message</label>
      <Textarea
        id="portfolio-alert"
        maxLength={12000}
        value={body}
        onChange={(e) => persist(e.target.value)}
      />
      <label className="review-check" htmlFor="portfolio-alert-check">
        <Checkbox
          id="portfolio-alert-check"
          checked={checked}
          onCheckedChange={(v) => setChecked(v === true)}
        />
        <span>
          I checked the source records, current context, recipient and wording.
        </span>
      </label>
      <div className="comm-actions">
        <Button
          disabled={!checked || !body.trim()}
          onClick={() => {
            setReviewed(true);
            setPreview(true);
            setStatus('This wording is reviewed. No alert has been sent.');
          }}
        >
          Review & preview alert
        </Button>
        {reviewed && (
          <Button
            variant="outline"
            onClick={() => {
              void navigator.clipboard
                .writeText(body)
                .then(() =>
                  setStatus(
                    'Reviewed alert copied. Send through your approved communication channel.',
                  ),
                )
                .catch(() =>
                  setStatus(
                    'Copy unavailable. Select and copy the preview text.',
                  ),
                );
            }}
          >
            Copy reviewed alert
          </Button>
        )}
      </div>
      {preview && reviewed && (
        <article className="pd-alert-preview">
          <strong>Reviewed client message</strong>
          <p>{body}</p>
        </article>
      )}
      <output aria-live="polite">{status}</output>
      <p className="muted text-sm">
        No automatic delivery, trading or bank-record updates. Saved drafts
        remain in this browser; reloading requires review again.
      </p>
    </section>
  );
}
