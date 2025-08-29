// Backend-specific Jest setup
// require('reflect-metadata'); // Skip if not installed

// Add custom matchers
expect.extend({
  toBeOneOf(received, array) {
    const pass = array.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be one of ${array}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be one of ${array}`,
        pass: false,
      };
    }
  },
  toBeTypeOf(received, expectedType) {
    const actualType = typeof received;
    const pass = actualType === expectedType;
    if (pass) {
      return {
        message: () => `expected ${received} not to be type ${expectedType}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be type ${expectedType}, but got ${actualType}`,
        pass: false,
      };
    }
  }
});

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/homeops_test';
process.env.REDIS_URL = 'redis://localhost:6379/1';
process.env.API_PORT = '3001';

// Mock Docker socket
process.env.DOCKER_SOCKET = '/var/run/docker.sock';

// Mock SMTP configuration
process.env.SMTP_HOST = 'smtp.test.com';
process.env.SMTP_PORT = '587';
process.env.SMTP_USER = 'test@example.com';
process.env.SMTP_PASS = 'testpass';
process.env.ALERT_EMAIL_TO = 'admin@example.com';

// Mock Slack configuration
process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';

// Mock webhook configuration
process.env.ALERT_WEBHOOK_URL = 'https://api.example.com/alerts';

// Extend Jest timeout for integration tests
jest.setTimeout(10000);

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock Date.now for consistent timestamps in tests
const mockDate = new Date('2024-01-20T10:00:00Z');
const originalDate = Date;
Date.now = jest.fn(() => mockDate.getTime());
// Keep parse and UTC methods
Date.parse = originalDate.parse;
Date.UTC = originalDate.UTC;

// Global test cleanup
afterEach(() => {
  jest.clearAllMocks();
});

// Global error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Mock performance API for performance tests
if (typeof global.performance === 'undefined') {
  global.performance = {
    now: jest.fn(() => Date.now()),
    mark: jest.fn(),
    measure: jest.fn(),
    clearMarks: jest.fn(),
    clearMeasures: jest.fn(),
    getEntriesByName: jest.fn(() => []),
    getEntriesByType: jest.fn(() => []),
  };
}

// Mock WebSocket for real-time tests
global.WebSocket = jest.fn().mockImplementation(() => ({
  onopen: null,
  onmessage: null,
  onclose: null,
  onerror: null,
  send: jest.fn(),
  close: jest.fn(),
  readyState: 1, // OPEN
}));

// Mock file system operations
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

// Mock child_process for system commands
jest.mock('child_process', () => ({
  exec: jest.fn(),
  spawn: jest.fn(),
  execSync: jest.fn(),
}));

module.exports = {};