# INFRA-001 - Track 2: Frontend/Application Development
**Story**: Docker & Core Infrastructure Setup
**Points**: 3
**Dependencies**: None (can run independently)

## Terminal 2 Instructions - Frontend/Application Track

### Your Mission
You are developing the frontend application for HomeOps using Next.js 14 with TypeScript, React 18, and TailwindCSS. This track focuses on creating the application scaffold, UI components, and client-side architecture independently from the backend.

### Technical Context
- **Project**: HomeOps - Smart home automation system with financial trading capabilities
- **Stack**: Next.js 14, React 18, TypeScript, TailwindCSS, PWA
- **Working Directory**: C:\Projects\HomeOps

### Your Tasks

#### 1. Next.js Application Setup (30 min)
Initialize Next.js 14 with TypeScript and TailwindCSS:

```typescript
// Core features to enable:
- App Router (Next.js 14)
- TypeScript strict mode
- TailwindCSS with custom theme
- PWA configuration
- SEO optimization
```

Files to create:
- `package.json` - Project dependencies and scripts
- `next.config.js` - Next.js configuration with PWA
- `tsconfig.json` - TypeScript configuration
- `tailwind.config.ts` - TailwindCSS theme customization
- `postcss.config.js` - PostCSS configuration
- `.eslintrc.json` - ESLint rules
- `public/manifest.json` - PWA manifest

#### 2. Application Structure (30 min)
Set up the app directory structure:

```
app/
├── layout.tsx          # Root layout with providers
├── page.tsx           # Homepage/Dashboard
├── (auth)/
│   ├── login/
│   └── register/
├── dashboard/
│   ├── page.tsx       # Main dashboard
│   └── layout.tsx     # Dashboard layout
├── accounts/          # Financial accounts
├── automations/       # Automation workflows
├── services/          # Docker services
└── settings/          # User settings
```

Files to create:
- `app/layout.tsx` - Root layout with metadata
- `app/page.tsx` - Landing page
- `app/globals.css` - Global styles with Tailwind
- `app/dashboard/page.tsx` - Main dashboard
- `app/dashboard/layout.tsx` - Dashboard navigation
- `app/(auth)/login/page.tsx` - Login page
- `app/(auth)/register/page.tsx` - Registration page

#### 3. Core UI Components (45 min)
Build reusable component library:

```typescript
// Essential components:
- Layout components (Header, Sidebar, Footer)
- Dashboard widgets (StatusCard, MetricCard, ChartCard)
- Form components (Input, Button, Select, Toggle)
- Data display (Table, List, Card)
- Feedback (Alert, Toast, Modal)
```

Files to create:
- `components/layout/Header.tsx` - App header with navigation
- `components/layout/Sidebar.tsx` - Collapsible sidebar navigation
- `components/layout/Footer.tsx` - Footer component
- `components/ui/Button.tsx` - Reusable button with variants
- `components/ui/Input.tsx` - Form input component
- `components/ui/Card.tsx` - Card container component
- `components/dashboard/StatusCard.tsx` - Service status widget
- `components/dashboard/MetricCard.tsx` - Metric display widget
- `components/dashboard/ChartCard.tsx` - Chart container widget
- `components/ui/Alert.tsx` - Alert notification component
- `lib/cn.ts` - Utility for className merging

#### 4. Client-Side Architecture (30 min)
Set up state management and API integration:

```typescript
// Core features:
- React Context for global state
- Custom hooks for data fetching
- API client with error handling
- Type-safe API responses
```

Files to create:
- `lib/api/client.ts` - API client wrapper
- `lib/api/types.ts` - API response types
- `contexts/AuthContext.tsx` - Authentication context
- `contexts/ThemeContext.tsx` - Theme management
- `hooks/useAuth.ts` - Authentication hook
- `hooks/useApi.ts` - Generic API hook
- `hooks/useWebSocket.ts` - Real-time updates
- `lib/utils.ts` - Utility functions
- `types/index.ts` - Global TypeScript types

#### 5. PWA Configuration (15 min)
Configure Progressive Web App features:

Files to create:
- `public/sw.js` - Service worker for offline support
- `public/manifest.json` - PWA manifest with icons
- `public/icons/` - App icons (multiple sizes)
- `app/offline/page.tsx` - Offline fallback page
- `lib/pwa.ts` - PWA registration helper

### Expected Deliverables
1. **Next.js App**: Fully configured Next.js 14 with TypeScript
2. **UI Components**: Complete component library with TailwindCSS
3. **Routing**: App router with authentication and dashboard routes
4. **PWA Ready**: Service worker and manifest for mobile app experience
5. **Type Safety**: Full TypeScript coverage with strict mode

### Testing Your Work
Run these commands to verify:
```bash
# Install and build
npm install
npm run build

# Development server
npm run dev
# Visit http://localhost:3000

# Type checking
npm run type-check

# Linting
npm run lint

# PWA verification
# Check Application tab in Chrome DevTools
```

### Avoid Conflicts
- Work only in: `/app`, `/components`, `/public`, `/lib`, `/contexts`, `/hooks`
- Don't modify: `/backend`, `/docker`, `/supabase` (backend territory)
- Don't touch: `/tests`, `/__tests__` (testing territory)
- Don't create API routes yet (leave `/app/api` empty)

### Notes
- Use CSS Modules or Tailwind classes only (no styled-components)
- Implement responsive design for all screen sizes
- Follow Next.js 14 best practices with App Router
- Use proper TypeScript types (avoid 'any')
- Implement loading and error states for all pages
- Add proper meta tags for SEO

### Git Branch
Work on branch: `feature/infra-frontend-setup`

---
**Remember**: This track is completely independent. Focus on creating a polished, type-safe frontend that can connect to the backend API later.