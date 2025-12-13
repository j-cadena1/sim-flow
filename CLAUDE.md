# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## App Name

The app's name is Sim RQ. Any technical references should be stylized as sim-rq

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

Run arbitrary commands in containers:

```bash
docker compose -f docker-compose.dev.yaml exec backend <command>
docker compose -f docker-compose.dev.yaml exec frontend <command>
```

## Architecture Overview

### Stack

- **Frontend**: React 19 + TypeScript + Vite + TailwindCSS v4 (port 5173 dev, 8080 prod via nginx)
- **Backend**: Node.js + Express + TypeScript + Socket.IO (port 3001)
- **Database**: PostgreSQL 16
- **Storage**: Garage (S3-compatible) for file attachments (port 3900)
- **Cache**: Redis 7 (optional - for multi-instance deployments)
- **Auth**: Session cookies (HTTP-only, max 5 concurrent per user) + Microsoft Entra ID PKCE

### Data Storage

All persistent data uses bind mounts in `./data/` directory:

- `./data/postgres/` - PostgreSQL database files
- `./data/garage/data/` - S3 file blobs
- `./data/garage/meta/` - Garage metadata

This directory is auto-created and excluded from git. For backups, copy the entire `./data/` directory.

### Key Files

- `types.ts` - Shared TypeScript types/enums (UserRole, RequestStatus, ProjectStatus)
- `backend/src/types/index.ts` - Backend-specific types
- `backend/src/utils/caseConverter.ts` - `toCamelCase()` utility for DB → API conversion
- `database/init.sql` - Complete database schema (single source of truth)
- `database/migrations/` - Incremental migrations for existing databases

### Request Lifecycle (State Machine)

Requests flow through these statuses:

```text
Submitted → Manager Review → Engineering Review → In Progress → Completed → Accepted
                ↓                   ↓                              ↓
              Denied            Discussion                  Revision Requested
                                                                   ↓
                                                            Revision Approval
```

### Project Lifecycle (State Machine)

Defined in `backend/src/services/projectLifecycleService.ts`:

```text
Pending → Active → Completed → Archived
            ↓↑
         On Hold / Suspended
            ↓
      Cancelled / Expired → Archived
```

- Only `Active` projects can have hours allocated or new requests created
- `Archived` is terminal (no transitions out)
- Transitions to `On Hold`, `Suspended`, `Cancelled`, `Expired` require a reason
- Project codes must follow format `XXXXXX-XXXX` (6 digits, dash, 4 digits)

### User Lifecycle

- **Soft delete (deactivation)**: Sets `deleted_at` timestamp, blocks login, preserves all data
- **Hard delete**: Permanently removes user, archives to `deleted_users` table for historical reference
- Deactivated users are blocked from both local and SSO login
- Historical records (time entries, comments, requests) show "Deleted User" with tooltip for admins

### Role-Based Access (4 Roles)

- **Admin**: Full access, user management, SSO configuration
- **Manager**: Approve/assign requests, manage projects
- **Engineer**: Work on assigned requests, log time
- **End-User**: Submit requests, view own requests

### Backend Structure

```text
backend/src/
├── controllers/     # Route handlers (requestsController, projectsController, authController)
├── routes/          # Express route definitions with Swagger docs
├── services/        # Business logic - key services:
│   ├── projectLifecycleService.ts  # Project state machine transitions
│   ├── sessionService.ts           # Session management with atomic locking
│   ├── storageService.ts           # S3-compatible file storage (Garage)
│   ├── notificationService.ts      # In-app real-time notifications (WebSocket)
│   ├── websocketService.ts         # Socket.IO connection management
│   ├── emailService.ts             # SMTP email sending (optional)
│   ├── emailDigestService.ts       # Batched email digests (hourly/daily/weekly)
│   ├── redisService.ts             # Redis connection (optional)
│   ├── auditService.ts             # Audit log tracking
│   ├── msalService.ts              # Microsoft Entra ID PKCE auth
│   ├── encryptionService.ts        # SSO credential encryption
│   ├── cleanupService.ts           # Session/token cleanup jobs
│   └── mediaProcessingService.ts   # Video/image thumbnail generation
├── middleware/      # Auth, rate limiting, validation, logging
└── db/              # Database connection pool
```

### Frontend Structure

