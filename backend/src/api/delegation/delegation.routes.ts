import { Router, Request, Response } from 'express';
import { DelegationService } from '../../services/delegation/delegation-service.js';
import { logger } from '../../utils/logger.js';

const router = Router();

// Global delegation service instance
let delegationService: DelegationService | null = null;

// Initialize delegation service
const initializeDelegationService = () => {
  if (!delegationService) {
    const redisOptions = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6380'),
      password: process.env.REDIS_PASSWORD || 'homeops123',
    };
    
    delegationService = new DelegationService(redisOptions);
    
    // Start the service
    delegationService.start().catch(error => {
      logger.error('Failed to start delegation service:', error);
    });
    
    logger.info('Delegation service initialized');
  }
  
  return delegationService;
};

// Simple bypass for health endpoints (can be made public)
const bypassAuth = (req: Request, res: Response, next: any) => {
  next();
};

// Middleware to ensure delegation service is available
const ensureDelegationService = (req: Request, res: Response, next: any) => {
  try {
    const service = initializeDelegationService();
    if (!service.isRunning()) {
      return res.status(503).json({ 
        error: 'Delegation service is not running',
        code: 'SERVICE_UNAVAILABLE'
      });
    }
    (req as any).delegationService = service;
    next();
  } catch (error) {
    logger.error('Delegation service middleware error:', error);
    res.status(500).json({ 
      error: 'Failed to initialize delegation service',
      code: 'INITIALIZATION_ERROR'
    });
  }
};

// Health check endpoint
router.get('/health', ensureDelegationService, async (req: Request, res: Response) => {
  try {
    const service = (req as any).delegationService as DelegationService;
    const healthCheck = await service.performHealthCheck();
    
    res.status(healthCheck.status === 'healthy' ? 200 : 503).json(healthCheck);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({ 
      error: 'Health check failed',
      code: 'HEALTH_CHECK_ERROR'
    });
  }
});

// System status
router.get('/status', ensureDelegationService, async (req: Request, res: Response) => {
  try {
    const service = (req as any).delegationService as DelegationService;
    const status = service.getStatus();
    
    res.json(status);
  } catch (error) {
    logger.error('Status check failed:', error);
    res.status(500).json({ 
      error: 'Status check failed',
      code: 'STATUS_ERROR'
    });
  }
});

// System statistics
router.get('/stats', ensureDelegationService, async (req: Request, res: Response) => {
  try {
    const service = (req as any).delegationService as DelegationService;
    const stats = await service.getStats();
    
    res.json(stats);
  } catch (error) {
    logger.error('Stats retrieval failed:', error);
    res.status(500).json({ 
      error: 'Stats retrieval failed',
      code: 'STATS_ERROR'
    });
  }
});

// Agents endpoints
router.get('/agents', ensureDelegationService, async (req: Request, res: Response) => {
  try {
    const service = (req as any).delegationService as DelegationService;
    const agents = await service.getAllAgents();
    
    res.json(agents);
  } catch (error) {
    logger.error('Failed to fetch agents:', error);
    res.status(500).json({ 
      error: 'Failed to fetch agents',
      code: 'AGENTS_FETCH_ERROR'
    });
  }
});

router.get('/agents/connected', ensureDelegationService, async (req: Request, res: Response) => {
  try {
    const service = (req as any).delegationService as DelegationService;
    const agents = await service.getConnectedAgents();
    
    res.json(agents);
  } catch (error) {
    logger.error('Failed to fetch connected agents:', error);
    res.status(500).json({ 
      error: 'Failed to fetch connected agents',
      code: 'CONNECTED_AGENTS_ERROR'
    });
  }
});

router.get('/agents/:agentId', ensureDelegationService, async (req: Request, res: Response) => {
  try {
    const service = (req as any).delegationService as DelegationService;
    const { agentId } = req.params;
    
    const agent = service.getAgent(agentId);
    
    if (!agent) {
      return res.status(404).json({ 
        error: 'Agent not found',
        code: 'AGENT_NOT_FOUND'
      });
    }
    
    res.json(agent);
  } catch (error) {
    logger.error('Failed to fetch agent:', error);
    res.status(500).json({ 
      error: 'Failed to fetch agent',
      code: 'AGENT_FETCH_ERROR'
    });
  }
});

