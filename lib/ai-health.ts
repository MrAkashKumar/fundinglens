export type AIHealth = {
  configured: boolean;
  verified: boolean;
  status: 'available' | 'not_configured' | 'unavailable';
  checkedAt: string | null;
};
export async function checkAIHealth(
  configured: boolean,
  probe: () => Promise<unknown>,
): Promise<AIHealth> {
  if (!configured)
    return {
      configured: false,
      verified: false,
      status: 'not_configured',
      checkedAt: null,
    };
  try {
    await probe();
    return {
      configured: true,
      verified: true,
      status: 'available',
      checkedAt: new Date().toISOString(),
    };
  } catch {
    return {
      configured: true,
      verified: false,
      status: 'unavailable',
      checkedAt: new Date().toISOString(),
    };
  }
}
