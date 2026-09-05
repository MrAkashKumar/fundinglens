import { z } from 'zod';
import { env } from 'cloudflare:workers';
import { data } from '@/lib/data';
import { buildReview, ReviewError } from '@/lib/reviews';
import { generateBriefing } from '@/lib/llm';
import { reuseDraft } from '@/lib/draft-cache';
const requestSchema = z
  .object({
    clientId: z.string(),
    comparisonStart: z.string(),
    comparisonEnd: z.literal('2026-08-26'),
    inputVersion: z.string().min(1),
  })
  .strict();
export async function POST(request: Request) {
  // Same-origin browser requests only. No UI-controlled destination or credentials.
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin)
    return Response.json(
      { error: 'Cross-origin drafting is not allowed.' },
      { status: 403 },
    );
  try {
    const raw = await request.text();
    if (raw.length > 4096)
      return Response.json({ error: 'Request too large.' }, { status: 413 });
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return Response.json({ error: 'Invalid JSON.' }, { status: 400 });
    }
    const input = requestSchema.safeParse(parsed);
    if (!input.success)
      return Response.json(
        { error: 'Invalid briefing request.' },
        { status: 400 },
      );
    const review = buildReview(
      data,
      input.data.clientId,
      input.data.comparisonStart,
      input.data.comparisonEnd,
    );
    if (input.data.inputVersion !== review.inputVersion)
      return Response.json(
        { error: 'Source inputs changed. Reload the case before drafting.' },
        { status: 409 },
      );
    const bindings = env as unknown as Record<string, string | undefined>;
    const result = await reuseDraft(
      review.inputVersion +
        (bindings.OPENAI_MODEL || process.env.OPENAI_MODEL || 'default'),
      () =>
        generateBriefing(review, {
          key: bindings.OPENAI_API_KEY || process.env.OPENAI_API_KEY,
          model: bindings.OPENAI_MODEL || process.env.OPENAI_MODEL,
          baseURL: bindings.OPENAI_BASE_URL || process.env.OPENAI_BASE_URL,
        }),
    );
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof ReviewError
            ? e.message
            : 'Unable to prepare this review.',
      },
      { status: e instanceof ReviewError ? e.status : 500 },
    );
  }
}
