#!/usr/bin/env node

/**
 * Test script for HomeOps Task Delegation System
 * 
 * This script validates that all delegation components are working correctly:
 * - Backend API endpoints
 * - WebSocket server connectivity 
 * - Task submission and routing
 * - Agent registration and discovery
 * - Error handling and recovery
 * 
 * Usage: node scripts/test-delegation-system.js
 */

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const WebSocket = require('ws');

const API_BASE = process.env.API_BASE || 'http://localhost:3103/api';
const WS_BASE = process.env.WS_BASE || 'ws://localhost:3201/delegation';
const JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0LXVzZXItMTIzIiwiZW1haWwiOiJ0ZXN0QGhvbWVvcHMuY29tIiwicm9sZSI6ImFkbWluIiwicGVybWlzc2lvbnMiOlsiZGVsZWdhdGlvbjpyZWFkIiwiZGVsZWdhdGlvbjp3cml0ZSIsImRlbGVnYXRpb246YWRtaW4iXSwiaWF0IjoxNzU2NDU0NDk0LCJleHAiOjE3NTY0NTgwOTQsImlzcyI6ImhvbWVvcHMtYmFja2VuZCJ9._9g9COLLfEHsnBu0-5tsh4HbJxUJHG38v_Y1dC1qWXQ';

class DelegationTester {
  constructor() {
    this.tests = [];
    this.results = {
      passed: 0,
      failed: 0,
      total: 0
    };
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = level === 'error' ? '❌' : level === 'success' ? '✅' : 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async test(name, testFn) {
    this.results.total++;
    this.log(`Running test: ${name}`, 'info');
    
    try {
      await testFn();
      this.results.passed++;
      this.log(`✅ PASSED: ${name}`, 'success');
    } catch (error) {
      this.results.failed++;
      this.log(`❌ FAILED: ${name} - ${error.message}`, 'error');
    }
  }

  async fetchWithAuth(endpoint, options = {}) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${JWT_TOKEN}`,
        ...options.headers
      },
      ...options
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response;
  }

  async testHealthEndpoint() {
    const response = await this.fetchWithAuth('/delegation/health');
    const data = await response.json();
    
    if (!data.status) {
      throw new Error('Health endpoint did not return status');
    }
    
    this.log(`Delegation system status: ${data.status}`, 'info');
  }

  async testStatsEndpoint() {
    const response = await this.fetchWithAuth('/delegation/stats');
    const data = await response.json();
    
    if (typeof data.timestamp !== 'number') {
      throw new Error('Stats endpoint did not return valid timestamp');
    }
    
    this.log(`Stats collected at: ${new Date(data.timestamp).toISOString()}`, 'info');
  }

  async testAgentsEndpoint() {
    const response = await this.fetchWithAuth('/delegation/agents');
    const data = await response.json();
    
    if (!Array.isArray(data)) {
      throw new Error('Agents endpoint did not return array');
    }
    
    this.log(`Found ${data.length} registered agents`, 'info');
  }

  async testCapabilitiesEndpoint() {
    const response = await this.fetchWithAuth('/delegation/capabilities');
    const data = await response.json();
    
    if (!data.capabilities || !Array.isArray(data.capabilities)) {
      throw new Error('Capabilities endpoint did not return capabilities array');
    }
    
    this.log(`Available capabilities: ${data.capabilities.join(', ')}`, 'info');
  }

  async testTaskSubmission() {
    const taskData = {
      name: 'Test Task',
      description: 'Delegation system test task',
      priority: 5,
      parameters: { test: true },
      requiredCapabilities: ['test'],
      timeout: 30000,
      retries: 2
    };

    const response = await this.fetchWithAuth('/delegation/tasks', {
      method: 'POST',
      body: JSON.stringify(taskData)
    });

    const result = await response.json();
    
    if (!result.taskId) {
      throw new Error('Task submission did not return taskId');
    }
    
    this.log(`Task submitted with ID: ${result.taskId}`, 'info');
    return result.taskId;
  }

  async testTaskProgress(taskId) {
    const response = await this.fetchWithAuth(`/delegation/tasks/${taskId}/progress`);
    const data = await response.json();
    
    if (data.taskId !== taskId) {
      throw new Error('Task progress did not return correct taskId');
    }
    
    this.log(`Task ${taskId} progress entries: ${data.progress?.length || 0}`, 'info');
  }

  async testWebSocketConnection() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${WS_BASE}?token=${JWT_TOKEN}`);
      let connectionEstablished = false;

