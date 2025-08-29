#!/usr/bin/env node

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
};

const testResults = {
  unit: null,
  e2e: null,
  integration: null,
  typecheck: null,
  lint: null,
};

async function runTest(name, command, continueOnError = true) {
  console.log(`${colors.cyan}Running ${name}...${colors.reset}`);
  
  try {
    const { stdout, stderr } = await execAsync(command);
    console.log(stdout);
    if (stderr && !stderr.includes('Warning')) {
      console.error(stderr);
    }
    testResults[name] = { passed: true };
    console.log(`${colors.green}✓ ${name} passed${colors.reset}\n`);
  } catch (error) {
    console.error(error.stdout || error.message);
    testResults[name] = { passed: false, error: error.message };
    console.log(`${colors.red}✗ ${name} failed${colors.reset}\n`);
    
    if (!continueOnError) {
      process.exit(1);
    }
  }
}

async function runAllTests() {
  console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.blue}HomeOps Comprehensive Test Suite${colors.reset}`);
  console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}\n`);

  // 1. Type checking
  await runTest('typecheck', 'npm run type-check');

  // 2. Linting (if configured)
  // await runTest('lint', 'npm run lint');

  // 3. Unit tests
  await runTest('unit', 'npm test -- --passWithNoTests');

  // 4. Integration tests (frontend-backend)
  console.log(`${colors.cyan}Running integration tests...${colors.reset}`);
  try {
    // Check if services are running
    const backendHealth = await execAsync('curl -s http://localhost:3101/health');
    console.log('Backend health check passed');
    
    const frontendTest = await execAsync('node scripts/test-frontend.js');
    console.log('Frontend integration tests passed');
    
    testResults.integration = { passed: true };
    console.log(`${colors.green}✓ Integration tests passed${colors.reset}\n`);
  } catch (error) {
    testResults.integration = { passed: false, error: 'Services not running or tests failed' };
    console.log(`${colors.yellow}⚠ Integration tests skipped (services may not be running)${colors.reset}\n`);
  }

  // 5. E2E tests with Playwright (optional - takes longer)
  const runE2E = process.argv.includes('--e2e');
  if (runE2E) {
    await runTest('e2e', 'npx playwright test --reporter=list');
  } else {
    console.log(`${colors.yellow}E2E tests skipped (use --e2e to run)${colors.reset}\n`);
  }

  // Print summary
  console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.blue}Test Summary${colors.reset}`);
  console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}`);

  let totalPassed = 0;
  let totalFailed = 0;

  Object.entries(testResults).forEach(([name, result]) => {
    if (result === null) return;
    
    const status = result.passed
      ? `${colors.green}✓ PASSED${colors.reset}`
      : `${colors.red}✗ FAILED${colors.reset}`;
    
    console.log(`${name.padEnd(15)} ${status}`);
    
    if (result.passed) totalPassed++;
    else totalFailed++;
  });

  console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}`);
  console.log(`Total: ${colors.green}${totalPassed} passed${colors.reset}, ${colors.red}${totalFailed} failed${colors.reset}`);

  // Exit with appropriate code
  if (totalFailed > 0) {
    console.log(`\n${colors.red}Some tests failed!${colors.reset}`);
    process.exit(1);
  } else {
    console.log(`\n${colors.green}All tests passed!${colors.reset}`);
    process.exit(0);
  }
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
  process.exit(1);
});

// Run tests
runAllTests().catch((error) => {
  console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
  process.exit(1);
});