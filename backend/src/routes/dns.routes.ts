import { Router } from 'express';
import { DNSController } from '../controllers/dns.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();
const dnsController = new DNSController();

// Public status endpoint for testing (no auth required)
router.get('/status', dnsController.getStatus);

// Apply authentication middleware to protected DNS routes
router.use(authMiddleware);
router.get('/performance', dnsController.getPerformance);
router.get('/stats/history', dnsController.getHistoricalStats);

// Query endpoints (moderate rate limiting)
router.get('/queries', rateLimiter({ windowMs: 60000, max: 30 }), dnsController.getQueries);
router.get('/top-queries', rateLimiter({ windowMs: 60000, max: 30 }), dnsController.getTopQueries);
router.get('/top-blocked', rateLimiter({ windowMs: 60000, max: 30 }), dnsController.getTopBlocked);

// Domain management endpoints (strict rate limiting for mutations)
router.get('/domains', rateLimiter({ windowMs: 60000, max: 60 }), dnsController.getDomains);
router.post('/domains', rateLimiter({ windowMs: 60000, max: 10 }), dnsController.addDomain);
router.delete('/domains/:domain', rateLimiter({ windowMs: 60000, max: 10 }), dnsController.removeDomain);
router.put('/domains/:domain/block', rateLimiter({ windowMs: 60000, max: 10 }), dnsController.blockDomain);

// Blocking control endpoint (very strict rate limiting)
router.post('/blocking', rateLimiter({ windowMs: 60000, max: 5 }), dnsController.setBlocking);

export default router;