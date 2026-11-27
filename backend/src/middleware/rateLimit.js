import rateLimit from 'express-rate-limit';

const passThrough = (_req, _res, next) => next();

const limiter = (windowMs, limit, message) =>
  rateLimit({ windowMs, limit, standardHeaders: 'draft-7', legacyHeaders: false, ...(message && { message: { error: message } }) });

export const apiLimiter = (enabled) => (enabled ? limiter(60 * 1000, 600) : passThrough);

export const authLimiter = (enabled) =>
  enabled ? limiter(15 * 60 * 1000, 30, 'Too many attempts, try again later') : passThrough;
