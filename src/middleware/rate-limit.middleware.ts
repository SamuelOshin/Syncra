import { Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { errorResponse } from '../utils/response';

function rateLimitHandler(req: Request, res: Response): void {
  errorResponse(
    res,
    429,
    'Too many requests. Please wait a moment and try again.',
    'RATE_LIMIT_EXCEEDED',
    {}
  );
}

export const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: rateLimitHandler,
});

export const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

export const publicVerifyLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});
