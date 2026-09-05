'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
type Batch = {
  holdingsRows: number;
  asOf: string;
  items: {
    clientId: string;
    name: string;
    title: string;
    status: string;
    question: string;
    sourceCount: number;
    error: string | null;
  }[];
};
export default function BatchReview({
  onSelect,
}: {
  onSelect: (id: string) => void;
}) {
  const [batch, setBatch] = useState<Batch | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [visible, setVisible] = useState(false);
  async function prepare() {
    if (batch) {
      setVisible(!visible);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/review-batch');
      if (!r.ok)
        throw new Error(
          'Batch review unavailable. You can still open clients individually.',
        );
      setBatch((await r.json()) as Batch);
      setVisible(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to prepare reviews.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="batch-review">
      <div>
        <strong>Review the client list in one step</strong>
        <p className="muted">
          Process the three supported cases from the supplied data without
          re-entering holdings.
        </p>
      </div>
      <Button variant="outline" disabled={busy} onClick={() => void prepare()}>
        {busy
          ? 'Preparing reviews…'
          : visible
            ? 'Hide review queue'
            : 'Prepare all 3 reviews'}
      </Button>
      {error && <p role="alert">{error}</p>}
      {visible && batch && (
        <div className="batch-results">
          <p>
            {batch.holdingsRows.toLocaleString()} holding rows in the dataset ·
            Source snapshot {batch.asOf} · Calculated context, no AI calls
          </p>
          <div className="batch-cards">
            {batch.items.map((c) => (
              <article key={c.clientId}>
                <span className="status-pill">{c.status}</span>
                <h3>{c.name}</h3>
                <p>{c.question}</p>
                <small>{c.sourceCount} linked evidence records</small>
                <Button
                  disabled={Boolean(c.error)}
                  variant="link"
                  onClick={() => onSelect(c.clientId)}
                >
                  Open review
                </Button>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
