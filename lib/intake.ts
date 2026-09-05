import { z } from 'zod';
import type { Review } from './types';
export type IntakeField = { id: string; label: string; question: string };
// Adding a case only requires a field definition and a review-data adapter.
export const intakeFields: Record<Review['type'], IntakeField[]> = {
  funding: [
    {
      id: 'payment',
      label: 'Next payment',
      question:
        'Amount, currency and date of the next tuition instalment or capital call',
    },
    {
      id: 'access',
      label: 'Access confirmation',
      question:
        'Deposit access or actual redemption proceeds confirmed by operations',
    },
    {
      id: 'owner',
      label: 'Who will confirm',
      question: 'Person or team responsible for the outstanding information',
    },
    {
      id: 'followup',
      label: 'Next contact',
      question: 'Explicit follow-up date or meeting arrangement',
    },
  ],
  inheritance: [
    {
      id: 'payment',
      label: 'Payment arrangements',
      question:
        'Latest payment notice, amount, due date or existing funding arrangements',
    },
    {
      id: 'priorities',
      label: 'Client priorities',
      question:
        'Income needs, comfort with equities and priorities for inherited holdings',
    },
    {
      id: 'owner',
      label: 'Who will confirm',
      question: 'Authorised adviser or team responsible for clarification',
    },
    {
      id: 'followup',
      label: 'Next contact',
      question: 'Explicit follow-up date or meeting arrangement',
    },
  ],
  retirement: [
    {
      id: 'budget',
      label: 'Current spending',
      question: 'Current annual spending amount, currency and effective date',
    },
    {
      id: 'expenses',
      label: 'Budget includes',
      question: 'Medical costs, one-off costs and expense frequency',
    },
    {
      id: 'owner',
      label: 'Who will confirm',
      question: 'Client or authorised contact responsible for clarification',
    },
    {
      id: 'followup',
      label: 'Next contact',
      question: 'Explicit follow-up date or meeting arrangement',
    },
  ],
};
export const extractionSchema = z
  .object({
    items: z
      .array(
        z
          .object({ fieldId: z.string(), quote: z.string().min(1).max(2000) })
          .strict(),
      )
      .max(4),
  })
  .strict();
export type Extracted = z.infer<typeof extractionSchema>;
export function validateExtraction(
  value: unknown,
  note: string,
  type: Review['type'],
): Extracted {
  const out = extractionSchema.parse(value);
  const seen = new Set<string>();
  for (const item of out.items) {
    if (
      !intakeFields[type].some((f) => f.id === item.fieldId) ||
      seen.has(item.fieldId)
    )
      throw new Error('Invalid or duplicate field');
    if (!note.includes(item.quote))
      throw new Error('Extracted text is not in the note');
    seen.add(item.fieldId);
  }
  return out;
}
export const hasCredential = (text: string) =>
  /sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{16,}|-----BEGIN .*PRIVATE KEY-----/i.test(
    text,
  );
export function sourceSummary(review: Review) {
  const m = (n: number, c = 'USD') =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: c,
      maximumFractionDigits: 2,
    }).format(n);
  if (review.type === 'funding')
    return [
      'The supplied records contain university instalments and private-equity capital calls; the next confirmed amount and date still need checking.',
      'The SGD deposit has monthly access and the private-credit fund has a quarterly gate. A redemption request is not confirmed proceeds.',
    ];
  if (review.type === 'inheritance') {
    const e = review.allocation.find((a) => a.assetClass === 'Equity');
    return [
      `The supplied portfolio has ${e?.weight.toFixed(2)}% in equities against a supplied maximum of ${e?.max}%. This calls for a review of your preferences before any changes.`,
      ...review.obligations.map(
        (o) =>
          `The recorded ${o.description.toLowerCase()} is ${m(o.amount!, o.currency)}; its current payment arrangements need confirmation.`,
      ),
    ];
  }
  return review.facts
    .filter((f) => f.id !== 'portfolio-value')
    .map(
      (f) => `${f.label}: ${f.currency ? m(f.value, f.currency) : f.value}.`,
    );
}
export function composeIntakeDraft(
  review: Review,
  values: Record<string, string>,
): string {
  const known = sourceSummary(review);
  const provided = intakeFields[review.type].filter((f) =>
    values[f.id]?.trim(),
  );
  const missing = intakeFields[review.type].filter(
    (f) => !values[f.id]?.trim(),
  );
  return [
    `Your review: ${review.title}`,
    'From the supplied records (' + review.asOf + ')',
    ...known,
    ...(provided.length
      ? [
          'Points recorded from our latest conversation',
          ...provided.map((f) => `${f.label}: ${values[f.id].trim()}`),
        ]
      : []),
    'What we need to confirm next',
    ...missing.map((f) => f.question + ' remains to be confirmed.'),
    'We will check these details against the relevant records before discussing funding arrangements or portfolio changes. The meeting note does not replace the supplied records.',
    'Please let us know if any recorded point needs correcting.',
  ].join('\n\n');
}
