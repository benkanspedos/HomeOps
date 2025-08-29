# US-201: Primary DNS Management - Sequential Execution Prompts

## Story Details
- **Story ID**: US-201
- **Story Points**: 3
- **Priority**: P0 (Essential)
- **Sprint**: 1
- **Status**: READY TO START
- **Dependencies**: INFRA-001 (COMPLETE)

## Sequential Execution Mode
Per updated Stage 5 guidelines, execute these tracks sequentially in a single terminal.

## Track 1: Backend Implementation - API & Pi-hole Integration

```markdown
You are implementing the backend for DNS management in the HomeOps project. The infrastructure is fully operational with Pi-hole on port 8081.

## Requirements:
Implement DNS management API endpoints with Pi-hole integration for:
1. DNS server connectivity to Pi-hole
2. Domain list management (add/remove/block)
3. Query history tracking
4. Performance monitoring

## Current Infrastructure:
- Pi-hole Admin: http://localhost:8081/admin/ (password: homeops2025)
- Backend API: http://localhost:3101
- Database: Supabase (schema exists)
- Redis: localhost:6380

## Tasks:

### 1. Create DNS Service Layer
Create `C:\Projects\HomeOps\backend\src\services\dns.service.ts`:
- Pi-hole API client using axios
- Methods: getStatus(), getDomains(), addDomain(), removeDomain(), blockDomain()
- Query history retrieval: getQueryHistory(limit, offset)
- Performance metrics: getPerformanceStats()
- Use Pi-hole API endpoints: /admin/api.php

### 2. Create DNS Controller
Create `C:\Projects\HomeOps\backend\src\controllers\dns.controller.ts`:
- GET /api/dns/status - Pi-hole connectivity status
- GET /api/dns/domains - List all domains with block status
- POST /api/dns/domains - Add new domain
- DELETE /api/dns/domains/:domain - Remove domain
- PUT /api/dns/domains/:domain/block - Block/unblock domain
- GET /api/dns/queries - Query history with pagination
- GET /api/dns/performance - Performance metrics

### 3. Database Models
Update `C:\Projects\HomeOps\backend\src\models\dns.model.ts`:
- Domain tracking table: domains (id, domain, blocked, added_at, updated_at)
- Query history table: dns_queries (id, domain, client_ip, query_type, timestamp, blocked)
- Performance metrics table: dns_metrics (id, queries_today, blocked_today, avg_response_time, timestamp)

### 4. Redis Caching
Update `C:\Projects\HomeOps\backend\src\services\cache.service.ts`:
- Cache DNS status (TTL: 30s)
- Cache domain lists (TTL: 5 minutes)
- Cache query history (TTL: 1 minute)
- Invalidate on domain updates

### 5. Environment Configuration
Update `C:\Projects\HomeOps\backend\.env`:
- PIHOLE_API_URL=http://localhost:8081/admin/api.php
- PIHOLE_API_KEY=(retrieve from Pi-hole settings)
- DNS_CACHE_TTL=30

### 6. Routes Registration
Update `C:\Projects\HomeOps\backend\src\routes\index.ts`:
- Register DNS routes under /api/dns/*
- Apply authentication middleware
- Add rate limiting for mutations

Test the implementation:
- Verify Pi-hole connectivity: curl http://localhost:3101/api/dns/status
- Test domain management endpoints
- Confirm database persistence
- Check Redis caching behavior

File paths to create/modify:
- backend/src/services/dns.service.ts (new)
- backend/src/controllers/dns.controller.ts (new)
- backend/src/models/dns.model.ts (new)
- backend/src/routes/dns.routes.ts (new)
- backend/src/services/cache.service.ts (modify)
- backend/src/routes/index.ts (modify)
- backend/.env (modify)
```

## Track 2: Frontend Implementation - UI & State Management

