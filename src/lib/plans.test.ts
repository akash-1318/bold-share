import { describe, it, expect } from 'vitest';
import { getLimitBytes, hasQuota, FREE_LIMIT_BYTES, PREMIUM_LIMIT_BYTES } from './plans';

describe('getLimitBytes', () => {
  it('returns the free limit for free status', () => {
    expect(getLimitBytes('free')).toBe(FREE_LIMIT_BYTES);
  });

  it('returns the premium limit for active status', () => {
    expect(getLimitBytes('active')).toBe(PREMIUM_LIMIT_BYTES);
  });

  it('returns the free limit for past_due or canceled status', () => {
    expect(getLimitBytes('past_due')).toBe(FREE_LIMIT_BYTES);
    expect(getLimitBytes('canceled')).toBe(FREE_LIMIT_BYTES);
  });
});

describe('hasQuota', () => {
  it('allows an upload that fits within the limit', () => {
    expect(hasQuota(10 * 1024 * 1024, 20 * 1024 * 1024, 'free')).toBe(true);
  });

  it('rejects an upload that would exceed the limit', () => {
    expect(hasQuota(45 * 1024 * 1024, 10 * 1024 * 1024, 'free')).toBe(false);
  });

  it('allows an upload that exactly fills the remaining quota', () => {
    expect(hasQuota(0, FREE_LIMIT_BYTES, 'free')).toBe(true);
  });

  it('uses the premium limit for an active subscription', () => {
    expect(hasQuota(900 * 1024 * 1024, 100 * 1024 * 1024, 'active')).toBe(true);
  });
});
