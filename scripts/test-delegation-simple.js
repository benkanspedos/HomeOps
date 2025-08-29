#!/usr/bin/env node

/**
 * Simple standalone test for Task Delegation System
 * Tests components without full HomeOps backend
 */

const express = require('express');
const cors = require('cors');
const { createServer } = require('http');

// Mock the delegation service for basic testing
class MockDelegationService {
  constructor() {
    this.isStarted = true;
    this.agents = [];
    this.tasks = [];
    this.stats = {
      timestamp: Date.now(),
      isRunning: true,
      queue: {
        pending: 0,
        inProgress: 0,
        completed: 0,
        failed: 0,
        websocket: {
          totalConnections: 0,
          totalAgents: 0,
          activeAgents: 0,
        }
      },
      registry: {
        totalAgents: 0,
        activeAgents: 0,
        healthyAgents: 0,
        busyAgents: 0,
        offlineAgents: 0,
        averageHealthScore: 100,
        totalCapabilities: 3,
      },
      routing: {
        totalAssignments: 0,
        completedTasks: 0,
        averageTaskDuration: 0,
        ruleUsage: {},
        activeRules: 4,
        totalRules: 4
      },
      errors: {
        totalErrors: 0,
        recentErrors: 0,
        unresolvedErrors: 0,
        errorsByType: {},
        errorsBySeverity: {},
        recoveryActions: 5,
      },
      systemHealth: {
        status: 'healthy',
        timestamp: Date.now(),
        issues: []
      }
    };
  }

  isRunning() { return this.isStarted; }
  
  async performHealthCheck() {
    return {
      status: 'healthy',
      checks: {
        serviceRunning: { status: 'pass', message: 'Service is running' },
        systemMetrics: { status: 'pass', message: 'System metrics available' },
        agentAvailability: { status: 'pass', message: '0 agents available', count: 0 },
        errorRate: { status: 'pass', message: 'Error rate: 0.0%', rate: 0 }
      },
      timestamp: Date.now()
    };
  }

  async getStats() { return this.stats; }
  getStatus() { return { isRunning: this.isStarted }; }
  async getAllAgents() { return this.agents; }
  async getConnectedAgents() { return this.agents; }
  getAvailableCapabilities() { return ['test', 'mock', 'demo']; }
  getUnresolvedErrors() { return []; }
  getRoutingRules() { 
    return [
      { id: 'test-rule', name: 'Test Rule', enabled: true, priority: 5 }
    ];
  }
  enableRoutingRule(ruleId) { return true; }
  disableRoutingRule(ruleId) { return true; }
  getAgent(agentId) { return null; }
  
  async submitTask(taskData) {
    const taskId = 'test-task-' + Date.now();
    console.log(`✅ Mock task submitted: ${taskData.name} (${taskId})`);
    return taskId;
  }
  
  async getTask(taskId) {
    return {
      id: taskId,
      name: 'Mock Task',
      status: 'completed',
      progress: 100,
      createdAt: Date.now() - 5000,
      completedAt: Date.now()
    };
  }
  
  getTaskProgress(taskId) {
    return [
      { taskId, status: 'pending', progress: 0, timestamp: Date.now() - 5000 },
      { taskId, status: 'in_progress', progress: 50, timestamp: Date.now() - 2500 },
      { taskId, status: 'completed', progress: 100, timestamp: Date.now() }
    ];
  }
  
  getLatestTaskProgress(taskId) {
    return { taskId, status: 'completed', progress: 100, timestamp: Date.now() };
  }
  
  getConfig() {
    return {
      websocket: { port: 3201, path: '/delegation', maxConnections: 100, pingInterval: 30000 }
    };
  }
}

const app = express();
const server = createServer(app);
const PORT = 3102;

app.use(cors());
app.use(express.json());

// Mock delegation service
const delegationService = new MockDelegationService();

// Mock delegation routes
app.get('/api/delegation/health', async (req, res) => {
  const health = await delegationService.performHealthCheck();
  res.json(health);
});

app.get('/api/delegation/status', (req, res) => {
  res.json(delegationService.getStatus());
});

app.get('/api/delegation/stats', async (req, res) => {
  const stats = await delegationService.getStats();
  res.json(stats);
});

app.get('/api/delegation/agents', async (req, res) => {
  const agents = await delegationService.getAllAgents();
  res.json(agents);
});

app.get('/api/delegation/capabilities', (req, res) => {
  const capabilities = delegationService.getAvailableCapabilities();
  res.json({ capabilities });
});

app.post('/api/delegation/tasks', async (req, res) => {
  try {
    const taskId = await delegationService.submitTask(req.body);
    res.status(201).json({ taskId, message: 'Task submitted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit task' });
  }
});

app.get('/api/delegation/tasks', async (req, res) => {
  const stats = await delegationService.getStats();
  res.json({
    pending: stats.queue.pending,
    inProgress: stats.queue.inProgress,
    completed: stats.queue.completed,
    failed: stats.queue.failed,
    total: stats.queue.pending + stats.queue.inProgress + stats.queue.completed + stats.queue.failed
  });
});

app.get('/api/delegation/tasks/:taskId', async (req, res) => {
  const task = await delegationService.getTask(req.params.taskId);
  res.json(task);
});

app.get('/api/delegation/tasks/:taskId/progress', (req, res) => {
  const progress = delegationService.getTaskProgress(req.params.taskId);
  res.json({
    taskId: req.params.taskId,
    progress,
    latest: delegationService.getLatestTaskProgress(req.params.taskId)
  });
});

app.get('/api/delegation/errors', (req, res) => {
  const errors = delegationService.getUnresolvedErrors();
  res.json(errors);
});

app.get('/api/delegation/routing/rules', (req, res) => {
  const rules = delegationService.getRoutingRules();
  res.json(rules);
});

app.post('/api/delegation/routing/rules/:ruleId/enable', (req, res) => {
  const success = delegationService.enableRoutingRule(req.params.ruleId);
  if (success) {
    res.json({ message: 'Routing rule enabled successfully', ruleId: req.params.ruleId });
  } else {
    res.status(404).json({ error: 'Routing rule not found' });
  }
});

app.post('/api/delegation/routing/rules/:ruleId/disable', (req, res) => {
  const success = delegationService.disableRoutingRule(req.params.ruleId);
  if (success) {
    res.json({ message: 'Routing rule disabled successfully', ruleId: req.params.ruleId });
  } else {
    res.status(404).json({ error: 'Routing rule not found' });
  }
});

app.get('/api/delegation/websocket/info', (req, res) => {
  const config = delegationService.getConfig();
  res.json({
    port: config.websocket.port,
    path: config.websocket.path,
    url: `ws://localhost:${config.websocket.port}${config.websocket.path}`,
    maxConnections: config.websocket.maxConnections,
    pingInterval: config.websocket.pingInterval
  });
});

// Basic health endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'delegation-test' });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Mock Delegation Test Server running on port ${PORT}`);
  console.log(`✅ Health check: http://localhost:${PORT}/api/health`);
  console.log(`✅ Delegation health: http://localhost:${PORT}/api/delegation/health`);
  console.log(`✅ Delegation stats: http://localhost:${PORT}/api/delegation/stats`);
  console.log('');
  console.log('🧪 Ready for testing! Run: node scripts/test-delegation-system.js');
  console.log('   (Update API_BASE to http://localhost:3102/api first)');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\\n🛑 Shutting down mock server...');
  server.close(() => {
    console.log('✅ Mock server shut down');
    process.exit(0);
  });
});