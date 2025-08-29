import { Request, Response, NextFunction } from 'express';
import { healthMonitor } from '../services/health-monitor.service';
import { alertService, AlertChannel, AlertMetricType, AlertPriority, ComparisonOperator } from '../services/alert.service';
import Joi from 'joi';

export class MonitoringController {
  /**
   * Get health status of all containers
   * GET /api/health/containers
   */
  async getContainersHealth(req: Request, res: Response, next: NextFunction) {
    try {
      const containerId = req.query.containerId as string | undefined;
      const health = await healthMonitor.checkContainerHealth(containerId);
      
      // Group by status
      const summary = {
        total: health.length,
        running: health.filter(h => h.state === 'running').length,
        stopped: health.filter(h => h.state === 'exited' || h.state === 'dead').length,
        unhealthy: health.filter(h => h.healthStatus === 'unhealthy').length,
        containers: health
      };
      
      res.json({
        success: true,
        data: summary,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get metrics history for a specific container
   * GET /api/health/metrics/:containerId
   */
  async getContainerMetrics(req: Request, res: Response, next: NextFunction) {
    try {
      const { containerId } = req.params;
      const hours = parseInt(req.query.hours as string) || 24;
      
      if (!containerId) {
        return res.status(400).json({
          success: false,
          error: 'Container ID is required'
        });
      }
      
      const metrics = await healthMonitor.getMetricsHistory(containerId, hours);
      
      res.json({
        success: true,
        data: {
          containerId,
          hours,
          count: metrics.length,
          metrics
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current metrics for a specific container
   * GET /api/health/metrics/:containerId/current
   */
  async getCurrentContainerMetrics(req: Request, res: Response, next: NextFunction) {
    try {
      const { containerId } = req.params;
      
      const metrics = await healthMonitor.collectMetrics(containerId);
      
      if (metrics.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Container not found or not running'
        });
      }
      
      res.json({
        success: true,
        data: metrics[0]
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get system-wide resource usage
   * GET /api/health/system
   */
  async getSystemHealth(req: Request, res: Response, next: NextFunction) {
    try {
      const systemMetrics = await healthMonitor.getResourceUsage();
      
      res.json({
        success: true,
        data: systemMetrics
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get container logs
   * GET /api/health/containers/:containerId/logs
   */
  async getContainerLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const { containerId } = req.params;
      const lines = parseInt(req.query.lines as string) || 100;
      
      const logs = await healthMonitor.getContainerLogs(containerId as string, lines);
      
      res.json({
        success: true,
        data: {
          containerId,
          lines: logs.length,
          logs
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Configure alert thresholds and channels
   * POST /api/alerts/configure
   */
  async configureAlert(req: Request, res: Response, next: NextFunction) {
    try {
      // Validate request body
      const schema = Joi.object({
        name: Joi.string().required().min(3).max(100),
        enabled: Joi.boolean().default(true),
        containerId: Joi.string().optional(),
        containerName: Joi.string().optional(),
        metricType: Joi.string().valid(...Object.values(AlertMetricType)).required(),
        thresholdValue: Joi.number().required(),
        comparisonOperator: Joi.string().valid(...Object.values(ComparisonOperator)).required(),
        channels: Joi.array().items(
          Joi.object({
            type: Joi.string().valid(...Object.values(AlertChannel)).required(),
            config: Joi.object().required(),
            enabled: Joi.boolean().default(true)
          })
        ).min(1).required(),
        priority: Joi.string().valid(...Object.values(AlertPriority)).default(AlertPriority.MEDIUM),
        cooldownMinutes: Joi.number().min(1).max(1440).optional(),
        description: Joi.string().max(500).optional()
      });
      
      const { error, value } = schema.validate(req.body);
      
      if (error) {
        return res.status(400).json({
          success: false,
          error: error.details[0].message
        });
      }
      
      const alertId = await alertService.configureAlert(value);
      
      res.status(201).json({
        success: true,
        data: {
          alertId,
          message: 'Alert configured successfully'
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update alert configuration
   * PUT /api/alerts/:alertId
   */
  async updateAlert(req: Request, res: Response, next: NextFunction) {
    try {
      const { alertId } = req.params;
      
      const schema = Joi.object({
        name: Joi.string().min(3).max(100),
        enabled: Joi.boolean(),
        containerId: Joi.string().allow(null),
        containerName: Joi.string().allow(null),
        metricType: Joi.string().valid(...Object.values(AlertMetricType)),
        thresholdValue: Joi.number(),
        comparisonOperator: Joi.string().valid(...Object.values(ComparisonOperator)),
        channels: Joi.array().items(
          Joi.object({
            type: Joi.string().valid(...Object.values(AlertChannel)).required(),
            config: Joi.object().required(),
            enabled: Joi.boolean().default(true)
          })
        ).min(1),
        priority: Joi.string().valid(...Object.values(AlertPriority)),
        cooldownMinutes: Joi.number().min(1).max(1440),
        description: Joi.string().max(500).allow(null)
      });
      
      const { error, value } = schema.validate(req.body);
      
      if (error) {
        return res.status(400).json({
          success: false,
          error: error.details[0].message
        });
      }
      
      const updateConfig = { ...value, id: alertId };
      await alertService.configureAlert(updateConfig);
      
      res.json({
        success: true,
        data: {
          alertId,
          message: 'Alert updated successfully'
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete alert configuration
   * DELETE /api/alerts/:alertId
   */
  async deleteAlert(req: Request, res: Response, next: NextFunction) {
    try {
      const { alertId } = req.params;
      
      await alertService.deleteAlert(alertId as string);
      
      res.json({
        success: true,
        data: {
          message: 'Alert deleted successfully'
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get alert history
   * GET /api/alerts/history
   */
  async getAlertHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const hours = parseInt(req.query.hours as string) || 24;
      const alertId = req.query.alertId as string | undefined;
      
      const history = await alertService.getAlertHistory(hours, alertId);
      
      res.json({
        success: true,
        data: {
          hours,
          count: history.length,
          history
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Test alert channel
   * POST /api/alerts/test/:channel
   */
  async testAlertChannel(req: Request, res: Response, next: NextFunction) {
    try {
      const channel = req.params.channel as AlertChannel;
      
      if (!Object.values(AlertChannel).includes(channel)) {
        return res.status(400).json({
          success: false,
          error: `Invalid channel type. Must be one of: ${Object.values(AlertChannel).join(', ')}`
        });
      }
      
      // Validate channel config based on type
      let configSchema: Joi.Schema;
      
      switch (channel) {
        case AlertChannel.EMAIL:
          configSchema = Joi.object({
            to: Joi.string().email().required(),
            from: Joi.string().email().optional(),
            subject: Joi.string().optional()
          });
          break;
        case AlertChannel.SLACK:
          configSchema = Joi.object({
            webhookUrl: Joi.string().uri().required()
          });
          break;
        case AlertChannel.DISCORD:
          configSchema = Joi.object({
            webhookUrl: Joi.string().uri().required()
          });
          break;
        case AlertChannel.WEBHOOK:
          configSchema = Joi.object({
            url: Joi.string().uri().required(),
            headers: Joi.object().optional(),
            additionalData: Joi.object().optional()
          });
          break;
        default:
          return res.status(400).json({
            success: false,
            error: 'Unsupported channel type'
          });
      }
      
      const { error, value } = configSchema!.validate(req.body);
      
      if (error) {
        return res.status(400).json({
          success: false,
          error: error.details[0].message
        });
      }
      
      const result = await alertService.testAlertChannel(channel, value);
      
      if (result.success) {
        res.json({
          success: true,
          data: {
            message: `Test alert sent successfully to ${channel}`
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error || 'Failed to send test alert'
        });
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * Real-time health status endpoint for WebSocket or SSE
   * GET /api/health/stream
   */
  async streamHealth(req: Request, res: Response, next: NextFunction) {
    try {
      // Set up Server-Sent Events
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });
      
      // Send initial data
      const sendHealthUpdate = async () => {
        try {
          const health = await healthMonitor.checkContainerHealth();
          const systemMetrics = await healthMonitor.getResourceUsage();
          
          const data = {
            containers: health,
            system: systemMetrics,
            timestamp: new Date().toISOString()
          };
          
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        } catch (error) {
          console.error('Error sending health update:', error);
        }
      };
      
      // Send initial update
      await sendHealthUpdate();
      
      // Send updates every 5 seconds
      const interval = setInterval(sendHealthUpdate, 5000);
      
      // Clean up on client disconnect
      req.on('close', () => {
        clearInterval(interval);
        res.end();
      });
      
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get predefined alert templates
   * GET /api/alerts/templates
   */
  async getAlertTemplates(req: Request, res: Response, next: NextFunction) {
    try {
      const templates = [
        {
          name: 'High CPU Usage',
          metricType: AlertMetricType.CPU,
          thresholdValue: 80,
          comparisonOperator: ComparisonOperator.GREATER_THAN,
          priority: AlertPriority.HIGH,
          description: 'Alert when container CPU usage exceeds 80%'
        },
        {
          name: 'High Memory Usage',
          metricType: AlertMetricType.MEMORY,
          thresholdValue: 90,
          comparisonOperator: ComparisonOperator.GREATER_THAN,
          priority: AlertPriority.HIGH,
          description: 'Alert when container memory usage exceeds 90%'
        },
        {
          name: 'Container Down',
          metricType: AlertMetricType.CONTAINER_STATUS,
          thresholdValue: 0,
          comparisonOperator: ComparisonOperator.EQUAL,
          priority: AlertPriority.CRITICAL,
          description: 'Alert when container is not running'
        },
        {
          name: 'Excessive Restarts',
          metricType: AlertMetricType.RESTART_COUNT,
          thresholdValue: 5,
          comparisonOperator: ComparisonOperator.GREATER_THAN,
          priority: AlertPriority.HIGH,
          description: 'Alert when container has restarted more than 5 times'
        },
        {
          name: 'High Disk Usage',
          metricType: AlertMetricType.DISK,
          thresholdValue: 85,
          comparisonOperator: ComparisonOperator.GREATER_THAN,
          priority: AlertPriority.MEDIUM,
          description: 'Alert when disk usage exceeds 85%'
        }
      ];
      
      res.json({
        success: true,
        data: templates
      });
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export const monitoringController = new MonitoringController();
export default monitoringController;