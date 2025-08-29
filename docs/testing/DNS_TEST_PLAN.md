# DNS Management Testing Plan

## Overview

This document outlines the comprehensive testing strategy for the DNS Management feature in HomeOps. The testing covers all layers from unit tests to end-to-end scenarios, ensuring robust functionality and reliable Pi-hole integration.

## Test Architecture

### Test Pyramid Structure

```
        E2E Tests (5%)
       /              \
      /                \
   Integration        API Contract
   Tests (25%)        Tests (15%)
      \              /
       \            /
      Unit Tests (55%)
```

## Test Coverage Matrix

| Component | Unit Tests | Integration Tests | Contract Tests | E2E Tests | Performance Tests |
|-----------|------------|-------------------|----------------|-----------|-------------------|
| DNS Service | ✅ | ❌ | ❌ | ❌ | ✅ |
| DNS Controller | ❌ | ✅ | ✅ | ❌ | ✅ |
| DNS Model | ❌ | ✅ | ❌ | ❌ | ❌ |
| Frontend Components | ✅ | ❌ | ❌ | ✅ | ❌ |
| React Hooks | ✅ | ❌ | ❌ | ❌ | ❌ |
| API Endpoints | ❌ | ✅ | ✅ | ✅ | ✅ |
| User Workflows | ❌ | ❌ | ❌ | ✅ | ❌ |

## Testing Strategy

### 1. Backend Testing

#### Unit Tests (`backend/src/tests/services/dns.service.test.ts`)
- **Scope**: DNS Service layer in isolation
- **Focus**: Business logic, error handling, cache interactions
- **Mocking**: Pi-hole API responses, cache service, logger
- **Coverage Target**: 90%+

**Test Categories:**
- ✅ Constructor and initialization
- ✅ Pi-hole status retrieval with fallback
- ✅ Domain list operations (black/white/regex)
- ✅ Domain CRUD operations
- ✅ Query history pagination
- ✅ Performance metrics calculation
- ✅ Blocking status management
- ✅ Cache invalidation scenarios
- ✅ Error handling and recovery

#### Integration Tests (`backend/src/tests/controllers/dns.controller.test.ts`)
- **Scope**: HTTP API layer with mocked services
- **Focus**: Request/response handling, validation, status codes
- **Mocking**: DNS Service, DNS Model, external dependencies
- **Coverage Target**: 85%+

**Test Categories:**
- ✅ All HTTP endpoints (GET, POST, PUT, DELETE)
- ✅ Request validation and sanitization
- ✅ Error response formats
- ✅ Authentication and authorization
- ✅ Rate limiting behavior
- ✅ Database interaction patterns

#### Contract Tests (`backend/src/tests/contracts/dns.contract.test.ts`)
- **Scope**: API schema and response format validation
- **Focus**: Backward compatibility, data contracts
- **Tools**: Zod schema validation
- **Coverage Target**: 100% of public APIs

**Test Categories:**
- ✅ Response schema validation
- ✅ Request parameter validation
- ✅ Error response consistency
- ✅ Content-Type headers
- ✅ API versioning compatibility

#### Performance Tests (`backend/src/tests/performance/dns.perf.test.ts`)
- **Scope**: Response times, throughput, resource usage
- **Focus**: Performance thresholds and scalability
- **Metrics**: Response time, memory usage, concurrent requests
- **Thresholds**: Defined per endpoint

**Performance Benchmarks:**
- DNS Status: < 200ms
- Domains List: < 500ms  
- Query History: < 1000ms
- Add/Remove Domain: < 400ms
- Concurrent Requests: 50+ RPS
- Memory Usage: < 100MB increase per 100 requests

### 2. Frontend Testing

#### Component Tests (`components/dns/__tests__/DomainManager.test.tsx`)
- **Scope**: React components in isolation
- **Focus**: Rendering, user interactions, state management
- **Tools**: React Testing Library, Jest
- **Coverage Target**: 80%+

**Test Categories:**
- ✅ Component rendering in all states
- ✅ User interaction simulation
- ✅ Form validation and submission
- ✅ API call mocking and error handling
- ✅ Accessibility compliance
- ✅ Keyboard navigation support

#### Hook Tests (`hooks/__tests__/useDns.test.ts`)
- **Scope**: React Query hooks and state management
- **Focus**: Data fetching, mutations, cache behavior
- **Tools**: React Hooks Testing Library
- **Coverage Target**: 85%+

**Test Categories:**
- ✅ Query hooks (status, domains, performance)
- ✅ Mutation hooks (add, remove, block domains)
- ✅ Optimistic updates and rollback
- ✅ Cache invalidation patterns
- ✅ Error handling and retry logic
- ✅ Loading states and success callbacks

### 3. End-to-End Testing

#### E2E Tests (`e2e/tests/dns-management.spec.ts`)
- **Scope**: Complete user workflows across the system
- **Focus**: Real user scenarios and integration points
- **Tools**: Playwright
- **Coverage Target**: Critical user paths

