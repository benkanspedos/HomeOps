# INFRA-001 Parallel Execution Guide

## Sprint 1: Docker & Core Infrastructure Setup
**Total Story Points**: 8
**Execution Mode**: PARALLEL (3 terminals)
**Estimated Time**: 2 hours with parallel execution

## Overview
This infrastructure setup story has been divided into three independent tracks that can be executed simultaneously in separate Claude Code terminals. Each track has no dependencies on the others and works in isolated directories to prevent conflicts.

## Track Distribution

### Track 1: Backend/Infrastructure (3 points)
- **Focus**: Docker, Gluetun VPN, Supabase, API scaffold
- **Directories**: `/docker`, `/backend`, `/supabase`
- **Branch**: `feature/infra-backend-setup`
- **Time**: ~2 hours

### Track 2: Frontend/Application (3 points)
- **Focus**: Next.js 14, React 18, TailwindCSS, PWA
- **Directories**: `/app`, `/components`, `/public`, `/lib`
- **Branch**: `feature/infra-frontend-setup`
- **Time**: ~2 hours

### Track 3: Testing/Validation (2 points)
- **Focus**: Jest, React Testing Library, Playwright, CI/CD
- **Directories**: `/tests`, `/__tests__`, `/.github`
- **Branch**: `feature/infra-testing-setup`
- **Time**: ~1.5 hours

## How to Execute

### Step 1: Open Three Terminal Windows
Open three separate PowerShell or Command Prompt windows.

### Step 2: Launch Claude Code in Each Terminal
In each terminal, navigate to the project and launch Claude Code:
```bash
cd C:\Projects\HomeOps
cl
```

### Step 3: Copy Track-Specific Prompts
Copy the entire content from one of these files to each Claude instance:
- Terminal 1: Copy from `docs\sprint\INFRA-001-track-1-backend.md`
- Terminal 2: Copy from `docs\sprint\INFRA-001-track-2-frontend.md`
- Terminal 3: Copy from `docs\sprint\INFRA-001-track-3-testing.md`

### Step 4: Execute in Parallel
Each Claude instance will work independently on its track. They won't interfere with each other because:
- Each works in different directories
- Each creates different files
- Each uses a different git branch

### Step 5: Monitor Progress
You can check progress by:
- Watching the file creation in each directory
- Running the verification commands listed in each track
- Checking git status on each branch

## Conflict Avoidance Matrix

| Track | Owns | Avoids | Creates Branch |
|-------|------|--------|----------------|
| Backend | `/docker`, `/backend`, `/supabase`, `.env*` | `/app`, `/components`, `/tests` | `feature/infra-backend-setup` |
| Frontend | `/app`, `/components`, `/public`, `/lib` | `/backend`, `/docker`, `/tests` | `feature/infra-frontend-setup` |
| Testing | `/tests`, `/__tests__`, `/.github` | `/src`, `/app`, `/backend` | `feature/infra-testing-setup` |

## Merge Strategy

After all tracks complete:

1. **Test Each Branch Independently**
```bash
# Backend
git checkout feature/infra-backend-setup
docker-compose up -d
npm run dev

# Frontend
git checkout feature/infra-frontend-setup
npm run dev
npm run build

# Testing
git checkout feature/infra-testing-setup
npm test
npm run test:e2e
```

2. **Merge to Main**
```bash
git checkout main
git merge feature/infra-backend-setup
git merge feature/infra-frontend-setup
git merge feature/infra-testing-setup
```

3. **Integration Testing**
```bash
# Start all services
docker-compose up -d
npm run dev

# Run full test suite
npm run test:all
```

## Benefits of Parallel Execution

1. **Time Savings**: 2 hours instead of 6 hours sequential
2. **No Blocking**: Teams don't wait for each other
3. **Clear Ownership**: Each track has defined boundaries
4. **Easy Rollback**: Independent branches for each track
5. **Better Focus**: Each terminal focuses on one domain

## Troubleshooting

### If Merge Conflicts Occur
Conflicts are unlikely due to directory isolation, but if they occur:
- Package.json: Combine dependencies from all tracks
- README.md: Merge documentation sections
- .gitignore: Union of all ignore rules

### If a Track Fails
Other tracks can continue. Failed track can be:
- Restarted in a new terminal
- Fixed and continued
- Rolled back without affecting others

## Success Criteria

All tracks are complete when:
- [ ] Docker environment runs with `docker-compose up`
- [ ] Frontend loads at `http://localhost:3000`
- [ ] Backend API responds at `http://localhost:3001/api/health`
- [ ] All tests pass with `npm test`
- [ ] E2E tests pass with `npm run test:e2e`
- [ ] CI/CD workflows are green

## Next Steps

After successful completion:
1. Review and merge all branches
2. Run integration tests
3. Deploy to development environment
4. Move to next story in sprint backlog

---

**Note**: This parallel execution approach reduces the 8-point story from ~6 hours sequential to ~2 hours parallel, achieving a 3x speedup while maintaining quality and preventing conflicts.