```text
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

- Schema changes: Update `database/init.sql` for fresh installs, create migration in `database/migrations/` (format: `YYYYMMDD_description.sql`) for existing databases
- Use snake_case for columns, convert with `toCamelCase()` utility when returning to frontend
- Apply migrations: `docker compose exec postgres psql -U "sim-rq_user" -d "sim-rq" -f /docker-entrypoint-initdb.d/migrations/YYYYMMDD_description.sql`

### TypeScript

- Avoid `any` types
- Shared types go in root `types.ts`, backend-only types in `backend/src/types/index.ts`

### API

- All routes have Swagger documentation (view at <http://localhost:3001/api-docs>)
- Routes use middleware: `authenticate`, `requireRole(['Admin', 'Manager'])`, rate limiters

### SSO

- Development: Use `DEV_ENTRA_SSO_*` environment variables
- Production: Use `ENTRA_SSO_*` environment variables or database configuration
- PKCE state stored in database for multi-instance support

## Testing

- **E2E tests**: `tests/e2e/` (13 spec files, 86 tests covering all major features)
- **Backend unit tests**: `backend/src/services/__tests__/` (423 tests)
- Rate limiting auto-disabled during `make test-e2e`
- Test reports saved to `./playwright-report/` and `./test-results/`

E2E test files by feature area:

- `auth.spec.ts`, `roles.spec.ts` - Authentication and authorization
- `requests.spec.ts`, `request-crud.spec.ts`, `lifecycle.spec.ts` - Request workflows
- `projects.spec.ts`, `forms.spec.ts` - Project management
- `dashboard.spec.ts`, `analytics.spec.ts`, `navigation.spec.ts` - UI/UX
- `attachments.spec.ts` - File uploads
- `notifications.spec.ts` - Real-time notifications
- `health.spec.ts` - Health checks

## Development Credentials

**For local development only** (production uses Microsoft Entra ID SSO):

| Role     | Email                      | Password     |
|----------|----------------------------|--------------|
| Admin    | `qadmin@sim-rq.local`      | `admin123`   |
| Manager  | `bob@sim-rq.local`         | `manager123` |
| Engineer | `charlie@sim-rq.local`     | `engineer123`|
| End-User | `alice@sim-rq.local`       | `user123`    |

## File Attachments

- S3-compatible storage via Garage (auto-configured in Docker)
- Upload on request creation or add to existing requests
- Supported types: documents, images, videos, archives (configurable)
- Max file size: 3GB (configurable via `MAX_FILE_SIZE_MB`)
- Uses multipart upload for files > 5MB
- Dual S3 clients: internal endpoint for uploads, public endpoint for download URLs

Key environment variables:

- `S3_ENDPOINT` - Internal Docker endpoint (default: `http://garage:3900`)
- `S3_PUBLIC_ENDPOINT` - Browser-accessible endpoint for downloads (defaults to `CORS_ORIGIN`)

## Notifications

### In-App (WebSocket)

- Real-time via Socket.IO
- Notification preferences per user in database
- Types defined in `types.ts` → `NotificationType` enum

### Email (Optional)

- Configure SMTP in `.env` (see `.env.example`)
- Digest frequencies: instant, hourly, daily, weekly
- User preferences control which events trigger emails

## Scaling Considerations

### Multi-Instance Deployments

| Feature       | Single Instance   | Multi-Instance (Redis)                      |
|---------------|-------------------|---------------------------------------------|
| Sessions      | PostgreSQL        | PostgreSQL                                  |
| PKCE state    | PostgreSQL        | PostgreSQL                                  |
| Rate limiting | In-memory         | Redis (`rate-limit-redis`)                  |
| WebSocket     | In-memory adapter | Redis adapter (`@socket.io/redis-adapter`)  |

**Redis is optional.** Single-instance deployments work without Redis. For multi-instance:

1. Set `REDIS_HOST=redis` in your environment
2. Redis is already configured in `docker-compose.yaml`
3. Rate limiting and WebSocket automatically use Redis when available

Services detect Redis availability at startup and fall back to in-memory if unavailable.

### Pre-commit Hooks

The project uses Husky with lint-staged for pre-commit checks:

- TypeScript type checking on staged `.ts`/`.tsx` files
- ESLint on staged backend files
- Markdownlint on staged `.md` files (auto-fixes where possible)

To skip hooks (not recommended): `git commit --no-verify`
