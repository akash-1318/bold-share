export const FREE_LIMIT_BYTES = 50 * 1024 * 1024;
export const PREMIUM_LIMIT_BYTES = 1024 * 1024 * 1024;

export type SubscriptionStatus = 'free' | 'active' | 'past_due' | 'canceled';

export function getLimitBytes(status: SubscriptionStatus): number {
  return status === 'active' ? PREMIUM_LIMIT_BYTES : FREE_LIMIT_BYTES;
}

export function hasQuota(usageBytes: number, incomingBytes: number, status: SubscriptionStatus): boolean {
  return usageBytes + incomingBytes <= getLimitBytes(status);
}
