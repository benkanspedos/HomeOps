import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { AppError } from '../utils/errors';

interface RateLimiterOptions {
  windowMs?: number;
  max?: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export const rateLimiter = (options: RateLimiterOptions = {}): RateLimitRequestHandler => {
  return rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000, // 15 minutes default
    max: options.max || 100, // Limit each IP to 100 requests per windowMs
    message: options.message || 'Too many requests, please try again later.',
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    skipFailedRequests: options.skipFailedRequests || false,
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req, res) => {
      throw new AppError(
        options.message || 'Too many requests, please try again later.',
        429
      );
    }
  });
};

// Pre-configured rate limiters for different use cases
export const strictRateLimit = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many attempts, please try again later.'
});

export const moderateRateLimit = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: 'Too many requests, please slow down.'
});

export const lightRateLimit = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: 'Request limit exceeded, please wait before trying again.'
});