router.get('/capabilities', ensureDelegationService, async (req: Request, res: Response) => {
  try {
    const service = (req as any).delegationService as DelegationService;
    const capabilities = service.getAvailableCapabilities();
    
    res.json({ capabilities });
  } catch (error) {
    logger.error('Failed to fetch capabilities:', error);
    res.status(500).json({ 
      error: 'Failed to fetch capabilities',
      code: 'CAPABILITIES_ERROR'
    });
  }
});

// Tasks endpoints
router.post('/tasks', ensureDelegationService, async (req: Request, res: Response) => {
  try {
    const service = (req as any).delegationService as DelegationService;
    const taskData = req.body;
    
    // Validate required fields
    if (!taskData.name) {
      return res.status(400).json({ 
        error: 'Task name is required',
        code: 'VALIDATION_ERROR'
      });
    }
    
    const taskId = await service.submitTask(taskData);
    
    res.status(201).json({ 
      taskId,
      message: 'Task submitted successfully'
    });
  } catch (error) {
    logger.error('Failed to submit task:', error);
    res.status(500).json({ 
      error: 'Failed to submit task',
      code: 'TASK_SUBMIT_ERROR'
    });
  }
});

router.get('/tasks', ensureDelegationService, async (req: Request, res: Response) => {
  try {
    const service = (req as any).delegationService as DelegationService;
    const stats = await service.getStats();
    
    // For now, return task counts from stats
    // In a full implementation, you'd fetch actual task details
    const tasks = {
      pending: stats.queue.pending,
      inProgress: stats.queue.inProgress,
      completed: stats.queue.completed,
      failed: stats.queue.failed,
      total: stats.queue.pending + stats.queue.inProgress + stats.queue.completed + stats.queue.failed
    };
    
    res.json(tasks);
  } catch (error) {
    logger.error('Failed to fetch tasks:', error);
    res.status(500).json({ 
      error: 'Failed to fetch tasks',
      code: 'TASKS_FETCH_ERROR'
    });
  }
});

router.get('/tasks/:taskId', ensureDelegationService, async (req: Request, res: Response) => {
  try {
    const service = (req as any).delegationService as DelegationService;
    const { taskId } = req.params;
    
    const task = await service.getTask(taskId);
    
    if (!task) {
      return res.status(404).json({ 
        error: 'Task not found',
        code: 'TASK_NOT_FOUND'
      });
    }
    
    res.json(task);
  } catch (error) {
    logger.error('Failed to fetch task:', error);
    res.status(500).json({ 
      error: 'Failed to fetch task',
      code: 'TASK_FETCH_ERROR'
    });
  }
});

router.get('/tasks/:taskId/progress', ensureDelegationService, async (req: Request, res: Response) => {
  try {
    const service = (req as any).delegationService as DelegationService;
    const { taskId } = req.params;
    
    const progress = service.getTaskProgress(taskId);
    
    res.json({
      taskId,
      progress: progress || [],
      latest: service.getLatestTaskProgress(taskId)
    });
  } catch (error) {
    logger.error('Failed to fetch task progress:', error);
    res.status(500).json({ 
      error: 'Failed to fetch task progress',
      code: 'TASK_PROGRESS_ERROR'
    });
  }
});

// Errors endpoints
router.get('/errors', ensureDelegationService, async (req: Request, res: Response) => {
  try {
    const service = (req as any).delegationService as DelegationService;
    const errors = service.getUnresolvedErrors();
    
    res.json(errors);
  } catch (error) {
    logger.error('Failed to fetch errors:', error);
    res.status(500).json({ 
      error: 'Failed to fetch errors',
      code: 'ERRORS_FETCH_ERROR'
    });
  }
});

router.get('/errors/task/:taskId', ensureDelegationService, async (req: Request, res: Response) => {
  try {
    const service = (req as any).delegationService as DelegationService;
    const { taskId } = req.params;
    
    const errors = service.getErrorsByTask(taskId);
    
    res.json(errors);
  } catch (error) {
    logger.error('Failed to fetch task errors:', error);
    res.status(500).json({ 
      error: 'Failed to fetch task errors',
      code: 'TASK_ERRORS_ERROR'
    });
  }
});

