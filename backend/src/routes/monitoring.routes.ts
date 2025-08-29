import { Router } from 'express';
import { monitoringController } from '../controllers/monitoring.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Apply authentication to all monitoring routes (optional, can be removed for public access)
// router.use(authMiddleware);

// Health endpoints
router.get('/health/containers', 
  monitoringController.getContainersHealth.bind(monitoringController)
);

router.get('/health/containers/:containerId/logs',
  monitoringController.getContainerLogs.bind(monitoringController)
);

router.get('/health/metrics/:containerId',
  monitoringController.getContainerMetrics.bind(monitoringController)
);

router.get('/health/metrics/:containerId/current',
  monitoringController.getCurrentContainerMetrics.bind(monitoringController)
);

router.get('/health/system',
  monitoringController.getSystemHealth.bind(monitoringController)
);

// Real-time health stream (Server-Sent Events)
router.get('/health/stream',
  monitoringController.streamHealth.bind(monitoringController)
);

// Alert endpoints
router.post('/alerts/configure',
  rateLimiter({ windowMs: 60000, max: 10 }), // 10 requests per minute
  monitoringController.configureAlert.bind(monitoringController)
);

router.put('/alerts/:alertId',
  rateLimiter({ windowMs: 60000, max: 20 }), // 20 updates per minute
  monitoringController.updateAlert.bind(monitoringController)
);

router.delete('/alerts/:alertId',
  rateLimiter({ windowMs: 60000, max: 10 }), // 10 deletions per minute
  monitoringController.deleteAlert.bind(monitoringController)
);

router.get('/alerts/history',
  monitoringController.getAlertHistory.bind(monitoringController)
);

router.get('/alerts/templates',
  monitoringController.getAlertTemplates.bind(monitoringController)
);

router.post('/alerts/test/:channel',
  rateLimiter({ windowMs: 60000, max: 5 }), // 5 test alerts per minute
  monitoringController.testAlertChannel.bind(monitoringController)
);

// WebSocket endpoint for real-time updates (to be implemented with socket.io)
// This is a placeholder - actual WebSocket implementation requires socket.io setup
router.get('/ws', (req, res) => {
  res.json({
    message: 'WebSocket endpoint - connect using socket.io client',
    socketUrl: 'ws://localhost:3101',
    events: [
      'health:update',
      'metrics:update',
      'alert:triggered',
      'container:status-change'
    ]
  });
});

export default router;