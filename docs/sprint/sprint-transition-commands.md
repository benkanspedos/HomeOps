# Sprint Transition Commands - Moving to Sprint 2

**Current Status**: Sprint 1 Core Stories Complete  
**Next Phase**: Sprint 2 - Advanced Features  
**Date**: January 29, 2025

---

## Current Sprint 1 Status

### Completed Stories ✅
- **INFRA-001**: Docker & Core Infrastructure (100% complete)
- **US-201**: Primary DNS Management (100% complete)
- **US-101**: System Health Monitoring (100% complete)
- **US-102**: Natural Language Interface - Basic (100% complete)

### Remaining Sprint 1 Work
- Integration testing across all components
- Bug fixes and refinements
- Documentation updates
- Sprint demo preparation

---

## Option 1: Complete Sprint 1 Integration Phase

If you want to finish Sprint 1 completely before moving to Sprint 2:

```powershell
# 1. Run integration tests
cd C:\Projects\HomeOps
npm run test:integration

# 2. Check all services are running
docker-compose ps
npm run health-check

# 3. Run full system test
npm run test:e2e

# 4. Generate sprint report
/core-maintainer generate sprint-1 report

# 5. Prepare demo
npm run build
npm run start:production
```

---

## Option 2: Start Sprint 2 Development

If you want to begin Sprint 2 while Sprint 1 integration continues:

### Step 1: Create Sprint 2 Branch
```powershell
cd C:\Projects\HomeOps
git add .
git commit -m "Sprint 1: Core stories complete, moving to Sprint 2"
git checkout -b sprint-2
git push -u origin sprint-2
```

### Step 2: Start Story 1.3 - Task Delegation Framework

```powershell
# Analyze the story with Technical Orchestrator
/to analyze story 1.3 for HomeOps Sprint 2 Task Delegation Framework
```

The Technical Orchestrator will provide 3 terminal prompts for parallel execution:
- **Terminal 1**: Backend sub-agent system
- **Terminal 2**: Frontend delegation dashboard
- **Terminal 3**: Testing framework

### Step 3: Open Three Terminals

**Terminal 1 - Backend Development**:
```powershell
cd C:\Projects\HomeOps
# Paste the backend prompt from TO here
```

**Terminal 2 - Frontend Development**:
```powershell
cd C:\Projects\HomeOps
# Paste the frontend prompt from TO here
```

**Terminal 3 - Testing**:
```powershell
cd C:\Projects\HomeOps
# Paste the testing prompt from TO here
```

---

## Option 3: Quick Story Transition

For rapid story switching without Technical Orchestrator:

```powershell
# Start next story directly
cd C:\Projects\HomeOps

# Backend Terminal
/backend-dev implement task delegation system for story 1.3

# Frontend Terminal
/frontend-dev create task delegation dashboard for story 1.3

# Testing Terminal
/test-orchestrator create tests for story 1.3 task delegation
```

---

## Monitoring Progress

### Check Story Status
```powershell
/core-maintainer show sprint-2 status
```

### Update Story Progress
```powershell
/core-maintainer update story 1.3 progress 25%
```

### View Sprint Dashboard
```powershell
# Open dashboard
start http://localhost:3000/dashboard

# Or use the monitoring script
npm run monitor:sprint
```

---

## Sprint 2 Story Queue

1. **Story 1.3**: Task Delegation Framework (13 points) - START HERE
2. **Story 2.2**: Automatic DNS Failover (8 points)
3. **Story 3.1**: Financial Data Aggregation (13 points - partial)
4. **Story 1.2**: NLP Enhancements (continuation)

---

## Helper Commands

### Check System Health
```powershell
# Verify all systems operational
docker-compose ps
npm run health-check
curl http://localhost:3001/api/health
```

### Run Tests
```powershell
# Unit tests
npm test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# All tests
npm run test:all
```

### Git Operations
```powershell
# Save current work
git add .
git commit -m "Sprint 1 complete, transitioning to Sprint 2"

# Check branch status
git status
git branch -a

# Switch between sprints
git checkout sprint-1  # Go back to Sprint 1
git checkout sprint-2  # Move to Sprint 2
```

---

## Recommended Next Action

**RECOMMENDED**: Start Story 1.3 (Task Delegation Framework)

```powershell
# Quick start command
/to analyze story 1.3 for HomeOps Sprint 2
```

This will:
1. Analyze the story requirements
2. Generate parallel execution prompts
3. Provide clear implementation guidance
4. Set up proper tracking

---

## Support Commands

If you encounter issues:

```powershell
# Reset Docker environment
docker-compose down
docker-compose up -d

# Clear cache and rebuild
npm run clean
npm run build

# Check logs
docker-compose logs -f
npm run logs

# Get help
/core-maintainer help sprint-transition
```

---

**Note**: Sprint 2 builds directly on Sprint 1's foundation. Ensure all core services are running before starting new stories.

**Document Created**: January 29, 2025  
**Purpose**: Sprint transition guidance  
**Next Review**: After Story 1.3 completion