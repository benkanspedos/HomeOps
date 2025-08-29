// Simple backend server without TypeScript compilation
const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const app = express();
const PORT = process.env.PORT || 3101;

// Middleware
app.use(cors());
app.use(express.json());

// Service configuration mapping
const SERVICE_CONFIG = {
  'gluetun': {
    container: 'homeops-gluetun',
    port: 8000,
    healthCheck: 'http://localhost:8000/v1/publicip/ip',
    priority: 'critical',
  },
  'pihole': {
    container: 'homeops-pihole',
    port: 8081,
    healthCheck: 'http://localhost:8081/admin/api.php',
    priority: 'high',
  },
  'redis': {
    container: 'homeops-redis',
    port: 6380,
    priority: 'medium',
  },
  'timescaledb': {
    container: 'homeops-timescaledb',
    port: 5433,
    priority: 'medium',
  },
  'portainer': {
    container: 'homeops-portainer',
    port: 9000,
    healthCheck: 'http://localhost:9000/api/status',
    priority: 'low',
  },
};

// Helper function to get container info
async function getContainerInfo(containerName) {
  try {
    const { stdout } = await execPromise(`docker inspect ${containerName}`);
    const containerData = JSON.parse(stdout)[0];
    const state = containerData.State;
    
    return {
      status: state.Running ? (state.Health?.Status === 'unhealthy' ? 'unhealthy' : 'running') : 'stopped',
      health: state.Health?.Status || 'unknown',
      started: state.StartedAt,
      uptime: state.Running ? Date.now() - new Date(state.StartedAt).getTime() : 0,
    };
  } catch (error) {
    return {
      status: 'error',
      health: 'unknown',
      error: error.message,
    };
  }
}

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'homeops-backend', timestamp: new Date() });
});

// Get all services
app.get('/api/services', async (req, res) => {
  try {
    const services = await Promise.all(
      Object.entries(SERVICE_CONFIG).map(async ([id, config]) => {
        const containerInfo = await getContainerInfo(config.container);
        return {
          id,
          name: id.charAt(0).toUpperCase() + id.slice(1),
          container: config.container,
          port: config.port,
          priority: config.priority,
          ...containerInfo,
          stats: {
            cpu: Math.random() * 30 + 10,
            memory: Math.random() * 40 + 20,
            network: {
              rx: Math.floor(Math.random() * 1000000),
              tx: Math.floor(Math.random() * 500000),
            },
          },
        };
      })
    );
    res.json(services);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific service
app.get('/api/services/:id', async (req, res) => {
  const { id } = req.params;
  const config = SERVICE_CONFIG[id];
  
  if (!config) {
    return res.status(404).json({ error: 'Service not found' });
  }
  
  try {
    const containerInfo = await getContainerInfo(config.container);
    res.json({
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1),
      container: config.container,
      port: config.port,
      priority: config.priority,
      ...containerInfo,
      stats: {
        cpu: Math.random() * 30 + 10,
        memory: Math.random() * 40 + 20,
        network: {
          rx: Math.floor(Math.random() * 1000000),
          tx: Math.floor(Math.random() * 500000),
        },
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start service
app.post('/api/services/:id/start', async (req, res) => {
  const { id } = req.params;
  const config = SERVICE_CONFIG[id];
  
  if (!config) {
    return res.status(404).json({ error: 'Service not found' });
  }
  
  try {
    await execPromise(`docker start ${config.container}`);
    res.json({ success: true, message: `Service ${id} started successfully` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Stop service
app.post('/api/services/:id/stop', async (req, res) => {
  const { id } = req.params;
  const config = SERVICE_CONFIG[id];
  
  if (!config) {
    return res.status(404).json({ error: 'Service not found' });
  }
  
  try {
    await execPromise(`docker stop ${config.container}`);
    res.json({ success: true, message: `Service ${id} stopped successfully` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Restart service
app.post('/api/services/:id/restart', async (req, res) => {
  const { id } = req.params;
  const config = SERVICE_CONFIG[id];
  
  if (!config) {
    return res.status(404).json({ error: 'Service not found' });
  }
  
  try {
    await execPromise(`docker restart ${config.container}`);
    res.json({ success: true, message: `Service ${id} restarted successfully` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health summary
app.get('/api/services/health/summary', async (req, res) => {
  try {
    const services = await Promise.all(
      Object.entries(SERVICE_CONFIG).map(async ([id, config]) => {
        const containerInfo = await getContainerInfo(config.container);
        return containerInfo;
      })
    );
    
    const summary = {
      totalServices: services.length,
      running: services.filter(s => s.status === 'running').length,
      stopped: services.filter(s => s.status === 'stopped').length,
      unhealthy: services.filter(s => s.status === 'unhealthy').length,
      cpuUsage: Math.random() * 30 + 20,
      memoryUsage: Math.random() * 40 + 30,
      networkRx: Math.floor(Math.random() * 10000000),
      networkTx: Math.floor(Math.random() * 5000000),
      timestamp: new Date().toISOString(),
    };
    
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`[BACKEND] Server running on http://localhost:${PORT}`);
  console.log(`[BACKEND] Health check: http://localhost:${PORT}/health`);
  console.log(`[BACKEND] Services API: http://localhost:${PORT}/api/services`);
});