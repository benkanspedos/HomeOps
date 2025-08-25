import { Router } from 'express';
import { authRouter } from './auth/auth.routes';
import { accountsRouter } from './accounts/accounts.routes';
import { servicesRouter } from './services/services.routes';
import { alertsRouter } from './alerts/alerts.routes';
import { healthRouter } from './health/health.routes';
import { authenticate } from '../middleware/auth';

export const apiRouter = Router();

// Public routes
apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);

// Protected routes (require authentication)
apiRouter.use('/accounts', authenticate, accountsRouter);
apiRouter.use('/services', authenticate, servicesRouter);
apiRouter.use('/alerts', authenticate, alertsRouter);

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
      },
    },
  });
});