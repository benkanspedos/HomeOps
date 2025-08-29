# HomeOps Testing Documentation

This directory contains comprehensive testing documentation for the HomeOps DNS Management system.

## Quick Start

### Running All Tests
```bash
# Install dependencies
npm install
cd backend && npm install

# Run complete test suite
npm run test:all

# Run with coverage report
npm run test:coverage
```

### Test Commands Reference

| Command | Description | Location |
|---------|-------------|----------|
| `npm test` | Frontend unit tests | Root |
| `npm run test:watch` | Watch mode frontend tests | Root |
| `npm run test:e2e` | End-to-end tests | Root |
| `cd backend && npm test` | Backend all tests | Backend |
| `cd backend && npm run test:unit` | Backend unit tests only | Backend |
| `cd backend && npm run test:integration` | Backend integration tests | Backend |
| `cd backend && npm run test:performance` | Performance benchmarks | Backend |

## Test Documentation

### Primary Documents
- **[DNS_TEST_PLAN.md](DNS_TEST_PLAN.md)** - Comprehensive testing strategy and coverage matrix
- **Test Results** - Generated in CI/CD pipeline

### Test Structure Overview

```
HomeOps/
├── backend/src/tests/
│   ├── services/           # Unit tests for business logic
│   ├── controllers/        # API integration tests  
│   ├── contracts/          # API schema validation
│   └── performance/        # Performance benchmarks
├── components/*/tests/     # Frontend component tests
├── hooks/tests/           # React hooks tests
├── e2e/tests/            # End-to-end user scenarios
└── tests/fixtures/       # Shared test data
```

## Test Categories Explained

### 🧪 Unit Tests
**Purpose**: Test individual functions and components in isolation  
**Speed**: Fast (< 1s per test)  
**When**: Every code change  
**Coverage**: 90%+ target  

**Examples:**
- DNS service methods with mocked dependencies
- React component rendering with test props
- Utility functions with edge cases

### 🔗 Integration Tests  
**Purpose**: Test component interactions and API endpoints  
**Speed**: Medium (1-5s per test)  
**When**: Feature completion  
**Coverage**: 80%+ target  

**Examples:**
- HTTP API endpoints with real request/response
- Database operations with test data
- Service layer integration

### 📋 Contract Tests
**Purpose**: Validate API schemas and backward compatibility  
**Speed**: Fast (< 1s per test)  
**When**: API changes  
**Coverage**: 100% of public APIs  

**Examples:**
- Response schema validation
- Request parameter validation  
- Error format consistency

### 🎭 End-to-End Tests
**Purpose**: Test complete user workflows  
**Speed**: Slow (10-30s per scenario)  
**When**: Release preparation  
**Coverage**: Critical user paths  

**Examples:**
- Adding and managing DNS domains
- Viewing query history and metrics
- Responsive design validation

### ⚡ Performance Tests
**Purpose**: Validate response times and resource usage  
**Speed**: Variable (30s-2min)  
**When**: Performance optimization  
**Coverage**: Key performance metrics  

**Examples:**
- API response time benchmarks
- Concurrent request handling
- Memory usage monitoring

## Test Infrastructure

### Required Services
```bash
# Start test database
docker-compose -f docker-compose.test.yml up -d postgres redis

# Or use local services
# PostgreSQL on port 5432
# Redis on port 6379
```

### Environment Setup
```bash
# Backend test environment
cd backend
cp .env.example .env.test
# Edit DATABASE_URL and REDIS_URL for test services

# Frontend test environment  
cp .env.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Playwright Setup (E2E)
```bash
# Install browsers
npx playwright install

# Run E2E tests
npm run test:e2e

# Debug mode
npm run test:e2e -- --debug

# Headed mode (see browser)
npm run test:e2e -- --headed
```

## Continuous Integration

Tests run automatically on:
- ✅ Push to any branch
- ✅ Pull request creation
- ✅ Daily scheduled maintenance
- ✅ Pre-deployment validation

### CI/CD Pipeline
1. **Code Quality** - Linting, type checking, formatting
2. **Unit Tests** - Fast isolated tests  
3. **Integration Tests** - API and database tests
4. **E2E Tests** - User workflow validation
5. **Performance Tests** - Benchmark validation
6. **Security Scans** - Vulnerability detection

## Writing Tests

### Best Practices

#### ✅ Good Test Practices
```typescript
// Clear test names
test('should add domain to blocklist successfully', async () => {
  // Arrange - Set up test data
  const domain = 'ads.example.com';
  
  // Act - Perform the operation
  const result = await dnsService.addDomain(domain, 'black');
  
  // Assert - Verify the outcome
  expect(result.success).toBe(true);
  expect(mockCache.delete).toHaveBeenCalledWith('dns:domains:black');
});

