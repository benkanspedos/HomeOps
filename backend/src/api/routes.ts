import { Router } from 'express';
import { authRouter } from './auth/auth.routes';
import { accountsRouter } from './accounts/accounts.routes';
import { servicesRouter } from './services/services.routes';
import { alertsRouter } from './alerts/alerts.routes';
import { healthRouter } from './health/health.routes';
import nlpRouter from './nlp/nlp.routes';
import dnsRouter from '../routes/dns.routes';
import monitoringRouter from '../routes/monitoring.routes';
import { authenticate } from '../middleware/auth';
import { securityValidation } from '../middleware/validation';

export const apiRouter = Router();

// Public routes
apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);

// Apply security validation to all protected routes
apiRouter.use(securityValidation);

// Natural Language Processing routes (protected)
apiRouter.use('/nlp', nlpRouter);

// Protected routes (require authentication)
apiRouter.use('/accounts', authenticate, accountsRouter);
apiRouter.use('/services', authenticate, servicesRouter);
apiRouter.use('/alerts', authenticate, alertsRouter);
apiRouter.use('/dns', dnsRouter); // DNS routes already include auth middleware

// Monitoring routes (can be public or protected based on requirements)
apiRouter.use('/', monitoringRouter); // Monitoring endpoints at /api/health/*, /api/alerts/*

// API documentation endpoint
apiRouter.get('/', (req, res) => {
  res.json({
    name: 'HomeOps API',
    version: '1.0.0',
    endpoints: {
      public: {
        health: '/api/health',
        auth: {
          login: 'POST /api/auth/login',
          register: 'POST /api/auth/register',
          refresh: 'POST /api/auth/refresh',
          logout: 'POST /api/auth/logout',
        },
      },
      protected: {
        accounts: {
          list: 'GET /api/accounts',
          get: 'GET /api/accounts/:id',
          create: 'POST /api/accounts',
          update: 'PUT /api/accounts/:id',
          delete: 'DELETE /api/accounts/:id',
        },
        services: {
          list: 'GET /api/services',
          get: 'GET /api/services/:id',
          status: 'GET /api/services/:id/status',
          restart: 'POST /api/services/:id/restart',
          stop: 'POST /api/services/:id/stop',
        },
        alerts: {
          list: 'GET /api/alerts',
          get: 'GET /api/alerts/:id',
          create: 'POST /api/alerts',
          update: 'PUT /api/alerts/:id',
          delete: 'DELETE /api/alerts/:id',
          history: 'GET /api/alerts/:id/history',
        },
        dns: {
          status: 'GET /api/dns/status',
          performance: 'GET /api/dns/performance',
          domains: 'GET /api/dns/domains',
          addDomain: 'POST /api/dns/domains',
          removeDomain: 'DELETE /api/dns/domains/:domain',
          blockDomain: 'PUT /api/dns/domains/:domain/block',
          queries: 'GET /api/dns/queries',
          topQueries: 'GET /api/dns/top-queries',
          topBlocked: 'GET /api/dns/top-blocked',
          blocking: 'POST /api/dns/blocking',
          statsHistory: 'GET /api/dns/stats/history',
        },
        monitoring: {
          containers: 'GET /api/health/containers',
          containerLogs: 'GET /api/health/containers/:containerId/logs',
          containerMetrics: 'GET /api/health/metrics/:containerId',
          currentMetrics: 'GET /api/health/metrics/:containerId/current',
          systemHealth: 'GET /api/health/system',
          streamHealth: 'GET /api/health/stream (SSE)',
          configureAlert: 'POST /api/alerts/configure',
          updateAlert: 'PUT /api/alerts/:alertId',
          deleteAlert: 'DELETE /api/alerts/:alertId',
          alertHistory: 'GET /api/alerts/history',
          alertTemplates: 'GET /api/alerts/templates',
          testAlert: 'POST /api/alerts/test/:channel',
        },
        nlp: {
          chatMessage: 'POST /api/nlp/chat/message',
          voiceProcess: 'POST /api/nlp/voice/process',
          executeCommand: 'POST /api/nlp/command/execute',
          auditHistory: 'GET /api/nlp/audit/history/:userId',
          stats: 'GET /api/nlp/stats',
          health: 'GET /api/nlp/health',
        },
      },
    },
  });
});