```markdown
You are implementing the frontend for DNS management in the HomeOps project. The backend API from Track 1 is complete and operational.

## Requirements:
Build the DNS management UI with:
1. DNS server status display
2. Domain list management interface
3. Query history viewer
4. Performance monitoring dashboard

## Current Setup:
- Frontend: Next.js 14 on http://localhost:3000
- Backend API: http://localhost:3101/api/dns/*
- UI Library: React 18 with TypeScript
- State: React Query for server state

## Tasks:

### 1. DNS API Client
Create `C:\Projects\HomeOps\frontend\src\lib\api\dns.ts`:
- API client using fetch with error handling
- Methods matching backend endpoints:
  - getStatus(), getDomains(), addDomain(), removeDomain()
  - blockDomain(), getQueries(), getPerformance()
- Type definitions for all responses

### 2. React Query Hooks
Create `C:\Projects\HomeOps\frontend\src\hooks\useDns.ts`:
- useQuery hooks: useDnsStatus(), useDomains(), useQueries(), usePerformance()
- useMutation hooks: useAddDomain(), useRemoveDomain(), useBlockDomain()
- Optimistic updates and cache invalidation
- Error handling with toast notifications

### 3. DNS Dashboard Page
Create `C:\Projects\HomeOps\frontend\src\app\dns\page.tsx`:
- Server status card (connected/disconnected indicator)
- Performance metrics cards (queries today, blocked, avg response time)
- Domain management section
- Query history table
- Use shadcn/ui components

### 4. Domain Management Component
Create `C:\Projects\HomeOps\frontend\src\components\dns\DomainManager.tsx`:
- Domain list with search/filter
- Add domain form with validation
- Block/unblock toggle switches
- Bulk operations (select multiple)
- Real-time updates via React Query

### 5. Query History Component
Create `C:\Projects\HomeOps\frontend\src\components\dns\QueryHistory.tsx`:
- Paginated table with sorting
- Filters: date range, blocked only, client IP
- Search by domain name
- Export to CSV functionality
- Auto-refresh every 30 seconds

### 6. Performance Monitor Component
Create `C:\Projects\HomeOps\frontend\src\components\dns\PerformanceMonitor.tsx`:
- Real-time metrics display
- Charts using recharts library
- Query volume over time
- Block rate percentage
- Response time trends

### 7. Navigation Update
Update `C:\Projects\HomeOps\frontend\src\components\layout\Sidebar.tsx`:
- Add DNS Management menu item
- Icon: Shield or Globe icon
- Route: /dns
- Active state handling

### 8. Types Definition
Create `C:\Projects\HomeOps\frontend\src\types\dns.ts`:
- Interface for Domain, Query, PerformanceMetrics
- API response types
- Form validation schemas using zod

Test the implementation:
- Navigate to http://localhost:3000/dns
- Verify real-time status updates
- Test domain CRUD operations
- Check query history pagination
- Confirm performance charts render

File paths to create/modify:
- frontend/src/lib/api/dns.ts (new)
- frontend/src/hooks/useDns.ts (new)
- frontend/src/app/dns/page.tsx (new)
- frontend/src/components/dns/DomainManager.tsx (new)
- frontend/src/components/dns/QueryHistory.tsx (new)
- frontend/src/components/dns/PerformanceMonitor.tsx (new)
- frontend/src/components/layout/Sidebar.tsx (modify)
- frontend/src/types/dns.ts (new)
```

## Track 3: Testing & Validation - Complete Test Coverage

```markdown
You are implementing comprehensive testing for the DNS management feature in HomeOps. Backend and frontend from Tracks 1-2 are complete.

## Requirements:
Implement full test coverage for:
1. Backend API endpoints and Pi-hole integration
2. Frontend components and user interactions
3. End-to-end user workflows
4. Integration between all systems

## Testing Infrastructure:
- Backend: Jest with supertest
- Frontend: Jest with React Testing Library
- E2E: Playwright
- All test infrastructure is configured

## Tasks:

### 1. Backend Unit Tests
Create `C:\Projects\HomeOps\backend\src\tests\services\dns.service.test.ts`:
- Mock Pi-hole API responses
- Test all service methods
- Error handling scenarios
- Cache interaction verification
- Database operation mocks

### 2. Backend Integration Tests
Create `C:\Projects\HomeOps\backend\src\tests\controllers\dns.controller.test.ts`:
- Test all API endpoints
- Authentication/authorization
- Request validation
- Response formats
- Error responses (400, 401, 404, 500)
- Rate limiting behavior

### 3. Frontend Component Tests
Create `C:\Projects\HomeOps\frontend\src\components\dns\__tests__\DomainManager.test.tsx`:
- Render tests for all states
- User interaction simulations
- Form validation testing
- API call mocking
- Error state handling
- Loading states

### 4. Frontend Hook Tests
Create `C:\Projects\HomeOps\frontend\src\hooks\__tests__\useDns.test.ts`:
- React Query hook testing
- Mutation success/failure
- Cache invalidation
- Optimistic updates
- Error recovery

### 5. E2E Test Scenarios
Create `C:\Projects\HomeOps\e2e\tests\dns-management.spec.ts`:
```typescript
// Test scenarios to implement:
test('DNS server status display', async ({ page }) => {
  // Navigate to DNS page
  // Verify status indicator
  // Check connection details
});

