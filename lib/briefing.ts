import { z } from 'zod';
import type { Briefing, DraftContent, Review, Revision } from './types';
const statement = z
  .object({
    text: z.string().min(8).max(1200),
    evidenceIds: z.array(z.string()).min(1).max(80),
  })
  .strict();
export const draftSchema = z
  .object({
    opening: statement,
    whyItMatters: statement,
    questions: z.array(statement).min(1).max(3),
    nextStep: statement,
    caveat: statement,
  })
  .strict();
export function statements(content: DraftContent) {
  return [
    content.opening,
    content.whyItMatters,
    ...content.questions,
    content.nextStep,
    content.caveat,
  ];
}
export function validateDraft(value: unknown, review: Review) {
  const parsed = draftSchema.parse(value);
  const ids = new Set(review.evidence.map((s) => s.id));
  for (const s of statements(parsed)) {
    if (s.evidenceIds.some((id) => !ids.has(id)))
      throw new Error('Unknown evidence reference');
    if (
      /\d|[%$€£]|\b(million|billion|thousand|percent|guaranteed|guarantee|legally compliant|must sell|cannot pay)\b/i.test(
        s.text,
      )
    )
      throw new Error('Unsupported quantity or conclusion');
  }
  return parsed;
}
export const draftText = (d: DraftContent) =>
  [
    d.opening.text,
    d.whyItMatters.text,
    ...d.questions.map((q) => q.text),
    d.nextStep.text,
    d.caveat.text,
  ].join('\n\n');
export function fallback(review: Review, reason: string): Briefing {
  return {
    clientId: review.clientId,
    inputVersion: review.inputVersion,
    mode: 'template_fallback',
    fallbackReason: reason,
    content: review.template,
    factIds: review.facts
      .filter((f) => f.id !== 'portfolio-value')
      .map((f) => f.id),
  };
}
export function editRevision(current: Revision, text: string): Revision {
  if (text === current.text) return current;
  return {
    ...current,
    id: crypto.randomUUID(),
    revision: current.revision + 1,
    text,
    status: 'draft',
    reviewedAt: undefined,
    updatedAt: new Date().toISOString(),
  };
}
export function reviewRevision(
  current: Revision,
  inputVersion: string,
): Revision {
  if (
    !current.text.trim() ||
    current.status === 'rejected' ||
    current.inputVersion !== inputVersion
  )
    throw new Error('Current draft must be valid before review.');
  return {
    ...current,
    status: 'reviewed',
    reviewedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
export function canPreview(
  current: Revision | null,
  review: Pick<Review, 'clientId' | 'inputVersion'>,
) {
  return Boolean(
    current &&
    current.status === 'reviewed' &&
    current.text.trim() &&
    current.clientId === review.clientId &&
    current.inputVersion === review.inputVersion,
  );
}
export const revisionSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  inputVersion: z.string(),
  revision: z.number().int().positive(),
  text: z.string(),
  mode: z.enum(['live_ai', 'template_fallback']),
  fallbackReason: z.string().optional(),
  status: z.enum(['draft', 'reviewed', 'rejected']),
  updatedAt: z.string(),
  reviewedAt: z.string().optional(),
  evidenceIds: z.array(z.string()),
});
