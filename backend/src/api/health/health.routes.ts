import { Router, Request, Response } from 'express';
import { healthMonitor } from '../../services/health-monitor.service';
import { alertService } from '../../services/alert.service';
import { logger } from '../../utils/logger';

export const healthRouter = Router();

// Basic health check
healthRouter.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
  });
});

// Container health overview
healthRouter.get('/containers', async (req: Request, res: Response) => {
  try {
    const { containerId } = req.query;
    const healthData = await healthMonitor.checkContainerHealth(containerId as string);
    
    res.json({
      success: true,
      data: {
        containers: healthData,
        total: healthData.length,
        running: healthData.filter(c => c.state === 'running').length,
        stopped: healthData.filter(c => c.state !== 'running').length,
        unhealthy: healthData.filter(c => c.healthStatus === 'unhealthy').length,
        lastCheck: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to get container health:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve container health',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Container metrics
healthRouter.get('/metrics', async (req: Request, res: Response) => {
  try {
    const { containerId } = req.query;
    const metrics = await healthMonitor.collectMetrics(containerId as string);
    
    res.json({
      success: true,
      data: {
        metrics,
        total: metrics.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to get container metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve container metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// System resource usage
healthRouter.get('/system', async (req: Request, res: Response) => {
  try {
    const systemMetrics = await healthMonitor.getResourceUsage();
    
    res.json({
      success: true,
      data: systemMetrics
    });
  } catch (error) {
    logger.error('Failed to get system metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve system metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Container metrics history
healthRouter.get('/history/:containerId', async (req: Request, res: Response) => {
  try {
    const { containerId } = req.params;
    const { hours = 24 } = req.query;
    
    if (!containerId) {
      return res.status(400).json({
        success: false,
        error: 'Container ID is required'
      });
    }
    
    const history = await healthMonitor.getMetricsHistory(containerId, Number(hours));
    
    res.json({
      success: true,
      data: {
        containerId,
        hours: Number(hours),
        metrics: history,
        total: history.length
      }
    });
  } catch (error) {
    logger.error(`Failed to get metrics history for ${req.params.containerId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve metrics history',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Container logs
healthRouter.get('/logs/:containerId', async (req: Request, res: Response) => {
  try {
    const { containerId } = req.params;
    const { lines = 100 } = req.query;
    
    if (!containerId) {
      return res.status(400).json({
        success: false,
        error: 'Container ID is required'
      });
    }
    
    const logs = await healthMonitor.getContainerLogs(containerId, Number(lines));
    
    res.json({
      success: true,
      data: {
        containerId,
        lines: Number(lines),
        logs,
        total: logs.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error(`Failed to get logs for ${req.params.containerId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve container logs',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Container uptime
healthRouter.get('/uptime/:containerId', async (req: Request, res: Response) => {
  try {
    const { containerId } = req.params;
    
    if (!containerId) {
      return res.status(400).json({
        success: false,
        error: 'Container ID is required'
      });
    }
    
    const uptime = await healthMonitor.getUptime(containerId);
    
    res.json({
      success: true,
      data: {
        containerId,
        uptimeSeconds: uptime,
        uptimeHours: Math.round((uptime / 3600) * 100) / 100,
        uptimeDays: Math.round((uptime / 86400) * 100) / 100,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error(`Failed to get uptime for ${req.params.containerId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve container uptime',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Alert configuration endpoints
healthRouter.get('/alerts', async (req: Request, res: Response) => {
  try {
    const { hours = 24, alertId } = req.query;
    const history = await alertService.getAlertHistory(Number(hours), alertId as string);
    
    res.json({
      success: true,
      data: {
        alerts: history,
        total: history.length,
        hours: Number(hours)
      }
    });
  } catch (error) {
    logger.error('Failed to get alert history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve alert history',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Test alert channel
healthRouter.post('/alerts/test', async (req: Request, res: Response) => {
  try {
    const { channel, config } = req.body;
    
    if (!channel || !config) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: channel and config'
      });
    }
    
    const result = await alertService.testAlertChannel(channel, config);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Failed to test alert channel:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test alert channel',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Health summary for dashboard
healthRouter.get('/summary', async (req: Request, res: Response) => {
  try {
    const [containers, systemMetrics] = await Promise.all([
      healthMonitor.checkContainerHealth(),
      healthMonitor.getResourceUsage()
    ]);
    
    const summary = {
      containers: {
        total: containers.length,
        running: containers.filter(c => c.state === 'running').length,
        stopped: containers.filter(c => c.state !== 'running').length,
        unhealthy: containers.filter(c => c.healthStatus === 'unhealthy').length,
        restarting: containers.filter(c => c.restartCount > 5).length
      },
      system: {
        cpu: systemMetrics.totalCPU,
        memory: systemMetrics.memoryPercent,
        disk: systemMetrics.diskPercent,
        uptime: process.uptime()
      },
      timestamp: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    logger.error('Failed to get health summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve health summary',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});