**Test Scenarios:**
- ✅ DNS server status display and monitoring
- ✅ Domain management (add, remove, block/unblock)
- ✅ Search and filtering functionality  
- ✅ Bulk domain operations
- ✅ Query history viewing and pagination
- ✅ Performance metrics visualization
- ✅ Export functionality
- ✅ Responsive design and mobile support
- ✅ Error handling and recovery
- ✅ Data persistence across page refreshes

## Test Data Management

### Fixtures (`tests/fixtures/dns.fixtures.ts`)
Centralized test data including:
- Mock Pi-hole status responses
- Sample domain lists (blocked/allowed)
- Query history samples
- Performance metrics data
- API response templates
- Valid/invalid domain examples

### Test Database
- Isolated test database per test run
- Automatic cleanup between tests
- Seed data for integration tests
- Migration testing support

## Running Tests

### Local Development

```bash
# Backend Tests
cd backend

# Unit tests
npm run test:unit
npm run test:unit -- --watch

# Integration tests  
npm run test:integration

# Contract tests
npm run test:contract

# Performance tests
npm run test:performance

# All backend tests
npm test

# Frontend Tests

# Unit tests
npm run test
npm run test -- --watch

# Component tests
npm run test:components

# Hook tests  
npm run test:hooks

# E2E Tests
npm run test:e2e

# All tests with coverage
npm run test:coverage
```

### CI/CD Pipeline

Tests run automatically on:
- Every push to feature branches
- Pull requests to main/develop  
- Scheduled maintenance runs
- Pre-deployment validation

### Test Environments

1. **Development**: Local with mocked Pi-hole
2. **CI/CD**: Containerized with test services
3. **Staging**: Real Pi-hole instance (limited)
4. **Production**: Smoke tests only

## Performance Requirements

### Response Time Thresholds
- DNS Status API: < 200ms (95th percentile)
- Domain Operations: < 400ms (95th percentile)  
- Query History: < 1000ms (95th percentile)
- Frontend Page Load: < 2s (initial), < 500ms (navigation)

### Scalability Targets
- Concurrent Users: 50+
- Domain List Size: 10,000+ domains
- Query History: 100,000+ records
- API Throughput: 100+ requests/second

### Resource Limits
- Memory Usage: < 512MB (backend), < 256MB (frontend)
- CPU Usage: < 70% under normal load
- Database Connections: < 20 concurrent

## Quality Gates

### Code Coverage Requirements
- Backend Unit Tests: 90%+
- Backend Integration Tests: 80%+
- Frontend Component Tests: 80%+
- Frontend Hook Tests: 85%+
- Overall Coverage: 85%+

### Test Quality Metrics
- Test Execution Time: < 5 minutes (unit + integration)
- E2E Test Time: < 15 minutes
- Flaky Test Rate: < 2%
- Test Maintenance Effort: < 10% of development time

## Continuous Improvement

### Test Metrics Tracking
- Coverage trends over time
- Test execution performance
- Defect detection effectiveness
- Test maintenance costs

### Regular Reviews
- Monthly test plan review
- Quarterly performance baseline updates
- Test debt assessment and cleanup
- Tool and framework updates

## Known Limitations

### Current Constraints
- Pi-hole API may have rate limiting
- E2E tests require Docker environment
- Performance tests need dedicated resources
- Some edge cases require manual testing

### Future Enhancements
- Visual regression testing
- Load testing with realistic data volumes
- Cross-browser compatibility testing
- Mobile device testing automation
- Security penetration testing

## Troubleshooting

### Common Issues

#### Test Failures
1. **Pi-hole Connection**: Check mock setup and network connectivity
2. **Database Issues**: Ensure test database is running and accessible
3. **Timing Issues**: Increase timeouts or add proper wait conditions
4. **Cache Problems**: Clear test data between runs

#### Performance Issues  
1. **Slow Tests**: Profile and optimize test execution
2. **Memory Leaks**: Monitor resource usage in long-running tests
3. **Flaky Tests**: Identify and fix non-deterministic behavior

### Debug Commands
```bash
# Verbose test output
npm test -- --verbose

# Run specific test file
npm test dns.service.test.ts

# Debug mode
npm test -- --runInBand --detectOpenHandles

# Coverage report
npm run test:coverage -- --html
```

## Test Maintenance

### Regular Tasks
- Update test data to match production patterns
- Review and update performance thresholds
- Maintain test infrastructure and dependencies
- Clean up obsolete or redundant tests

### Documentation Updates
- Keep test plans synchronized with feature changes
- Update troubleshooting guides based on common issues
- Document new testing patterns and best practices

## Conclusion

This comprehensive testing strategy ensures the DNS Management feature is robust, performant, and reliable. The multi-layered approach provides confidence in both individual components and the overall system integration with Pi-hole.

The test suite is designed to catch issues early in development, prevent regressions, and maintain high quality standards throughout the product lifecycle.