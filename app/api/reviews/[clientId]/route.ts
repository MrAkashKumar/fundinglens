import { data } from '@/lib/data';
import { buildReview, ReviewError } from '@/lib/reviews';
export async function GET(
  request: Request,
  context: { params: Promise<{ clientId: string }> },
) {
  try {
    const { clientId } = await context.params;
    const query = new URL(request.url).searchParams;
    return Response.json(
      buildReview(data, clientId, query.get('start') || undefined),
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof ReviewError
            ? e.message
            : 'Unable to load the source records.',
      },
      { status: e instanceof ReviewError ? e.status : 500 },
    );
  }
}
