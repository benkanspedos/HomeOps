#!/usr/bin/env node

const { exec } = require('child_process');
const { promisify } = require('util');
const axios = require('axios');
const execAsync = promisify(exec);

// Configuration
const MONITORING_CONFIG = {
  backend: {
    url: 'http://localhost:3101/health',
    name: 'Backend API',
    critical: true
  },
  docker: {
    containers: [
      { name: 'homeops-gluetun', critical: true },
      { name: 'homeops-redis', critical: true },
      { name: 'homeops-timescaledb', critical: true },
      { name: 'homeops-browser-direct', critical: false },
      { name: 'homeops-comet-browser', critical: false }
    ]
  },
  services: {
    redis: { host: 'localhost', port: 6380 },
    timescale: { host: 'localhost', port: 5433 },
    pihole: { host: 'localhost', port: 8081 }
  },
  thresholds: {
    cpuWarning: 80,
    cpuCritical: 95,
    memoryWarning: 80,
    memoryCritical: 95,
    responseTimeWarning: 1000, // ms
    responseTimeCritical: 3000 // ms
  }
};

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Status indicators
const STATUS = {
  OK: `${colors.green}[OK]${colors.reset}`,
  WARNING: `${colors.yellow}[WARNING]${colors.reset}`,
  ERROR: `${colors.red}[ERROR]${colors.reset}`,
  INFO: `${colors.blue}[INFO]${colors.reset}`
};

// Monitoring results storage
let monitoringResults = {
  timestamp: new Date().toISOString(),
  backend: {},
  docker: [],
  services: {},
  alerts: [],
  summary: {
    totalChecks: 0,
    passed: 0,
    warnings: 0,
    failures: 0
  }
};

// Helper functions
function log(status, message) {
  console.log(`${status} ${message}`);
}

function addAlert(level, message) {
  monitoringResults.alerts.push({
    level,
    message,
    timestamp: new Date().toISOString()
  });
  
  if (level === 'error') {
    monitoringResults.summary.failures++;
  } else if (level === 'warning') {
    monitoringResults.summary.warnings++;
  }
}

// Check backend health
async function checkBackendHealth() {
  monitoringResults.summary.totalChecks++;
  
  try {
    const start = Date.now();
    const response = await axios.get(MONITORING_CONFIG.backend.url, {
      timeout: 5000
    });
    const responseTime = Date.now() - start;
    
    monitoringResults.backend = {
      status: 'healthy',
      responseTime,
      data: response.data
    };
    
    if (responseTime > MONITORING_CONFIG.thresholds.responseTimeCritical) {
      log(STATUS.ERROR, `Backend response time critical: ${responseTime}ms`);
      addAlert('error', `Backend response time ${responseTime}ms exceeds critical threshold`);
    } else if (responseTime > MONITORING_CONFIG.thresholds.responseTimeWarning) {
      log(STATUS.WARNING, `Backend response time slow: ${responseTime}ms`);
      addAlert('warning', `Backend response time ${responseTime}ms exceeds warning threshold`);
    } else {
      log(STATUS.OK, `Backend API (${responseTime}ms) - Uptime: ${Math.floor(response.data.uptime)}s`);
      monitoringResults.summary.passed++;
    }
  } catch (error) {
    monitoringResults.backend = {
      status: 'unhealthy',
      error: error.message
    };
    log(STATUS.ERROR, `Backend API - ${error.message}`);
    if (MONITORING_CONFIG.backend.critical) {
      addAlert('error', `Critical service Backend API is down: ${error.message}`);
    }
  }
}

// Check Docker containers
async function checkDockerContainers() {
  try {
    // Get container stats
    const { stdout: statsOutput } = await execAsync('docker stats --no-stream --format "table {{.Container}}\\t{{.Name}}\\t{{.CPUPerc}}\\t{{.MemPerc}}"');
    const lines = statsOutput.trim().split('\n').slice(1); // Skip header
    
    for (const container of MONITORING_CONFIG.docker.containers) {
      monitoringResults.summary.totalChecks++;
      const containerLine = lines.find(line => line.includes(container.name));
      
      if (containerLine) {
        const parts = containerLine.split(/\s+/);
        const cpuPercent = parseFloat(parts[2]);
        const memPercent = parseFloat(parts[3]);
        
        const containerStatus = {
          name: container.name,
          cpu: cpuPercent,
          memory: memPercent,
          status: 'running'
        };
        
        monitoringResults.docker.push(containerStatus);
        
        // Check thresholds
        if (cpuPercent > MONITORING_CONFIG.thresholds.cpuCritical) {
          log(STATUS.ERROR, `${container.name} - CPU usage critical: ${cpuPercent}%`);
          addAlert('error', `Container ${container.name} CPU usage ${cpuPercent}% exceeds critical threshold`);
        } else if (cpuPercent > MONITORING_CONFIG.thresholds.cpuWarning) {
          log(STATUS.WARNING, `${container.name} - CPU usage high: ${cpuPercent}%`);
          addAlert('warning', `Container ${container.name} CPU usage ${cpuPercent}% exceeds warning threshold`);
        } else {
          log(STATUS.OK, `${container.name} - CPU: ${cpuPercent}%, Memory: ${memPercent}%`);
          monitoringResults.summary.passed++;
        }
      } else {
        monitoringResults.docker.push({
          name: container.name,
          status: 'not found'
        });
        
        if (container.critical) {
          log(STATUS.ERROR, `${container.name} - Container not running (CRITICAL)`);
          addAlert('error', `Critical container ${container.name} is not running`);
        } else {
          log(STATUS.WARNING, `${container.name} - Container not running`);
          addAlert('warning', `Container ${container.name} is not running`);
        }
      }
    }
    
    // Check for unhealthy containers
    const { stdout: healthOutput } = await execAsync('docker ps --filter "health=unhealthy" --format "{{.Names}}"');
    if (healthOutput.trim()) {
      const unhealthyContainers = healthOutput.trim().split('\n');
      unhealthyContainers.forEach(name => {
        log(STATUS.WARNING, `${name} - Container marked as unhealthy`);
        addAlert('warning', `Container ${name} is marked as unhealthy`);
      });
    }
    
  } catch (error) {
    log(STATUS.ERROR, `Docker check failed: ${error.message}`);
    addAlert('error', `Docker monitoring failed: ${error.message}`);
  }
}