router.get('/errors/agent/:agentId', ensureDelegationService, async (req: Request, res: Response) => {
  try {
    const service = (req as any).delegationService as DelegationService;
    const { agentId } = req.params;
    
    const errors = service.getErrorsByAgent(agentId);
    
    res.json(errors);
  } catch (error) {
    logger.error('Failed to fetch agent errors:', error);
    res.status(500).json({ 
      error: 'Failed to fetch agent errors',
      code: 'AGENT_ERRORS_ERROR'
    });
  }
});

// System management endpoints
router.post('/restart', ensureDelegationService, async (req: Request, res: Response) => {
  try {
    const service = (req as any).delegationService as DelegationService;
    
    logger.info('Restarting delegation service...');
    
    await service.stop();
    await service.start();
    
    res.json({ 
      message: 'Delegation service restarted successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to restart delegation service:', error);
    res.status(500).json({ 
      error: 'Failed to restart delegation service',
      code: 'RESTART_ERROR'
    });
  }
});

// Routing rules management
router.get('/routing/rules', ensureDelegationService, async (req: Request, res: Response) => {
  try {
    const service = (req as any).delegationService as DelegationService;
    const rules = service.getRoutingRules();
    
    res.json(rules);
  } catch (error) {
    logger.error('Failed to fetch routing rules:', error);
    res.status(500).json({ 
      error: 'Failed to fetch routing rules',
      code: 'ROUTING_RULES_ERROR'
    });
  }
});

router.post('/routing/rules/:ruleId/enable', ensureDelegationService, async (req: Request, res: Response) => {
  try {
    const service = (req as any).delegationService as DelegationService;
    const { ruleId } = req.params;
    
    const success = service.enableRoutingRule(ruleId);
    
    if (!success) {
      return res.status(404).json({ 
        error: 'Routing rule not found',
        code: 'RULE_NOT_FOUND'
      });
    }
    
    res.json({ 
      message: 'Routing rule enabled successfully',
      ruleId
    });
  } catch (error) {
    logger.error('Failed to enable routing rule:', error);
    res.status(500).json({ 
      error: 'Failed to enable routing rule',
      code: 'RULE_ENABLE_ERROR'
    });
  }
});

router.post('/routing/rules/:ruleId/disable', ensureDelegationService, async (req: Request, res: Response) => {
  try {
    const service = (req as any).delegationService as DelegationService;
    const { ruleId } = req.params;
    
    const success = service.disableRoutingRule(ruleId);
    
    if (!success) {
      return res.status(404).json({ 
        error: 'Routing rule not found',
        code: 'RULE_NOT_FOUND'
      });
    }
    
    res.json({ 
      message: 'Routing rule disabled successfully',
      ruleId
    });
  } catch (error) {
    logger.error('Failed to disable routing rule:', error);
    res.status(500).json({ 
      error: 'Failed to disable routing rule',
      code: 'RULE_DISABLE_ERROR'
    });
  }
});

// WebSocket info (for client connections)
router.get('/websocket/info', ensureDelegationService, async (req: Request, res: Response) => {
  try {
    const service = (req as any).delegationService as DelegationService;
    const config = service.getConfig();
    
    res.json({
      port: config.websocket.port,
      path: config.websocket.path,
      url: `ws://localhost:${config.websocket.port}${config.websocket.path}`,
      maxConnections: config.websocket.maxConnections,
      pingInterval: config.websocket.pingInterval
    });
  } catch (error) {
    logger.error('Failed to get WebSocket info:', error);
    res.status(500).json({ 
      error: 'Failed to get WebSocket info',
      code: 'WEBSOCKET_INFO_ERROR'
    });
  }
});

// Error handling middleware
router.use((error: Error, req: Request, res: Response, next: any) => {
  logger.error('Delegation API error:', error);
  
  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
  });
});

// Graceful shutdown handling
process.on('SIGINT', async () => {
  logger.info('Shutting down delegation service...');
  
  if (delegationService) {
    try {
      await delegationService.stop();
      logger.info('Delegation service shut down successfully');
    } catch (error) {
      logger.error('Error during delegation service shutdown:', error);
    }
  }
  
  process.exit(0);
});

export default router;