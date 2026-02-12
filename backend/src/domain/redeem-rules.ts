import { isStale } from '../utils/time.js';

export type RedeemCheckInput = {
  isActive: boolean;
  expiresAt: Date | null;
  usedCount: number;
  maxUses: number;
  isOneTime: boolean;
};

export function evaluateRedeemEligibility(input: RedeemCheckInput): { ok: true } | { ok: false; reason: string } {
  if (!input.isActive) {
    return { ok: false, reason: 'CODE_DISABLED' };
  }

  if (input.expiresAt && input.expiresAt.getTime() <= Date.now()) {
    return { ok: false, reason: 'CODE_EXPIRED' };
  }

  if (input.isOneTime && input.usedCount > 0) {
    return { ok: false, reason: 'CODE_ALREADY_USED' };
  }

  if (input.usedCount >= input.maxUses) {
    return { ok: false, reason: 'CODE_USAGE_LIMIT' };
  }

  return { ok: true };
}

export function allowConcurrentSession(lastSeen: Date, staleSeconds: number, now = new Date()): boolean {
  return isStale(lastSeen, staleSeconds, now);
}
