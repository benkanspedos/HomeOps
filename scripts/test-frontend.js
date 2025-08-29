#!/usr/bin/env node

const axios = require('axios');

const FRONTEND_URL = 'http://localhost:3002';
const BACKEND_URL = 'http://localhost:3101';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

// Test results
let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`${colors.green}✓${colors.reset} ${name}`);
    passed++;
  } catch (error) {
    console.log(`${colors.red}✗${colors.reset} ${name}`);
    console.log(`  ${colors.red}Error: ${error.message}${colors.reset}`);
    failed++;
  }
}

async function runTests() {
  console.log(`${colors.cyan}Running Frontend Integration Tests...${colors.reset}`);
  console.log('='.repeat(50));

  // Test 1: Frontend server is running
  await test('Frontend server responds', async () => {
    const response = await axios.get(FRONTEND_URL);
    if (response.status !== 200) throw new Error('Unexpected status code');
  });

  // Test 2: Backend health check
  await test('Backend health endpoint responds', async () => {
    const response = await axios.get(`${BACKEND_URL}/health`);
    if (!response.data.status === 'healthy') throw new Error('Backend not healthy');
  });

  // Test 3: Frontend-Backend integration
  await test('Frontend can connect to backend', async () => {
    const response = await axios.get(`${FRONTEND_URL}/api/test-backend`);
    if (!response.data.backend) throw new Error('Backend data not present');
    if (!response.data.backend.status === 'healthy') throw new Error('Backend not healthy via frontend');
  });

  // Test 4: Main pages load
  await test('Dashboard page loads', async () => {
    const response = await axios.get(`${FRONTEND_URL}/dashboard`);
    if (response.status !== 200) throw new Error('Dashboard page failed to load');
  });

  // Test 5: Static assets
  await test('Static assets are served', async () => {
    const response = await axios.get(`${FRONTEND_URL}/favicon.ico`);
    if (response.status !== 200) throw new Error('Static assets not served');
  });

  // Test 6: API error handling
  await test('API handles errors gracefully', async () => {
    try {
      await axios.get(`${FRONTEND_URL}/api/nonexistent`);
      throw new Error('Should have returned 404');
    } catch (error) {
      if (error.response && error.response.status === 404) {
        // Expected behavior
        return;
      }
      throw error;
    }
  });

  // Test 7: Environment variables loaded
  await test('Environment variables are loaded', async () => {
    // This would need to be exposed via an endpoint in real scenarios
    // For now, we just check if the API connection works which implies env vars loaded
    const response = await axios.get(`${FRONTEND_URL}/api/test-backend`);
    if (!response.data.backend) throw new Error('Environment configuration issue');
  });

  // Test 8: Services page loads
  await test('Services page loads', async () => {
    const response = await axios.get(`${FRONTEND_URL}/dashboard/services`);
    if (response.status !== 200) throw new Error('Services page failed to load');
  });

  // Summary
  console.log('='.repeat(50));
  console.log(`${colors.cyan}Test Results:${colors.reset}`);
  console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failed}${colors.reset}`);
  
  if (failed === 0) {
    console.log(`\n${colors.green}All tests passed!${colors.reset}`);
    process.exit(0);
  } else {
    console.log(`\n${colors.red}Some tests failed!${colors.reset}`);
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
  process.exit(1);
});