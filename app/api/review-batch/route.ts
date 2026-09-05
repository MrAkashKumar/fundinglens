import { data } from '@/lib/data';
import { buildReview, CASES } from '@/lib/reviews';
export function GET() {
  const items = CASES.map((c) => {
    try {
      const review = buildReview(data, c.id);
      return {
        clientId: c.id,
        name: review.client.name,
        title: review.title,
        status: review.status,
        question: review.question,
        sourceCount: review.evidence.length,
        error: null,
      };
    } catch {
      return {
        clientId: c.id,
        name: c.short,
        title: c.title,
        status: 'Source issue',
        question: 'Correct the source records before preparing this review.',
        sourceCount: 0,
        error: 'Review unavailable',
      };
    }
  });
  return Response.json(
    { items, holdingsRows: data.holdings.length, asOf: '2026-08-26' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
