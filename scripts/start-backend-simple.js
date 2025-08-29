#!/usr/bin/env node

/**
 * Simple backend starter for delegation testing
 * Bypasses Docker dependency and starts core services
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting HomeOps Backend (Simple Mode)...');

// Set environment variables for simple mode
const env = {
  ...process.env,
  NODE_ENV: 'development',
  PORT: '3101',
  SKIP_DOCKER_SERVICES: 'true',
  DELEGATION_WS_PORT: '3201',
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6380',
  REDIS_PASSWORD: 'homeops123'
};

// Start the backend server
const backendProcess = spawn('npm', ['run', 'dev'], {
  cwd: path.join(__dirname, '../backend'),
  env: env,
  stdio: 'inherit',
  shell: true
});

backendProcess.on('error', (error) => {
  console.error('❌ Failed to start backend:', error);
  process.exit(1);
});

backendProcess.on('close', (code) => {
  console.log(`Backend process exited with code ${code}`);
  process.exit(code);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Shutting down backend...');
  backendProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('🛑 Shutting down backend...');
  backendProcess.kill('SIGTERM');
});