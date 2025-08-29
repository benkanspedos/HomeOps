#!/usr/bin/env ts-node

import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';
import { Pool } from 'pg';
import Docker from 'dockerode';

const execAsync = promisify(exec);

interface ValidationResult {
  component: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
}

class MonitoringValidator {
  private results: ValidationResult[] = [];
  private docker: Docker;
  private dbPool: Pool;

  constructor() {
    this.docker = new Docker();
    this.dbPool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/homeops'
    });
  }

  /**
   * Add validation result
   */
  private addResult(component: string, status: 'pass' | 'fail' | 'warning', message: string, details?: any) {
    this.results.push({ component, status, message, details });
    
    const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⚠️';
    console.log(`${icon} ${component}: ${message}`);
    
    if (details) {
      console.log('  Details:', details);
    }
  }

  /**
   * Validate Docker connectivity
   */
  async validateDockerConnection(): Promise<void> {
    try {
      const version = await this.docker.version();
      this.addResult(
        'Docker Connection',
        'pass',
        `Connected to Docker Engine ${version.Version}`,
        { apiVersion: version.ApiVersion }
      );
    } catch (error) {
      this.addResult(
        'Docker Connection',
        'fail',
        'Failed to connect to Docker Engine',
        { error: (error as Error).message }
      );
    }
  }

  /**
   * Validate container accessibility
   */
  async validateContainerAccess(): Promise<void> {
    try {
      const containers = await this.docker.listContainers({ all: true });
      
      if (containers.length === 0) {
        this.addResult('Container Access', 'warning', 'No containers found');
        return;
      }

      const runningContainers = containers.filter(c => c.State === 'running');
      
      this.addResult(
        'Container Access',
        'pass',
        `Found ${containers.length} containers (${runningContainers.length} running)`,
        {
          totalContainers: containers.length,
          runningContainers: runningContainers.length,
          containerNames: containers.map(c => c.Names[0]?.replace('/', ''))
        }
      );

      // Test getting stats from first running container
      if (runningContainers.length > 0) {
        const container = this.docker.getContainer(runningContainers[0].Id);
        const stats = await container.stats({ stream: false });
        
        this.addResult(
          'Container Stats',
          'pass',
          'Successfully retrieved container statistics',
          { containerId: runningContainers[0].Id.substring(0, 12) }
        );
      }
    } catch (error) {
      this.addResult(
        'Container Access',
        'fail',
        'Failed to access containers',
        { error: (error as Error).message }
      );
    }
  }

  /**
   * Validate TimescaleDB connection and setup
   */
  async validateTimescaleDB(): Promise<void> {
    try {
      // Test connection
      const client = await this.dbPool.connect();
      
      this.addResult('TimescaleDB Connection', 'pass', 'Successfully connected to TimescaleDB');

      // Check if TimescaleDB extension is installed
      const extensionResult = await client.query(
        "SELECT * FROM pg_extension WHERE extname = 'timescaledb'"
      );
      
      if (extensionResult.rows.length === 0) {
        this.addResult(
          'TimescaleDB Extension',
          'fail',
          'TimescaleDB extension not installed'
        );
      } else {
        this.addResult(
          'TimescaleDB Extension',
          'pass',
          'TimescaleDB extension is installed',
          { version: extensionResult.rows[0].extversion }
        );
      }

      // Check if container_metrics table exists
      const tableResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'container_metrics'
      `);

      if (tableResult.rows.length === 0) {
        this.addResult(
          'Metrics Table',
          'warning',
          'container_metrics table not found - will be created on first use'
        );
      } else {
        // Check if it's a hypertable
        const hypertableResult = await client.query(`
          SELECT * FROM timescaledb_information.hypertables 
          WHERE hypertable_name = 'container_metrics'
        `);
        
        if (hypertableResult.rows.length === 0) {
          this.addResult(
            'Metrics Hypertable',
            'warning',
            'container_metrics exists but is not a hypertable'
          );
        } else {
          this.addResult(
            'Metrics Hypertable',
            'pass',
            'container_metrics hypertable is properly configured',
            {
              timeColumn: hypertableResult.rows[0].time_column_name,
              chunkInterval: hypertableResult.rows[0].chunk_time_interval
            }
          );
        }
      }

      // Test writing and reading data
      const testData = {
        timestamp: new Date(),
        container_id: 'test-validation',
        container_name: 'test-container',
        cpu: 25.5,
        memory: 45.2
      };

      await client.query(`
        CREATE TABLE IF NOT EXISTS container_metrics (
          timestamp TIMESTAMPTZ NOT NULL,
          container_id TEXT NOT NULL,
          container_name TEXT NOT NULL,
          cpu FLOAT,
          memory FLOAT,
          disk_read BIGINT,
          disk_write BIGINT,
          network_rx BIGINT,
          network_tx BIGINT
        )
      `);

      await client.query(`
        INSERT INTO container_metrics 
        (timestamp, container_id, container_name, cpu, memory)
        VALUES ($1, $2, $3, $4, $5)
      `, [testData.timestamp, testData.container_id, testData.container_name, testData.cpu, testData.memory]);

      const readResult = await client.query(
        'SELECT * FROM container_metrics WHERE container_id = $1',
        [testData.container_id]
      );

      if (readResult.rows.length > 0) {
        this.addResult('Database Read/Write', 'pass', 'Successfully wrote and read test data');
        
        // Cleanup test data
        await client.query('DELETE FROM container_metrics WHERE container_id = $1', [testData.container_id]);
      } else {
        this.addResult('Database Read/Write', 'fail', 'Failed to read test data');
      }

      client.release();
    } catch (error) {
      this.addResult(
        'TimescaleDB',
        'fail',
        'Database validation failed',
        { error: (error as Error).message }
      );
    }
  }

  /**
   * Validate Redis connection
   */
  async validateRedis(): Promise<void> {
    try {
      // Simple Redis connection test
      const { stdout } = await execAsync('docker exec redis redis-cli ping');
      
      if (stdout.trim() === 'PONG') {
        this.addResult('Redis Connection', 'pass', 'Redis is responding to ping');
      } else {
        this.addResult('Redis Connection', 'fail', 'Redis ping failed', { response: stdout });
      }
    } catch (error) {
      this.addResult(
        'Redis Connection',
        'warning',
        'Could not test Redis connection',
        { error: (error as Error).message }
      );
    }
  }

  /**
   * Validate API endpoints
   */
  async validateAPIEndpoints(): Promise<void> {
    const baseURL = process.env.API_BASE_URL || 'http://localhost:3001';
    const endpoints = [
      { path: '/api/health/containers', method: 'GET' },
      { path: '/api/health/metrics', method: 'GET' },
      { path: '/api/alerts/rules', method: 'GET' }
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await axios({
          method: endpoint.method.toLowerCase() as any,
          url: `${baseURL}${endpoint.path}`,
          timeout: 5000
        });

        this.addResult(
          `API ${endpoint.method} ${endpoint.path}`,
          'pass',
          `Responded with status ${response.status}`,
          { 
            status: response.status,
            responseTime: response.headers['x-response-time'] || 'unknown'
          }
        );
      } catch (error: any) {
        const status = error.response?.status || 'timeout';
        this.addResult(
          `API ${endpoint.method} ${endpoint.path}`,
          status === 404 ? 'warning' : 'fail',
          `Request failed with status ${status}`,
          { error: error.message }
        );
      }
    }
  }

  /**
   * Test notification channels
   */
  async validateNotificationChannels(): Promise<void> {
    const channels = [
      { name: 'Email', envVars: ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'] },
      { name: 'Slack', envVars: ['SLACK_WEBHOOK_URL'] },
      { name: 'Webhook', envVars: ['ALERT_WEBHOOK_URL'] }
    ];

    for (const channel of channels) {
      const missingVars = channel.envVars.filter(varName => !process.env[varName]);
      
      if (missingVars.length === 0) {
        this.addResult(
          `${channel.name} Configuration`,
          'pass',
          'All required environment variables are set'
        );
        
        // Test the channel if API is available
        try {
          const response = await axios.post(
            `${process.env.API_BASE_URL || 'http://localhost:3001'}/api/alerts/test/${channel.name.toLowerCase()}`,
            {},
            { timeout: 10000 }
          );
          
          this.addResult(
            `${channel.name} Test`,
            'pass',
            'Test notification sent successfully'
          );
        } catch (error: any) {
          this.addResult(
            `${channel.name} Test`,
            'warning',
            'Could not send test notification',
            { error: error.message }
          );
        }
      } else {
        this.addResult(
          `${channel.name} Configuration`,
          'warning',
          `Missing environment variables: ${missingVars.join(', ')}`
        );
      }
    }
  }

  /**
   * Validate frontend accessibility
   */
  async validateFrontend(): Promise<void> {
    const frontendURL = process.env.FRONTEND_URL || 'http://localhost:3000';
    
    try {
      const response = await axios.get(`${frontendURL}/monitoring`, { timeout: 10000 });
      
      if (response.status === 200) {
        this.addResult(
          'Frontend Access',
          'pass',
          'Monitoring dashboard is accessible',
          { url: frontendURL, responseTime: response.headers['x-response-time'] }
        );
      } else {
        this.addResult(
          'Frontend Access',
          'fail',
          `Unexpected status: ${response.status}`
        );
      }
    } catch (error: any) {
      this.addResult(
        'Frontend Access',
        'fail',
        'Cannot access monitoring dashboard',
        { error: error.message, url: frontendURL }
      );
    }
  }

  /**
   * Validate system resources
   */
  async validateSystemResources(): Promise<void> {
    try {
      // Check disk space
      const { stdout: diskUsage } = await execAsync('df -h /');
      const diskLines = diskUsage.split('\n')[1].split(/\s+/);
      const diskUsagePercent = parseInt(diskLines[4].replace('%', ''));
      
      if (diskUsagePercent > 90) {
        this.addResult('Disk Space', 'fail', `Disk usage is ${diskUsagePercent}% - critically low`);
      } else if (diskUsagePercent > 80) {
        this.addResult('Disk Space', 'warning', `Disk usage is ${diskUsagePercent}% - getting high`);
      } else {
        this.addResult('Disk Space', 'pass', `Disk usage is ${diskUsagePercent}% - healthy`);
      }

      // Check memory usage
      const { stdout: memInfo } = await execAsync('cat /proc/meminfo | head -3');
      const memLines = memInfo.split('\n').map(line => line.split(/\s+/));
      const totalMem = parseInt(memLines[0][1]);
      const freeMem = parseInt(memLines[1][1]);
      const availableMem = parseInt(memLines[2][1]);
      
      const memUsagePercent = Math.round((totalMem - availableMem) / totalMem * 100);
      
      if (memUsagePercent > 90) {
        this.addResult('Memory Usage', 'fail', `Memory usage is ${memUsagePercent}% - critically high`);
      } else if (memUsagePercent > 80) {
        this.addResult('Memory Usage', 'warning', `Memory usage is ${memUsagePercent}% - getting high`);
      } else {
        this.addResult('Memory Usage', 'pass', `Memory usage is ${memUsagePercent}% - healthy`);
      }
    } catch (error) {
      this.addResult(
        'System Resources',
        'warning',
        'Could not check system resources',
        { error: (error as Error).message }
      );
    }
  }

  /**
   * Run all validations
   */
  async runAllValidations(): Promise<ValidationResult[]> {
    console.log('🔍 Starting HomeOps Monitoring System Validation...\n');

    const validations = [
      () => this.validateDockerConnection(),
      () => this.validateContainerAccess(),
      () => this.validateTimescaleDB(),
      () => this.validateRedis(),
      () => this.validateAPIEndpoints(),
      () => this.validateNotificationChannels(),
      () => this.validateFrontend(),
      () => this.validateSystemResources()
    ];

    for (const validation of validations) {
      try {
        await validation();
      } catch (error) {
        console.error('Unexpected validation error:', error);
      }
      console.log(''); // Add spacing between validations
    }

    return this.results;
  }

  /**
   * Generate summary report
   */
  generateSummary(): void {
    console.log('\n📊 VALIDATION SUMMARY');
    console.log('='.repeat(50));

    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const warnings = this.results.filter(r => r.status === 'warning').length;
    
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⚠️  Warnings: ${warnings}`);
    console.log(`📈 Total: ${this.results.length}`);

    if (failed > 0) {
      console.log('\n❌ CRITICAL ISSUES:');
      this.results
        .filter(r => r.status === 'fail')
        .forEach(r => console.log(`   • ${r.component}: ${r.message}`));
    }

    if (warnings > 0) {
      console.log('\n⚠️  WARNINGS:');
      this.results
        .filter(r => r.status === 'warning')
        .forEach(r => console.log(`   • ${r.component}: ${r.message}`));
    }

    const overallStatus = failed === 0 ? (warnings === 0 ? 'HEALTHY' : 'HEALTHY_WITH_WARNINGS') : 'UNHEALTHY';
    const statusIcon = overallStatus === 'HEALTHY' ? '✅' : overallStatus === 'HEALTHY_WITH_WARNINGS' ? '⚠️' : '❌';
    
    console.log(`\n${statusIcon} OVERALL STATUS: ${overallStatus}`);
    
    if (overallStatus === 'UNHEALTHY') {
      console.log('\n🚨 System has critical issues that need immediate attention!');
      process.exit(1);
    } else if (overallStatus === 'HEALTHY_WITH_WARNINGS') {
      console.log('\n💡 System is functional but has some configuration warnings.');
    } else {
      console.log('\n🎉 All systems are working perfectly!');
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      await this.dbPool.end();
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

// Main execution
async function main() {
  const validator = new MonitoringValidator();
  
  try {
    await validator.runAllValidations();
    validator.generateSummary();
  } catch (error) {
    console.error('Fatal validation error:', error);
    process.exit(1);
  } finally {
    await validator.cleanup();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { MonitoringValidator, ValidationResult };