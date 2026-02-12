import { describe, expect, it } from 'vitest';
import { allowConcurrentSession, evaluateRedeemEligibility } from '../src/domain/redeem-rules.js';

describe('evaluateRedeemEligibility', () => {
  it('accepts a valid one-time code before first use', () => {
    const result = evaluateRedeemEligibility({
      isActive: true,
      expiresAt: null,
      usedCount: 0,
      maxUses: 1,
      isOneTime: true,
    });

    expect(result).toEqual({ ok: true });
  });

  it('rejects one-time code after use', () => {
    const result = evaluateRedeemEligibility({
      isActive: true,
      expiresAt: null,
      usedCount: 1,
      maxUses: 1,
      isOneTime: true,
    });

    expect(result).toEqual({ ok: false, reason: 'CODE_ALREADY_USED' });
  });

  it('rejects expired code', () => {
    const result = evaluateRedeemEligibility({
      isActive: true,
      expiresAt: new Date(Date.now() - 1000),
      usedCount: 0,
      maxUses: 2,
      isOneTime: false,
    });

    expect(result).toEqual({ ok: false, reason: 'CODE_EXPIRED' });
  });
});

describe('allowConcurrentSession', () => {
  it('allows new session when old session is stale', () => {
    const now = new Date('2026-02-09T12:00:00.000Z');
    const oldLastSeen = new Date('2026-02-09T11:58:00.000Z');

    expect(allowConcurrentSession(oldLastSeen, 45, now)).toBe(true);
  });

  it('denies new session when old session is still active', () => {
    const now = new Date('2026-02-09T12:00:00.000Z');
    const oldLastSeen = new Date('2026-02-09T11:59:40.000Z');

    expect(allowConcurrentSession(oldLastSeen, 45, now)).toBe(false);
  });
});
