import { env } from 'cloudflare:workers';
import OpenAI from 'openai';
import { checkAIHealth, type AIHealth } from '@/lib/ai-health';
let cached:
  | {
      key: string;
      model: string;
      baseURL: string | undefined;
      expires: number;
      result: AIHealth;
    }
  | undefined;
export async function GET() {
  const bindings = env as unknown as Record<string, string | undefined>;
  const key = bindings.OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';
  const model =
    bindings.OPENAI_MODEL || process.env.OPENAI_MODEL || 'gpt-5.4-mini';
  const baseURL = bindings.OPENAI_BASE_URL || process.env.OPENAI_BASE_URL;
  if (
    cached &&
    cached.key === key &&
    cached.model === model &&
    cached.baseURL === baseURL &&
    cached.expires > Date.now()
  )
    return Response.json(cached.result, {
      headers: { 'Cache-Control': 'no-store' },
    });
  const result = await checkAIHealth(Boolean(key), async () => {
    if (baseURL && new URL(baseURL).protocol !== 'https:')
      throw new Error('Invalid configuration');
    const client = new OpenAI({
      apiKey: key,
      baseURL,
      maxRetries: 0,
      timeout: 5000,
    });
    await client.models.retrieve(model);
  });
  cached = {
    key,
    model,
    baseURL,
    result,
    expires: Date.now() + (result.verified ? 300000 : 30000),
  };
  return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
}
