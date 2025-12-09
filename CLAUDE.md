# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**All development runs in Docker containers. Never use `npm install` or `npm run dev` directly.**

```bash
make dev          # Start development (hot reload at http://localhost:5173)
make dev-logs     # View logs
make dev-down     # Stop

make test         # Run unit tests in containers
make test-e2e     # Run Playwright E2E tests in container

make db-shell     # Open PostgreSQL shell (user: sim-rq_user, db: sim-rq)
make db-backup    # Backup to backup.sql
make status       # Show container status
make help         # Show all available commands

make prod         # Start production (port 8080)
make prod-logs    # View production logs
make prod-down    # Stop production
```

Run a single E2E test file:
```bash
docker compose -f docker-compose.dev.yaml --profile e2e run --rm playwright npx playwright test tests/e2e/auth.spec.ts
```

Run backend tests with a specific pattern:
```bash
docker compose -f docker-compose.dev.yaml exec backend npm test -- --grep "pattern"
```

Type check frontend:
```bash
docker compose -f docker-compose.dev.yaml exec frontend npx tsc --noEmit
```

Type check backend:
```bash
docker compose -f docker-compose.dev.yaml exec backend npx tsc --noEmit
```

## Architecture Overview

### Stack
- **Frontend**: React 19 + TypeScript + Vite + TailwindCSS (port 5173 dev, 8080 prod via nginx)
- **Backend**: Node.js + Express + TypeScript + Socket.IO (port 3001)
- **Database**: PostgreSQL 16
- **Auth**: Session cookies (HTTP-only) + Microsoft Entra ID PKCE

### Key Files
- `types.ts` - Shared TypeScript types/enums (UserRole, RequestStatus, ProjectStatus)
- `backend/src/types/index.ts` - Backend-specific types
- `database/init.sql` - Complete database schema (single source of truth)
- `database/migrations/` - Incremental migrations for existing databases

### Request Lifecycle (State Machine)
Requests flow through these statuses:
```
Submitted → Manager Review → Engineering Review → In Progress → Completed → Accepted
                ↓                   ↓                              ↓
              Denied            Discussion                  Revision Requested
                                                                   ↓
                                                            Revision Approval
```

### Project Lifecycle (State Machine)
Defined in `backend/src/services/projectLifecycleService.ts`:
```
Pending → Active → Completed → Archived
            ↓↑
         On Hold / Suspended
            ↓
      Cancelled / Expired → Archived
```
- Only `Active` projects can have hours allocated or new requests created
- `Archived` is terminal (no transitions out)
- Transitions to `On Hold`, `Suspended`, `Cancelled`, `Expired` require a reason

### Role-Based Access (4 Roles)
- **Admin**: Full access, user management, SSO configuration
- **Manager**: Approve/assign requests, manage projects
- **Engineer**: Work on assigned requests, log time
- **End-User**: Submit requests, view own requests

### Backend Structure
```
backend/src/
├── controllers/     # Route handlers (requestsController, projectsController, authController)
├── routes/          # Express route definitions with Swagger docs
├── services/        # Business logic (projectLifecycleService, sessionService, msalService)
├── middleware/      # Auth, rate limiting, validation, logging
└── db/              # Database connection pool
```

### Frontend Structure
```
components/
├── Dashboard.tsx, RequestList.tsx, Projects.tsx, Analytics.tsx, Settings.tsx  # Main pages
├── analytics/       # Analytics sub-components
├── projects/        # Project management sub-components
├── request-detail/  # Request detail sub-components
└── settings/        # Settings tabs (UserManagement, SSOConfiguration, AuditLog)
contexts/
└── AuthContext.tsx  # Authentication state management
```

## Code Conventions

### Database
- Schema changes: Update `database/init.sql` for fresh installs, create numbered migration in `database/migrations/` (format: `NNN_description.sql`) for existing databases
- Use snake_case for columns, convert with `toCamelCase()` utility when returning to frontend
- Apply migrations: `docker compose exec postgres psql -U "sim-rq_user" -d "sim-rq" -f /docker-entrypoint-initdb.d/migrations/NNN_description.sql`

### TypeScript
- Avoid `any` types
- Shared types go in root `types.ts`, backend-only types in `backend/src/types/index.ts`

### API
- All routes have Swagger documentation (view at http://localhost:3001/api-docs)
- Routes use middleware: `authenticate`, `requireRole(['Admin', 'Manager'])`, rate limiters

### SSO
- Development: Use `DEV_ENTRA_SSO_*` environment variables
- Production: Use `ENTRA_SSO_*` environment variables or database configuration
- PKCE state stored in database for multi-instance support

## Testing
- E2E tests in `tests/e2e/` cover auth, roles, requests, lifecycle, analytics
- Backend unit tests in `backend/src/services/__tests__/`
- Tests require rate limiting disabled (handled automatically by `make test-e2e`)
- Test reports saved to `./playwright-report/` and `./test-results/`

## Real-time Features
- WebSocket via Socket.IO for in-app notifications
- Each user receives notifications for relevant events (assignment, status changes, comments)
- Notification preferences stored per user in database