      const timeout = setTimeout(() => {
        if (!connectionEstablished) {
          ws.terminate();
          reject(new Error('WebSocket connection timeout'));
        }
      }, 10000);

      ws.on('open', () => {
        connectionEstablished = true;
        this.log('WebSocket connection established', 'info');
        
        // Send a test message
        const testMessage = {
          id: 'test-' + Date.now(),
          type: 'system_event',
          timestamp: Date.now(),
          agentId: 'test-client',
          event: {
            name: 'connection_test',
            level: 'info',
            description: 'Testing WebSocket connection'
          }
        };
        
        ws.send(JSON.stringify(testMessage));
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.log(`Received WebSocket message: ${message.type}`, 'info');
          
          clearTimeout(timeout);
          ws.close();
          resolve();
        } catch (error) {
          clearTimeout(timeout);
          ws.terminate();
          reject(new Error(`Invalid WebSocket message: ${error.message}`));
        }
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`WebSocket error: ${error.message}`));
      });

      ws.on('close', (code, reason) => {
        clearTimeout(timeout);
        if (connectionEstablished) {
          resolve();
        } else {
          reject(new Error(`WebSocket closed: ${code} ${reason}`));
        }
      });
    });
  }

  async testRoutingRules() {
    const response = await this.fetchWithAuth('/delegation/routing/rules');
    const data = await response.json();
    
    if (!Array.isArray(data)) {
      throw new Error('Routing rules endpoint did not return array');
    }
    
    this.log(`Found ${data.length} routing rules`, 'info');
    
    // Test enabling/disabling a rule if any exist
    if (data.length > 0) {
      const rule = data[0];
      
      // Test disable
      const disableResponse = await this.fetchWithAuth(`/delegation/routing/rules/${rule.id}/disable`, {
        method: 'POST'
      });
      
      if (!disableResponse.ok) {
        throw new Error('Failed to disable routing rule');
      }
      
      // Test enable
      const enableResponse = await this.fetchWithAuth(`/delegation/routing/rules/${rule.id}/enable`, {
        method: 'POST'
      });
      
      if (!enableResponse.ok) {
        throw new Error('Failed to enable routing rule');
      }
      
      this.log(`Successfully toggled routing rule: ${rule.name}`, 'info');
    }
  }

  async testWebSocketInfo() {
    const response = await this.fetchWithAuth('/delegation/websocket/info');
    const data = await response.json();
    
    if (!data.port || !data.path || !data.url) {
      throw new Error('WebSocket info endpoint missing required fields');
    }
    
    this.log(`WebSocket server: ${data.url} (max connections: ${data.maxConnections})`, 'info');
  }

  async runAllTests() {
    this.log('Starting HomeOps Delegation System Tests', 'info');
    this.log('==========================================', 'info');
    
    // API Endpoint Tests
    await this.test('Health Endpoint', () => this.testHealthEndpoint());
    await this.test('Stats Endpoint', () => this.testStatsEndpoint());
    await this.test('Agents Endpoint', () => this.testAgentsEndpoint());
    await this.test('Capabilities Endpoint', () => this.testCapabilitiesEndpoint());
    await this.test('WebSocket Info Endpoint', () => this.testWebSocketInfo());
    await this.test('Routing Rules Endpoint', () => this.testRoutingRules());
    
    // Task Management Tests
    let taskId;
    await this.test('Task Submission', async () => {
      taskId = await this.testTaskSubmission();
    });
    
    if (taskId) {
      await this.test('Task Progress Tracking', () => this.testTaskProgress(taskId));
    }
    
    // WebSocket Tests
    await this.test('WebSocket Connection', () => this.testWebSocketConnection());
    
    // Summary
    this.log('==========================================', 'info');
    this.log('Test Summary:', 'info');
    this.log(`Total: ${this.results.total}`, 'info');
    this.log(`Passed: ${this.results.passed}`, 'success');
    this.log(`Failed: ${this.results.failed}`, this.results.failed > 0 ? 'error' : 'info');
    this.log(`Success Rate: ${((this.results.passed / this.results.total) * 100).toFixed(1)}%`, 'info');
    
    if (this.results.failed > 0) {
      process.exit(1);
    } else {
      this.log('All tests passed! 🎉', 'success');
      process.exit(0);
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\\n⚠️  Test execution interrupted');
  process.exit(130);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled promise rejection:', reason);
  process.exit(1);
});

// Run tests
if (require.main === module) {
  const tester = new DelegationTester();
  tester.runAllTests().catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = DelegationTester;