// Check service connectivity
async function checkServiceConnectivity() {
  const net = require('net');
  
  for (const [serviceName, config] of Object.entries(MONITORING_CONFIG.services)) {
    monitoringResults.summary.totalChecks++;
    
    await new Promise((resolve) => {
      const client = new net.Socket();
      const timeout = setTimeout(() => {
        client.destroy();
        monitoringResults.services[serviceName] = { status: 'unreachable' };
        log(STATUS.WARNING, `${serviceName} - Service unreachable at ${config.host}:${config.port}`);
        addAlert('warning', `Service ${serviceName} is unreachable`);
        resolve();
      }, 3000);
      
      client.connect(config.port, config.host, () => {
        clearTimeout(timeout);
        monitoringResults.services[serviceName] = { status: 'connected' };
        log(STATUS.OK, `${serviceName} - Service accessible at ${config.host}:${config.port}`);
        monitoringResults.summary.passed++;
        client.destroy();
        resolve();
      });
      
      client.on('error', () => {
        clearTimeout(timeout);
        monitoringResults.services[serviceName] = { status: 'error' };
        log(STATUS.ERROR, `${serviceName} - Connection failed to ${config.host}:${config.port}`);
        addAlert('error', `Service ${serviceName} connection failed`);
        client.destroy();
        resolve();
      });
    });
  }
}

// Generate summary report
function generateSummary() {
  console.log('\n' + '='.repeat(60));
  console.log(`${colors.cyan}INFRASTRUCTURE MONITORING SUMMARY${colors.reset}`);
  console.log('='.repeat(60));
  
  const { totalChecks, passed, warnings, failures } = monitoringResults.summary;
  const healthScore = Math.round((passed / totalChecks) * 100);
  
  console.log(`Timestamp: ${monitoringResults.timestamp}`);
  console.log(`Total Checks: ${totalChecks}`);
  console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
  console.log(`${colors.yellow}Warnings: ${warnings}${colors.reset}`);
  console.log(`${colors.red}Failures: ${failures}${colors.reset}`);
  console.log(`Health Score: ${healthScore}%`);
  
  if (monitoringResults.alerts.length > 0) {
    console.log('\n' + colors.yellow + 'ALERTS:' + colors.reset);
    monitoringResults.alerts.forEach(alert => {
      const alertColor = alert.level === 'error' ? colors.red : colors.yellow;
      console.log(`  ${alertColor}[${alert.level.toUpperCase()}]${colors.reset} ${alert.message}`);
    });
  }
  
  // Overall status
  console.log('\n' + '='.repeat(60));
  if (failures > 0) {
    console.log(`${colors.red}OVERALL STATUS: CRITICAL - ${failures} critical issues detected${colors.reset}`);
    process.exit(1);
  } else if (warnings > 0) {
    console.log(`${colors.yellow}OVERALL STATUS: WARNING - ${warnings} warnings detected${colors.reset}`);
    process.exit(0);
  } else {
    console.log(`${colors.green}OVERALL STATUS: HEALTHY - All systems operational${colors.reset}`);
    process.exit(0);
  }
}

// Main monitoring function
async function runMonitoring() {
  console.log(`${colors.cyan}Starting Infrastructure Monitoring...${colors.reset}`);
  console.log('='.repeat(60));
  
  // Run all checks
  console.log('\n' + colors.blue + 'Backend Health Check:' + colors.reset);
  await checkBackendHealth();
  
  console.log('\n' + colors.blue + 'Docker Container Status:' + colors.reset);
  await checkDockerContainers();
  
  console.log('\n' + colors.blue + 'Service Connectivity:' + colors.reset);
  await checkServiceConnectivity();
  
  // Generate summary
  generateSummary();
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error(`${STATUS.ERROR} Unhandled error: ${error.message}`);
  process.exit(1);
});

// Run monitoring
runMonitoring().catch(error => {
  console.error(`${STATUS.ERROR} Monitoring failed: ${error.message}`);
  process.exit(1);
});