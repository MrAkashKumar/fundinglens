'use client';
/* oxlint-disable react/react-compiler -- Restore and report browser-local persistence after mounting. */
import { useEffect, useRef, useState } from 'react';
import { Sparkles, ArrowRight, Check, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  intakeFields,
  validateExtraction,
  composeIntakeDraft,
  sourceSummary,
  hasCredential,
} from '@/lib/intake';
import type { Review } from '@/lib/types';
const examples: Record<Review['type'], string> = {
  funding:
    'Example only: the client says the next tuition instalment is USD 80,000 due 15 October 2026. Operations will confirm deposit access. Follow up on 20 September 2026.',
  inheritance:
    'Example only: the client wants a review of income needs before changing inherited holdings. The authorised tax adviser will confirm the payment notice. Arrange a meeting on 22 September 2026.',
  retirement:
    'Example only: the client says the annual budget is USD 1.28m including routine medical costs; one-off expenses are separate. The household contact will send a breakdown. Follow up on 21 September 2026.',
};
export default function QuickIntake({
  review,
  onDraft,
  onSources,
}: {
  review: Review;
  onDraft: (text: string, ids: string[]) => void;
  onSources: (ids?: string[]) => void;
}) {
  const [note, setNote] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [ready, setReady] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const fields = intakeFields[review.type];
  const key = 'fundinglens:intake:' + review.clientId;
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const saved = JSON.parse(raw) as {
          note?: unknown;
          values?: unknown;
          inputVersion?: string;
        };
        if (typeof saved.note === 'string' && saved.note.length <= 6000)
          setNote(saved.note);
        if (
          saved.inputVersion === review.inputVersion &&
          saved.values &&
          typeof saved.values === 'object'
        ) {
          const clean = Object.fromEntries(
            Object.entries(saved.values).filter(
              ([id, v]) =>
                fields.some((f) => f.id === id) &&
                typeof v === 'string' &&
                v.length <= 2000,
            ),
          );
          setValues(clean);
        } else
          setMessage(
            'Saved note restored. Source selection changed; review and extract the details again.',
          );
      }
    } catch {
      setMessage(
        'Saved intake is unavailable; you can continue in this session.',
      );
    }
    setReady(true);
    return () => abort.current?.abort();
    // This keyed component restores browser-local drafts only after mounting.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(
        key,
        JSON.stringify({ note, values, inputVersion: review.inputVersion }),
      );
    } catch {
      setMessage('Intake could not be saved locally; keep this page open.');
    }
  }, [note, values, key, review.inputVersion, ready]);
  async function extract() {
    setBusy(true);
    setChecked(false);
    setMessage(
      'Reading the note; existing portfolio records remain unchanged.',
    );
    const controller = new AbortController();
    abort.current = controller;
    const timeout = setTimeout(() => controller.abort(), 23000);
    try {
      const response = await fetch('/api/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: review.clientId,
          comparisonStart: review.comparisonStart,
          inputVersion: review.inputVersion,
          note,
        }),
        signal: controller.signal,
      });
      const body = (await response.json()) as {
        error?: string;
        clientId?: string;
        inputVersion?: string;
        items: unknown;
      };
      if (!response.ok) throw new Error(body.error || 'Extraction failed.');
      if (
        body.clientId !== review.clientId ||
        body.inputVersion !== review.inputVersion
      )
        throw new Error('The source selection changed. Try again.');
      const result = validateExtraction(
        { items: body.items },
        note,
        review.type,
      );
      setValues(
        Object.fromEntries(result.items.map((i) => [i.fieldId, i.quote])),
      );
      setMessage(
        result.items.length
          ? `Extracted ${result.items.length} of ${fields.length} fields. Check each excerpt; missing details remain blank.`
          : 'No matching details found. Complete only the fields you know.',
      );
    } catch (e) {
      setMessage(
        e instanceof Error && e.name === 'AbortError'
          ? 'Extraction timed out. Retry or complete the fields manually.'
          : e instanceof Error
            ? e.message
            : 'Unable to extract details.',
      );
    } finally {
      clearTimeout(timeout);
      setBusy(false);
    }
  }
  const known = sourceSummary(review);
  const entered = Object.values(values).filter((v) => v.trim()).length;
  const unsafe =
    hasCredential(note) || Object.values(values).some(hasCredential);
  return (
    <section className="surface quick-intake">
      <div className="quick-heading">
        <div>
          <p className="eyebrow">LESS TYPING · ONE CLIENT NOTE</p>
          <h2>
            <Sparkles size={22} /> Prepare a complete review faster
          </h2>
          <p className="muted">
            The portfolio context is already filled. Add only what changed in
            the conversation.
          </p>
        </div>
        <span className="status-pill">
          {review.evidence.length} source records linked
        </span>
      </div>
      <div className="quick-context">
        <div>
          <Check size={16} />
          <strong>Already filled from records</strong>
        </div>
        <p>
          {review.client.name} · {review.client.portfolioId} ·{' '}
          {review.client.risk}
        </p>
        {known.map((t) => (
          <p key={t}>{t}</p>
        ))}
        <Button variant="link" onClick={() => onSources()}>
          Inspect the source records <ArrowRight />
        </Button>
      </div>
      <label htmlFor="quick-note">
        What did the client or specialist tell you?
      </label>
      <Textarea
        id="quick-note"
        value={note}
        maxLength={6000}
        disabled={busy}
        placeholder="Paste one short meeting note. Leave unknown amounts and dates unstated."
        onChange={(e) => {
          setNote(e.target.value);
          setValues({});
          setChecked(false);
          setMessage(
            'Note changed. Extract again or enter the fields manually.',
          );
        }}
      />
      <div className="quick-actions">
        <Button
          disabled={busy || note.trim().length < 10 || unsafe}
          onClick={() => void extract()}
        >
          <Sparkles />
          {busy ? 'Extracting details…' : 'Extract details with AI'}
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => {
            setNote(examples[review.type]);
            setValues({});
            setChecked(false);
            setMessage(
              'Synthetic example loaded. These details are not supplied bank records.',
            );
          }}
        >
          Use a synthetic example
        </Button>
        <small>{note.length}/6,000 characters</small>
      </div>
      <p className="muted text-sm">
        Public demo: use synthetic notes only. Clicking Extract sends this note
        to OpenAI. Missing details stay blank; no facts are overwritten.
      </p>
      {unsafe && <p role="alert">Remove credentials before continuing.</p>}
      <div className="quick-fields">
        {fields.map((f) => (
          <div key={f.id}>
            <label htmlFor={'quick-' + f.id}>{f.label}</label>
            <Textarea
              id={'quick-' + f.id}
              disabled={busy}
              maxLength={2000}
              value={values[f.id] || ''}
              placeholder="Not provided — enter manually if known"
              onChange={(e) => {
                setValues({ ...values, [f.id]: e.target.value });
                setChecked(false);
              }}
            />
            <small>{f.question}</small>
          </div>
        ))}
      </div>
      <p className="muted">
        {entered} of {fields.length} note fields filled. Unfilled fields become
        confirmation questions. Conflicts with the source records remain visible
        for RM review.
      </p>
      <label className="review-check" htmlFor="quick-confirm">
        <Checkbox
          id="quick-confirm"
          checked={checked}
          disabled={busy || unsafe}
          onCheckedChange={(v) => setChecked(v === true)}
        />
        <span>
          I checked these details for this client and approved their inclusion
          in a client draft.
        </span>
      </label>
      <Button
        disabled={!checked || busy || unsafe || !ready}
        onClick={() =>
          onDraft(
            composeIntakeDraft(review, values),
            review.evidence
              .filter(
                (s) => s.file !== 'holdings.csv' || s.date === review.asOf,
              )
              .map((s) => s.id),
          )
        }
      >
        <FileText />
        Prepare client-ready draft <ArrowRight />
      </Button>
      <output className="block mt-3" aria-live="polite">
        {message}
      </output>
    </section>
  );
}