// Test edge cases
test('should handle invalid domain format', async () => {
  const invalidDomain = 'invalid domain';
  
  await expect(dnsService.addDomain(invalidDomain))
    .rejects.toThrow('Invalid domain format');
});
```

#### ❌ Avoid These Patterns
```typescript
// Vague test names
test('domain test', () => { ... });

// Testing implementation details
expect(component.find('.internal-class')).toExist();

// Hard-coded test data
const domain = 'test123.com'; // Use fixtures instead

// No cleanup
// Always clean up after tests
```

### Test Data Management

#### Using Fixtures
```typescript
import { mockPiHoleStatus, mockDomainList } from '../../tests/fixtures/dns.fixtures';

test('should return Pi-hole status', async () => {
  mockDnsService.getStatus.mockResolvedValue(mockPiHoleStatus);
  // ... test implementation
});
```

#### Generating Test Data
```typescript
// Dynamic test data for edge cases
const generateLargeDomainList = (count: number) => 
  Array.from({ length: count }, (_, i) => ({
    id: i,
    domain: `test-${i}.example.com`,
    blocked: i % 2 === 0
  }));
```

## Debugging Tests

### Common Issues

#### Test Timeouts
```bash
# Increase timeout for slow tests
npm test -- --testTimeout=10000

# Or in test file
jest.setTimeout(10000);
```

#### Mock Issues
```typescript
// Clear mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});

// Reset modules
beforeEach(() => {
  jest.resetModules();
});
```

#### Database Connection
```bash
# Check database connectivity
docker-compose -f docker-compose.test.yml ps

# View logs
docker-compose -f docker-compose.test.yml logs postgres
```

### Debug Commands

```bash
# Run single test file
npm test dns.service.test.ts

# Verbose output
npm test -- --verbose

# Watch mode for development
npm test -- --watch

# Coverage report
npm run test:coverage

# Debug with Node inspector
node --inspect-brk node_modules/.bin/jest dns.service.test.ts
```

## Performance Monitoring

### Key Metrics
- **Test Execution Time**: Should be < 5 minutes total
- **Coverage Percentage**: 85%+ overall target
- **Flaky Test Rate**: < 2% acceptable
- **Performance Benchmarks**: Must meet defined thresholds

### Performance Thresholds
```typescript
const PERFORMANCE_THRESHOLDS = {
  DNS_STATUS: 200,        // ms
  DOMAINS_LIST: 500,      // ms  
  QUERY_HISTORY: 1000,    // ms
  ADD_DOMAIN: 400,        // ms
  CONCURRENT_RPS: 50,     // requests/second
};
```

## Contributing to Tests

### Adding New Tests
1. **Identify the test category** (unit, integration, e2e)
2. **Follow naming conventions** (`feature.type.test.ts`)
3. **Use existing fixtures** where possible
4. **Add performance benchmarks** for new APIs
5. **Update documentation** if needed

### Test Review Checklist
- [ ] Clear test descriptions
- [ ] Good arrange/act/assert structure  
- [ ] Edge cases covered
- [ ] Mocks properly configured
- [ ] Performance considerations
- [ ] Documentation updated

## Maintenance

### Regular Tasks
- **Weekly**: Review test failures and flaky tests
- **Monthly**: Update performance thresholds  
- **Quarterly**: Dependencies and tool updates
- **As needed**: Test data refresh

### Monitoring
- CI/CD test metrics dashboard
- Coverage reports in pull requests
- Performance trend tracking
- Test maintenance effort tracking

## Getting Help

### Resources
- **Team Chat**: #testing channel
- **Documentation**: This folder and inline comments
- **CI/CD Logs**: GitHub Actions for detailed failures
- **Performance Reports**: Generated artifacts

### Common Questions
**Q: Tests pass locally but fail in CI?**  
A: Check environment differences, service availability, timing issues

**Q: How do I test Pi-hole integration?**  
A: Use mocked responses in unit tests, real Pi-hole in E2E when available

**Q: Performance test failed, what now?**  
A: Check if it's a regression or threshold needs adjustment

**Q: Coverage dropped below threshold?**  
A: Add tests for uncovered lines or adjust coverage settings

---

For detailed testing strategies and comprehensive coverage information, see [DNS_TEST_PLAN.md](DNS_TEST_PLAN.md).