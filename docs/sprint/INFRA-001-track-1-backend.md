# INFRA-001 - Track 1: Backend/Infrastructure Development
**Story**: Docker & Core Infrastructure Setup
**Points**: 3
**Dependencies**: None (can run independently)

## Terminal 1 Instructions - Backend/Infrastructure Track

### Your Mission
You are developing the backend infrastructure for HomeOps, focusing on Docker setup, VPN routing with Gluetun, Supabase database initialization, and API scaffolding. This track can run completely independently from the frontend and testing tracks.

### Technical Context
- **Project**: HomeOps - Smart home automation system with financial trading capabilities
- **Stack**: Docker, Gluetun VPN, Supabase (PostgreSQL), Node.js with TypeScript
- **Working Directory**: C:\Projects\HomeOps

### Your Tasks

#### 1. Docker Infrastructure Setup (45 min)
Create the Docker environment with secure VPN routing:

```yaml
# docker-compose.yml structure needed:
services:
  gluetun:
    - NordVPN configuration
    - Port forwarding for services
    - Network isolation
  
  backend:
    - Node.js TypeScript service
    - Depends on gluetun network
    - Environment variable management
  
  redis:
    - Cache layer
    - Routes through gluetun
```

Files to create:
- `docker-compose.yml` - Main orchestration file
- `docker-compose.dev.yml` - Development overrides
- `.dockerignore` - Exclude unnecessary files
- `Dockerfile.backend` - Backend service image

#### 2. Supabase Database Setup (30 min)
Initialize Supabase with authentication and core schemas:

```sql
-- Core tables needed:
- users (extends Supabase auth)
- accounts (financial accounts)
- transactions (trading records)
- alerts (notification system)
- automations (workflow definitions)
- services (docker service status)
```

Files to create:
- `supabase/config.toml` - Supabase configuration
- `supabase/migrations/001_initial_schema.sql` - Core database schema
- `supabase/migrations/002_auth_setup.sql` - Authentication configuration
- `supabase/seed.sql` - Development seed data

#### 3. Backend API Scaffold (30 min)
Set up TypeScript Node.js API structure:

```typescript
// Core modules needed:
- /api/auth - Supabase authentication wrapper
- /api/accounts - Financial account management
- /api/services - Docker service control
- /api/alerts - Notification system
- /api/health - Health checks
```

Files to create:
- `backend/package.json` - Dependencies and scripts
- `backend/tsconfig.json` - TypeScript configuration
- `backend/src/server.ts` - Express server setup
- `backend/src/config/index.ts` - Configuration management
- `backend/src/db/client.ts` - Supabase client
- `backend/src/api/routes.ts` - API route definitions
- `backend/src/types/index.ts` - TypeScript type definitions

#### 4. Environment Configuration (15 min)
Set up secure environment management:

Files to create:
- `.env.example` - Template for environment variables
- `.env.local` - Local development variables (gitignored)
- `backend/src/config/env.ts` - Environment validation
- `scripts/setup-env.ps1` - PowerShell script to initialize environment

### Expected Deliverables
1. **Docker Environment**: Fully configured docker-compose with Gluetun VPN
2. **Database**: Initialized Supabase with authentication and schemas
3. **API Structure**: TypeScript backend with core endpoints scaffolded
4. **Configuration**: Secure environment variable management

### Testing Your Work
Run these commands to verify:
```bash
# Docker setup
docker-compose config --quiet
docker-compose up -d gluetun
docker-compose ps

# Supabase
npx supabase status
npx supabase db diff --schema public

# Backend
cd backend && npm run build
npm run dev
curl http://localhost:3001/api/health
```

### Avoid Conflicts
- Work only in: `/docker`, `/backend`, `/supabase` directories
- Don't modify: `/src`, `/app`, `/components` (frontend territory)
- Don't touch: `/tests`, `jest.config.js` (testing territory)

### Notes
- Use TypeScript strict mode for all backend code
- Implement proper error handling and logging
- Follow REST API best practices
- Document all environment variables
- Ensure all services route through Gluetun VPN when configured

### Git Branch
Work on branch: `feature/infra-backend-setup`

---
**Remember**: This track is completely independent. Focus on creating a robust, secure backend infrastructure that the frontend can connect to later.