test('Add and block domain', async ({ page }) => {
  // Add new domain
  // Verify in list
  // Toggle block status
  // Confirm persistence
});

test('Query history filtering', async ({ page }) => {
  // View query history
  // Apply date filter
  // Search by domain
  // Verify pagination
});

test('Performance metrics display', async ({ page }) => {
  // Check metrics cards
  // Verify chart rendering
  // Test auto-refresh
});

test('Bulk domain operations', async ({ page }) => {
  // Select multiple domains
  // Bulk block/unblock
  // Verify updates
});
```

### 6. API Contract Tests
Create `C:\Projects\HomeOps\backend\src\tests\contracts\dns.contract.test.ts`:
- Validate API response schemas
- Test backward compatibility
- Document API contracts
- Generate OpenAPI spec

### 7. Performance Tests
Create `C:\Projects\HomeOps\backend\src\tests\performance\dns.perf.test.ts`:
- Load test domain list endpoint
- Query history pagination performance
- Cache hit/miss ratios
- Database query optimization

### 8. Test Data Fixtures
Create `C:\Projects\HomeOps\tests\fixtures\dns.fixtures.ts`:
- Sample domains list
- Query history data
- Performance metrics
- Error scenarios

### 9. CI/CD Integration
Update `C:\Projects\HomeOps\.github\workflows\test.yml`:
- Run all test suites
- Coverage reporting
- E2E tests against test environment
- Performance benchmarks

### 10. Test Documentation
Create `C:\Projects\HomeOps\docs\testing\DNS_TEST_PLAN.md`:
- Test coverage matrix
- Manual test scenarios
- Performance benchmarks
- Known issues/limitations

Run complete test suite:
```bash
# Backend tests
cd backend && npm test

# Frontend tests  
cd frontend && npm test

# E2E tests
npm run test:e2e

# Full coverage report
npm run test:coverage
```

Validation checklist:
- [ ] All API endpoints have >90% coverage
- [ ] Frontend components fully tested
- [ ] E2E covers critical user paths
- [ ] Performance meets requirements
- [ ] No console errors/warnings
- [ ] Pi-hole integration verified

File paths to create:
- backend/src/tests/services/dns.service.test.ts
- backend/src/tests/controllers/dns.controller.test.ts
- backend/src/tests/contracts/dns.contract.test.ts
- backend/src/tests/performance/dns.perf.test.ts
- frontend/src/components/dns/__tests__/*.test.tsx
- frontend/src/hooks/__tests__/useDns.test.ts
- e2e/tests/dns-management.spec.ts
- tests/fixtures/dns.fixtures.ts
- docs/testing/DNS_TEST_PLAN.md
```

## Execution Instructions

Execute these prompts sequentially in a single terminal session:

1. **Start with Track 1** - Complete backend implementation
2. **Then Track 2** - Build frontend once API is ready
3. **Finish with Track 3** - Validate everything with comprehensive tests

Each track builds upon the previous one, ensuring proper dependencies and integration. The sequential approach ensures clean handoffs and reduces complexity compared to parallel execution.

## Success Criteria
- Pi-hole integration working with real DNS data
- Full CRUD operations for domain management  
- Query history with filtering and pagination
- Performance monitoring with real-time updates
- >90% test coverage across all components
- E2E tests passing for all user workflows

## Next Steps
1. Copy the Track 1 prompt and start backend implementation
2. Once backend is complete, proceed with Track 2 frontend
3. Finish with Track 3 testing to validate everything
4. Update thread-archives with session outcomes

---

**Generated**: 2025-08-28
**Story**: US-201
**Sprint**: 1
**Mode**: Sequential Execution