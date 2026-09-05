'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  Mail,
  ArrowRight,
  CheckCheck,
  Clock,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  communicationTasks,
  communicationSchema,
  newCommunication,
  changeMessage,
  isReviewed,
  approveMessage,
  makeFollowup,
  recordEvent,
} from '@/lib/communications';
import type { Communication, RequestTask } from '@/lib/communications';
import type { Review } from '@/lib/types';
export function AIStatus() {
  const [health, setHealth] = useState<
    import('@/lib/ai-health').AIHealth | null
  >(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    void fetch('/api/ai-status', { signal: abort.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error('Unavailable');
        setHealth((await r.json()) as import('@/lib/ai-health').AIHealth);
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setFailed(true);
      });
    return () => abort.abort();
  }, []);
  return (
    <details className="ai-status">
      <summary>
        {failed
          ? 'AI status temporarily unavailable'
          : !health
            ? 'Checking AI availability…'
            : health.verified
              ? 'OpenAI connection verified'
              : health.configured
                ? 'AI temporarily unavailable · templates ready'
                : 'Template mode · AI assistance unavailable'}
      </summary>
      <p>
        {health?.verified
          ? 'AI is available for extracting meeting-note details and preparing client updates. Review the results before sharing.'
          : 'You can continue with manual note entry and case-specific message templates.'}
      </p>
      <p>
        Information requests and follow-ups use the case-specific templates
        below.
      </p>
      {health?.checkedAt && (
        <p className="muted text-sm">
          Connection last checked:{' '}
          {new Date(health.checkedAt).toLocaleTimeString()}. A successful
          connection check does not guarantee every generation request will
          succeed.
        </p>
      )}
    </details>
  );
}
export default function Communications({
  review,
  onSources,
}: {
  review: Review;
  onSources: (ids: string[]) => void;
}) {
  const tasks = useMemo(() => communicationTasks(review), [review]);
  const [selected, setSelected] = useState(tasks[0].id);
  return (
    <section className="surface comm-section">
      <div className="history-heading">
        <div>
          <p className="eyebrow">REQUEST → FOLLOW UP → RECORD REPLY</p>
          <h2>
            <Mail size={22} /> Resolve the missing information
          </h2>
          <p className="muted">
            Prepare a focused request and keep its follow-up beside the
            evidence.
          </p>
        </div>
      </div>
      <AIStatus />
      <div className="comm-layout">
        <div className="comm-task-list" aria-label="Communication topics">
          {tasks.map((t) => (
            <Button
              key={t.id}
              variant={selected === t.id ? 'secondary' : 'ghost'}
              aria-pressed={selected === t.id}
              onClick={() => setSelected(t.id)}
            >
              <span>
                <strong>{t.title}</strong>
                <small>{t.recipient}</small>
              </span>
              <ArrowRight size={16} />
            </Button>
          ))}
        </div>
        <RequestEditor
          key={review.inputVersion + selected}
          review={review}
          task={tasks.find((t) => t.id === selected) || tasks[0]}
          onSources={onSources}
        />
      </div>
    </section>
  );
}
function RequestEditor({
  review,
  task,
  onSources,
}: {
  review: Review;
  task: RequestTask;
  onSources: (ids: string[]) => void;
}) {
  const [draft, setDraft] = useState<Communication>(() =>
    newCommunication(review, task),
  );
  const [ready, setReady] = useState(false);
  const [attest, setAttest] = useState(false);
  const [external, setExternal] = useState(false);
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState('');
  const key = `fundinglens:communication:${review.clientId}:${task.id}`;
  useEffect(() => {
    let next = newCommunication(review, task);
    let notice = '';
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = communicationSchema.safeParse(JSON.parse(raw));
        if (
          parsed.success &&
          parsed.data.clientId === review.clientId &&
          parsed.data.taskId === task.id
        ) {
          next = parsed.data;
          if (next.inputVersion !== review.inputVersion) {
            next = {
              ...next,
              inputVersion: review.inputVersion,
              reviewedRevision: null,
              closed: false,
            };
            notice =
              'Sources changed. Check the saved wording against the current evidence before review.';
          }
        } else
          notice =
            'Saved draft could not be read. A fresh request is available.';
      }
    } catch {
      notice = 'Local history unavailable. Continue in this session.';
    }
    // Browser-only persistence is restored after mounting; no server storage is used.
    /* oxlint-disable react/react-compiler */
    setDraft(next);
    setMessage(notice);
    setReady(true);
    /* oxlint-enable react/react-compiler */
  }, [key, review, task]);
  function save(next: Communication) {
    setDraft(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
      return true;
    } catch {
      setMessage(
        'Changes are only available in this session; local storage could not be saved.',
      );
      return false;
    }
  }
  function action(fn: () => Communication) {
    try {
      const persisted = save(fn());
      setAttest(false);
      setExternal(false);
      setPreview(false);
      if (persisted)
        setMessage('Saved locally. No message was sent by FundingLens.');
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : 'Unable to update this request.',
      );
    }
  }
  const reviewed = isReviewed(draft);
  const requestRecorded = draft.events.some(
    (e) => e.action === 'Request recorded as sent externally',
  );
  const overdue =
    draft.followUpOn &&
    !draft.closed &&
    draft.followUpOn < new Date().toLocaleDateString('en-CA');
  return (
    <div className="comm-editor" aria-busy={!ready}>
      <div className="comm-meta">
        <span className="status-pill">
          {draft.closed
            ? 'Closed by RM'
            : draft.reply.trim()
              ? 'Reply recorded · verification needed'
              : requestRecorded
                ? 'Awaiting information'
                : 'Request not yet recorded as sent'}
        </span>
        <span>
          Revision {draft.revision} ·{' '}
          {reviewed ? 'Reviewed' : 'Review required'}
        </span>
      </div>
      <h3>{task.title}</h3>
      <p>{task.purpose}</p>
      <p className="muted">
        Intended recipient: {task.recipient}. Confirm their identity and
        authorisation in your normal communication channel.
      </p>
      <Button variant="link" onClick={() => onSources(task.sources)}>
        Inspect supporting records <ArrowRight />
      </Button>
      {ready && (
        <>
          <label htmlFor={`subject-${task.id}`}>Subject</label>
          <Input
            id={`subject-${task.id}`}
            value={draft.subject}
            disabled={draft.closed}
            onChange={(e) => {
              save(changeMessage(draft, e.target.value, draft.body));
              setAttest(false);
              setPreview(false);
              setExternal(false);
            }}
          />
          <label htmlFor={`message-${task.id}`}>
            {draft.kind === 'followup'
              ? 'Follow-up message'
              : 'Information request'}
          </label>
          <Textarea
            id={`message-${task.id}`}
            className="comm-body"
            value={draft.body}
            disabled={draft.closed}
            onChange={(e) => {
              save(changeMessage(draft, draft.subject, e.target.value));
              setAttest(false);
              setPreview(false);
              setExternal(false);
            }}
          />
          <label className="review-check" htmlFor={`attest-${task.id}`}>
            <Checkbox
              id={`attest-${task.id}`}
              checked={attest}
              disabled={draft.closed}
              onCheckedChange={(v) => setAttest(v === true)}
            />
            <span>
              I checked the recipient, evidence, and wording of this revision.
            </span>
          </label>
          <div className="comm-actions">
            <Button
              disabled={
                !attest ||
                draft.closed ||
                !draft.body.trim() ||
                !draft.subject.trim()
              }
              onClick={() => action(() => approveMessage(draft))}
            >
              <CheckCheck />
              Mark draft reviewed
            </Button>
            <Button
              variant="outline"
              disabled={!reviewed}
              onClick={() => setPreview(!preview)}
            >
              Preview reviewed message
            </Button>
          </div>
          {preview && reviewed && (
            <article className="comm-preview">
              <p className="eyebrow">REVIEWED MESSAGE · MANUAL HANDOFF</p>
              <h3>{draft.subject}</h3>
              <p style={{ whiteSpace: 'pre-wrap' }}>{draft.body}</p>
              <Button
                variant="outline"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(`${draft.subject}\n\n${draft.body}`)
                    .then(() =>
                      setMessage(
                        'Reviewed message copied. Use your approved communication channel.',
                      ),
                    )
                    .catch(() =>
                      setMessage(
                        'Copy unavailable. Select and copy the preview text manually.',
                      ),
                    );
                }}
              >
                Copy reviewed message
              </Button>
            </article>
          )}
          <div className="comm-tracking">
            <h3>
              <Clock size={18} /> Follow-up tracking
            </h3>
            <p className="muted">
              Use after communicating through your approved channel. Recording
              an action here does not send a message.
            </p>
            <label className="review-check" htmlFor={`external-${task.id}`}>
              <Checkbox
                id={`external-${task.id}`}
                checked={external}
                disabled={!reviewed || draft.closed}
                onCheckedChange={(v) => setExternal(v === true)}
              />
              <span>I sent this reviewed revision outside FundingLens.</span>
            </label>
            <Button
              variant="outline"
              disabled={
                !external ||
                !reviewed ||
                draft.closed ||
                draft.events.some(
                  (e) =>
                    e.revision === draft.revision &&
                    e.action.endsWith('recorded as sent externally'),
                )
              }
              onClick={() =>
                action(() =>
                  recordEvent(
                    draft,
                    draft.kind === 'request'
                      ? 'Request recorded as sent externally'
                      : 'Follow-up recorded as sent externally',
                  ),
                )
              }
            >
              Record external communication
            </Button>
            <label htmlFor={`due-${task.id}`}>RM follow-up date</label>
            <Input
              type="date"
              id={`due-${task.id}`}
              value={draft.followUpOn}
              disabled={draft.closed}
              onChange={(e) => save({ ...draft, followUpOn: e.target.value })}
            />
            <p className={overdue ? 'comm-overdue' : 'muted'}>
              {draft.followUpOn
                ? `${overdue ? 'Follow-up overdue' : 'Follow-up planned'}: ${draft.followUpOn}`
                : 'Choose a date after agreeing the timing.'}{' '}
              No automatic reminder is scheduled.
            </p>
            <Button
              variant="outline"
              disabled={!requestRecorded || draft.closed}
              onClick={() => action(() => makeFollowup(draft, task))}
            >
              Prepare related follow-up
            </Button>
          </div>
          <div className="comm-tracking">
            <h3>
              <MessageSquare size={18} /> Record the reply
            </h3>
            <label htmlFor={`reply-${task.id}`}>
              Reply summary and where to verify it
            </label>
            <Textarea
              id={`reply-${task.id}`}
              placeholder="Record what was confirmed, by whom, when, and the source location. Do not include API keys."
              value={draft.reply}
              disabled={draft.closed}
              onChange={(e) => save({ ...draft, reply: e.target.value })}
            />
            <p className="muted">
              RM-entered notes are unverified. They do not update portfolio
              facts or establish payment readiness.
            </p>
            <div className="comm-actions">
              <Button
                variant="outline"
                disabled={!draft.reply.trim() || draft.closed}
                onClick={() =>
                  action(() =>
                    recordEvent(draft, 'Reply summary recorded by RM'),
                  )
                }
              >
                Record reply summary
              </Button>
              <Button
                variant="outline"
                disabled={!draft.reply.trim() && !draft.closed}
                onClick={() =>
                  action(() =>
                    recordEvent(
                      { ...draft, closed: !draft.closed },
                      draft.closed
                        ? 'Request reopened by RM'
                        : 'Request closed by RM',
                    ),
                  )
                }
              >
                {draft.closed
                  ? 'Reopen request'
                  : 'Close request after verification'}
              </Button>
            </div>
          </div>
          <details className="comm-timeline">
            <summary>
              Communication history ({draft.events.length}) · This browser only
            </summary>
            {draft.events.length === 0 ? (
              <p>No communication actions recorded.</p>
            ) : (
              draft.events
                .slice()
                .reverse()
                .map((e, i) => (
                  <article key={i}>
                    <strong>{e.action}</strong>
                    <small>
                      {new Date(e.at).toLocaleString()} · Revision {e.revision}
                    </small>
                    <details>
                      <summary>View message at this action</summary>
                      <strong>{e.subject}</strong>
                      {e.reply && (
                        <p>Reply summary at this action: {e.reply}</p>
                      )}
                      {e.followUpOn && <p>Follow-up date: {e.followUpOn}</p>}
                      <p style={{ whiteSpace: 'pre-wrap' }}>{e.body}</p>
                    </details>
                  </article>
                ))
            )}
          </details>
        </>
      )}
      <output aria-live="polite">{message}</output>
    </div>
  );
}
