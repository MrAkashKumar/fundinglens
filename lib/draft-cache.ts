import type { Briefing } from './types';
const pending = new Map<string, Promise<Briefing>>();
const recent = new Map<string, { expires: number; value: Briefing }>();
// Synthetic, fixed-case drafts only. Never cache client-entered communication text.
// Per-isolate reuse and deduplication reduce repeats; this is not a global spending cap.
export async function reuseDraft(
  key: string,
  generate: () => Promise<Briefing>,
): Promise<Briefing> {
  const cached = recent.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;
  const running = pending.get(key);
  if (running) return running;
  const job = generate()
    .then((value) => {
      if (recent.size >= 40) recent.delete(recent.keys().next().value!);
      recent.set(key, {
        value,
        expires: Date.now() + (value.mode === 'live_ai' ? 86400000 : 60000),
      });
      return value;
    })
    .finally(() => pending.delete(key));
  pending.set(key, job);
  return job;
}
