import rateLimit from 'express-rate-limit';

export const redeemRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    code: 'TOO_MANY_REQUESTS',
    message: 'Too many redeem attempts. Please try again later.',
  },
});
