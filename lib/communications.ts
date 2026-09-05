import { z } from 'zod';
import type { Review } from './types';
export type RequestTask = {
  id: string;
  title: string;
  recipient: string;
  purpose: string;
  questions: string[];
  sources: string[];
};
export function communicationTasks(review: Review): RequestTask[] {
  const notes = review.evidence
    .filter((s) => s.file === 'rm_notes.json')
    .map((s) => s.id);
  if (review.type === 'funding')
    return [
      {
        id: 'payment-schedule',
        title: 'Confirm the next USD payments',
        recipient: 'Client / authorised family contact',
        purpose:
          'Establish the next amount and date before discussing funding.',
        questions: [
          'Please confirm the amount and due date of the next university instalment, and whether a payment notice is available.',
          'Have you received any capital-call notices? Please confirm their amounts, currencies and due dates.',
        ],
        sources: [
          'planned_cash_needs.csv:CN-007',
          'planned_cash_needs.csv:CN-008',
          'commitments.csv:COM-003',
          ...notes,
        ],
      },
      {
        id: 'access-terms',
        title: 'Confirm deposit access and redemption proceeds',
        recipient: 'Internal operations / investment specialist',
        purpose:
          'Separate recorded investment values from money actually available for a payment.',
        questions: [
          'Please confirm the SGD deposit maturity, early-access conditions and any encumbrances.',
          'Please confirm the status of the private-credit redemption request, any confirmed proceeds and expected settlement date. The request alone does not establish receipt.',
          'Please identify any settlement or currency-conversion steps needed before USD funds could be used.',
        ],
        sources: [
          'transactions.csv:TXN-0008',
          ...review.liquidity
            .filter((x) => ['Monthly', 'Quarterly Gate'].includes(x.tier))
            .flatMap((x) => x.holdings.map((h) => h.sourceId)),
        ],
      },
    ];
  if (review.type === 'inheritance')
    return [
      {
        id: 'payment-arrangements',
        title: 'Confirm the recorded EUR payment',
        recipient: 'Client / authorised tax adviser',
        purpose:
          'Clarify the recorded payment schedule and existing funding arrangements.',
        questions: [
          'Please confirm the due date and amount of the recorded inheritance-tax instalment against the latest notice.',
          'Are funding arrangements already in place? Please identify the adviser we may coordinate with, subject to your authorisation.',
        ],
        sources: ['planned_cash_needs.csv:CN-004', ...notes],
      },
      {
        id: 'portfolio-priorities',
        title: 'Confirm priorities for the inherited portfolio',
        recipient: 'Client',
        purpose:
          'Prepare a discussion about the allocation exception without implying an agreed trade.',
        questions: [
          'Could we arrange a review of the inherited holdings and your current income needs?',
          'Please confirm your current comfort with equity exposure and which holdings you would like us to discuss first. No portfolio change is being proposed through this request.',
        ],
        sources: [
          ...notes,
          ...(review.allocation.find((x) => x.assetClass === 'Equity')
            ?.sourceIds || []),
        ],
      },
    ];
  return [
    {
      id: 'spending-confirmation',
      title: 'Resolve the retirement spending discrepancy',
      recipient: 'Client / authorised household contact',
      purpose:
        'Confirm which spending record is current before updating the retirement plan.',
      questions: [
        'The annual spending amount in the client objective differs from the planned-needs record. Please confirm the current annual budget and its effective date.',
        'Does that budget include medical costs and one-off expenses? Please identify any recent changes and their frequency.',
      ],
      sources: [
        'clients.csv:' + review.clientId,
        'planned_cash_needs.csv:CN-012',
        ...notes,
      ],
    },
  ];
}
export const communicationSchema = z.object({
  clientId: z.string(),
  inputVersion: z.string(),
  taskId: z.string(),
  subject: z.string(),
  body: z.string(),
  kind: z.enum(['request', 'followup']),
  revision: z.number().int().positive(),
  reviewedRevision: z.number().int().positive().nullable(),
  followUpOn: z.string(),
  reply: z.string(),
  closed: z.boolean(),
  events: z
    .array(
      z.object({
        at: z.string(),
        action: z.string(),
        revision: z.number(),
        subject: z.string().optional(),
        body: z.string().optional(),
        reply: z.string().optional(),
        followUpOn: z.string().optional(),
      }),
    )
    .max(100),
});
export type Communication = z.infer<typeof communicationSchema>;
export function newCommunication(
  review: Review,
  task: RequestTask,
): Communication {
  return {
    clientId: review.clientId,
    inputVersion: review.inputVersion,
    taskId: task.id,
    subject: task.title,
    body: `Hello,\n\n${task.purpose}\n\n${task.questions.map((q, i) => `${i + 1}. ${q}`).join('\n\n')}\n\nThank you,\nPriscilla Ong`,
    kind: 'request',
    revision: 1,
    reviewedRevision: null,
    followUpOn: '',
    reply: '',
    closed: false,
    events: [],
  };
}
export function changeMessage(
  c: Communication,
  subject: string,
  body: string,
): Communication {
  return subject === c.subject && body === c.body
    ? c
    : { ...c, subject, body, revision: c.revision + 1, reviewedRevision: null };
}
export function isReviewed(c: Communication) {
  return (
    c.reviewedRevision === c.revision &&
    Boolean(c.subject.trim() && c.body.trim())
  );
}
export function recordEvent(c: Communication, action: string): Communication {
  return {
    ...c,
    events: [
      ...c.events,
      {
        at: new Date().toISOString(),
        action,
        revision: c.revision,
        subject: c.subject,
        body: c.body,
        reply: c.reply,
        followUpOn: c.followUpOn,
      },
    ].slice(-100),
  };
}
export function approveMessage(c: Communication): Communication {
  if (!c.subject.trim() || !c.body.trim() || c.closed)
    throw new Error('Enter a subject and message before reviewing.');
  return recordEvent({ ...c, reviewedRevision: c.revision }, 'Draft reviewed');
}
export function makeFollowup(
  c: Communication,
  task: RequestTask,
): Communication {
  if (
    c.closed ||
    !c.events.some((e) => e.action === 'Request recorded as sent externally')
  )
    throw new Error(
      'Record the original request as sent externally before preparing a follow-up.',
    );
  return recordEvent(
    {
      ...c,
      kind: 'followup',
      subject: `Follow-up: ${task.title}`,
      body: `Hello,\n\nI am following up on our request about ${task.title.toLowerCase()}.\n\n${task.questions.map((q, i) => `${i + 1}. ${q}`).join('\n\n')}\n\nIf you have already replied, please let us know where the information was shared.\n\nThank you,\nPriscilla Ong`,
      revision: c.revision + 1,
      reviewedRevision: null,
    },
    'Follow-up draft prepared',
  );
}
