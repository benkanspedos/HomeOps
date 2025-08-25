import { Router, Request, Response } from 'express';
import { dockerService } from '../../services/docker';
import logger from '../../utils/logger';

export const servicesRouter = Router();

// Get all services with their current status
servicesRouter.get('/', async (req: Request, res: Response) => {
  try {
    const containers = await dockerService.listContainers();
    const serviceConfigs = dockerService.getAllServiceConfigs();
    
    const services = serviceConfigs.map(config => {
      const container = containers.find(c => c.name === config.container_name);
      
      return {
        id: config.name,
        name: config.name,
        container_name: config.container_name,
        image: config.image,
        status: container?.status || 'unknown',
        state: container?.state || 'unknown',
        health: container?.healthStatus || 'none',
        ports: config.ports,
        labels: config.labels,
        priority: config.priority,
        service_type: config.service_type,
        health_check_url: config.health_check_url,
        stats: container?.stats,
        created: container?.created,
        uptime: container ? dockerService['calculateUptime'](container.created) : 'unknown'
      };
    });

    res.json({
      success: true,
      data: {
        services,
        total: services.length,
        running: services.filter(s => s.status === 'running').length,
        stopped: services.filter(s => s.status === 'exited').length
      }
    });
  } catch (error) {
    logger.error('Failed to get services:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve services',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get single service by name or container ID
servicesRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Check if it's a service name first
    const serviceConfig = dockerService.getServiceConfig(id);
    if (!serviceConfig) {
      return res.status(404).json({
        success: false,
        error: 'Service not found',
        message: `No service found with name: ${id}`
      });
    }

    // Get container data
    const container = await dockerService.getContainer(serviceConfig.container_name);
    
    const service = {
      id: serviceConfig.name,
      name: serviceConfig.name,
      container_name: serviceConfig.container_name,
      image: serviceConfig.image,
      status: container?.status || 'unknown',
      state: container?.state || 'unknown',
      health: container?.healthStatus || 'none',
      ports: serviceConfig.ports,
      labels: serviceConfig.labels,
      priority: serviceConfig.priority,
      service_type: serviceConfig.service_type,
      health_check_url: serviceConfig.health_check_url,
      environment: serviceConfig.environment,
      stats: container?.stats,
      created: container?.created,
      container_id: container?.id
    };

    res.json({
      success: true,
      data: service
    });
  } catch (error) {
    logger.error(`Failed to get service ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve service',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get service health and status
servicesRouter.get('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const serviceConfig = dockerService.getServiceConfig(id);
    if (!serviceConfig) {
      return res.status(404).json({
        success: false,
        error: 'Service not found'
      });
    }

    const container = await dockerService.getContainer(serviceConfig.container_name);
    
    const status = {
      name: serviceConfig.name,
      container_name: serviceConfig.container_name,
      status: container?.status || 'unknown',
      state: container?.state || 'unknown',
      health: container?.healthStatus || 'none',
      uptime: container ? dockerService['calculateUptime'](container.created) : 'unknown',
      last_check: new Date().toISOString(),
      stats: container?.stats
    };

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error(`Failed to get status for service ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve service status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Restart a service
servicesRouter.post('/:id/restart', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const serviceConfig = dockerService.getServiceConfig(id);
    if (!serviceConfig) {
      return res.status(404).json({
        success: false,
        error: 'Service not found'
      });
    }

    logger.info(`Restarting service: ${serviceConfig.name} (${serviceConfig.container_name})`);
    
    const result = await dockerService.restartContainer(serviceConfig.container_name);
    
    if (result) {
      res.json({
        success: true,
        message: `Service ${serviceConfig.name} restarted successfully`,
        data: {
          service: serviceConfig.name,
          container: serviceConfig.container_name,
          action: 'restart',
          timestamp: new Date().toISOString()
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to restart service',
        message: `Could not restart ${serviceConfig.name}`
      });
    }
  } catch (error) {
    logger.error(`Failed to restart service ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to restart service',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Stop a service
servicesRouter.post('/:id/stop', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const serviceConfig = dockerService.getServiceConfig(id);
    if (!serviceConfig) {
      return res.status(404).json({
        success: false,
        error: 'Service not found'
      });
    }

    logger.info(`Stopping service: ${serviceConfig.name} (${serviceConfig.container_name})`);
    
    const result = await dockerService.stopContainer(serviceConfig.container_name);
    
    if (result) {
      res.json({
        success: true,
        message: `Service ${serviceConfig.name} stopped successfully`,
        data: {
          service: serviceConfig.name,
          container: serviceConfig.container_name,
          action: 'stop',
          timestamp: new Date().toISOString()
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to stop service',
        message: `Could not stop ${serviceConfig.name}`
      });
    }
  } catch (error) {
    logger.error(`Failed to stop service ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop service',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Start a service
servicesRouter.post('/:id/start', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const serviceConfig = dockerService.getServiceConfig(id);
    if (!serviceConfig) {
      return res.status(404).json({
        success: false,
        error: 'Service not found'
      });
    }

    logger.info(`Starting service: ${serviceConfig.name} (${serviceConfig.container_name})`);
    
    const result = await dockerService.startContainer(serviceConfig.container_name);
    
    if (result) {
      res.json({
        success: true,
        message: `Service ${serviceConfig.name} started successfully`,
        data: {
          service: serviceConfig.name,
          container: serviceConfig.container_name,
          action: 'start',
          timestamp: new Date().toISOString()
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to start service',
        message: `Could not start ${serviceConfig.name}`
      });
    }
  } catch (error) {
    logger.error(`Failed to start service ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to start service',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get overall service health summary
servicesRouter.get('/health/summary', async (req: Request, res: Response) => {
  try {
    const healthData = await dockerService.getServiceHealth();
    
    const summary = {
      total_services: healthData.length,
      healthy: healthData.filter(s => s.health === 'healthy').length,
      unhealthy: healthData.filter(s => s.health === 'unhealthy').length,
      starting: healthData.filter(s => s.health === 'starting').length,
      unknown: healthData.filter(s => s.health === 'unknown' || s.health === 'none').length,
      services: healthData,
      last_check: new Date().toISOString()
    };

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    logger.error('Failed to get service health summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve health summary',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});