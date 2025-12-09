# Changelog

All notable changes to Sim RQ will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!-- markdownlint-disable MD024 -->

## [0.9.0] - 2025-12-08

### Added

- **qAdmin account disable/enable functionality** - Entra ID admins can now disable the local qAdmin account for enhanced security
  - New API endpoints: `GET /api/users/management/qadmin-status`, `POST /api/users/management/qadmin/disable`, `POST /api/users/management/qadmin/enable`
  - Requires at least one active Entra ID admin before qAdmin can be disabled
  - Only Entra ID administrators can manage qAdmin status
  - Login controller blocks disabled qAdmin account from authenticating
  - New `system_settings` database table for configuration storage
  - UI component in Settings → Security tab with modern modal dialogs
  - Audit logging for all qAdmin disable/enable actions
  - Enforces SSO-only authentication when qAdmin is disabled

### Changed

- **Complete rebrand from "Sim-Flow" to "SimRQ"** - Comprehensive update of all identifiers and branding
  - Application name: "SimRQ" (user-facing)
  - Technical identifiers: `sim-rq` (URLs, containers, database, files)
  - GitHub repository: `j-cadena1/sim-rq`
  - Docker containers: `sim-rq-db`, `sim-rq-api`, `sim-rq-frontend`, `sim-rq-playwright`
  - Docker networks: `sim-rq-network`, `sim-rq-dev`
  - Database name: `sim-rq`, user: `sim-rq_user`
  - Test email domain: `@sim-rq.local` (e.g., `qadmin@sim-rq.local`)
  - Prometheus metrics prefix: `sim_rq_*`
  - Backup files: `sim-rq_*.sql.gz`
  - 60+ files updated for complete consistency
- **Tailwind CSS v4 migration** - Migrated from CDN to build-time processing with `@tailwindcss/vite` plugin
  - Eliminates "CDN should not be used in production" warning
  - Faster page loads with pre-compiled CSS
  - Custom theme defined in `index.css` using `@theme` directive
- **WebSocket connection reliability** - Added 100ms delay before Socket.IO connection to prevent race conditions during Vite hot reload
- **README updated** - Added "Deployment Model" section clarifying SSO-first approach and purpose of local accounts
- **API documentation** - Updated to 73/73 endpoints (100% coverage) with new qAdmin management endpoints
- **Database migrations consolidated** - Archived 21 incremental migrations into single `init.sql` for cleaner fresh installs

### Fixed

- WebSocket proxy configuration for Vite dev server (`/socket.io` proxy with `ws: true`)
- Dashboard "Personal Overview" section now correctly hidden for End-User role
- Recharts responsive container dimension warnings (using explicit height instead of percentage)
- Favicon paths corrected (removed `/public/` prefix)
- Docker development volume mounts for `index.tsx`, `index.css`, and `hooks/` directory

## [0.8.1] - 2025-12-08

### Security

- **CRITICAL: Authentication required for `/api/users`** - Fixed unauthenticated user enumeration vulnerability
- **CRITICAL: Encryption key required in production** - Server now fails to start if `SSO_ENCRYPTION_KEY` not set in production
- **HIGH: Authentication required for all project endpoints** - All `/api/projects/*` read endpoints now require authentication
- **HIGH: Rate limiting on session management** - Added `sensitiveOpLimiter` to `/api/auth/sessions` endpoints
- **HIGH: Stronger password requirements for qAdmin** - Minimum 12 characters, uppercase, lowercase, number, special character, no common patterns
- **MEDIUM: Account lockout** - Temporary account lockout after 5 failed login attempts (15 minute cooldown)
- **MEDIUM: Content Security Policy** - Explicit CSP headers configured via Helmet (prevents XSS, clickjacking)
- **Dependency update** - Fixed `jws` high severity vulnerability (improper HMAC signature verification)

### Added

- Login attempt tracking with automatic cleanup (24 hour retention)
- Account lockout service with configurable thresholds

### Changed

- Password complexity requirements: 12+ chars, mixed case, numbers, special characters
- Project listing endpoints now require authentication (prevents business intelligence leakage)
- Session endpoints rate limited to 30 operations per hour
- Enhanced security headers: HSTS (1 year), X-Frame-Options DENY, strict referrer policy

### Documentation

- Added security limitation documentation for PKCE in-memory store (single-instance only)
- Documented CSRF protection strategy (SameSite: strict cookies)
- Updated Swagger docs with security requirements and rate limit info

## [0.8.0] - 2025-12-08

### Added

- **Internal comments**: Engineers, Managers, and Admins can now post private comments not visible to requesters via "Show requester" checkbox
- **Project request workflow**: End-Users can now request projects (created as "Pending" for Manager/Admin approval)
- **100% API documentation**: All 70 endpoints fully documented in Swagger/OpenAPI
- **Comprehensive unit tests**: 51 new tests for project lifecycle state machine (78 total backend tests)
- **True Docker-first architecture**: All testing now runs in containers (`make test`, `make test-e2e`)

### Changed

- Version changed from 1.0.0 to 0.8.0-beta to reflect development status
- Project creation: Managers/Admins create Active projects directly; End-Users/Engineers create Pending projects
- Default comment visibility: Internal (unchecked) by default for staff roles
- Component modularization: Large components split into subdirectories (analytics, projects, settings, request-detail)

### Removed

- Legacy `Approved` project status (migrated to `Active`)
- Redundant documentation files (CONTRIBUTING.md, backend/TESTING.md consolidated into README)

### Fixed

- Dashboard chart tooltips now theme-aware (light/dark mode)
- E2E test race conditions with explicit waits

## [0.7.0] - 2025-12-06

### Added

- Role-based access control (Admin, Manager, Engineer, End-User)
- Complete request lifecycle management with enforced workflow stages
- Database CHECK constraints preventing invalid lifecycle states
- Automatic lifecycle transitions via PostgreSQL triggers
- Project hour tracking and budget allocation
- Microsoft Entra ID (Azure AD) SSO with PKCE authentication
- Session-based authentication with HTTP-only cookies
- Real-time analytics dashboard with charts and metrics
- Comprehensive E2E test suite (86 tests)
- Request status tracking and notifications
- User management with soft delete and historical data preservation
- Audit logging for sensitive operations
- Rate limiting on authentication endpoints
- Dark/light mode theme support
- Responsive design for mobile, tablet, and desktop
- Docker-first deployment strategy
- Makefile for simplified operations
- Database migrations system
- Health check endpoints
- Prometheus metrics endpoint
- Swagger API documentation at `/api-docs`
- Comprehensive security features (Helmet.js, DOMPurify, bcrypt)

### Security

- Session-based authentication (no JWT tokens)
- Rate limiting (30 login attempts per 15 minutes in production)
- Input sanitization with DOMPurify
- Bcrypt password hashing
- Database connection pooling with prepared statements
- CORS protection
- Security headers via Helmet.js
- SSO credentials encrypted at rest

### Documentation

- Comprehensive README with quick start guide
- CONTRIBUTING.md with development workflow
- SECURITY.md with vulnerability reporting process
- GitHub issue and PR templates
- Complete inline code documentation
- Environment variable configuration guide

### Testing

- 86 E2E tests covering all major features
- Authentication and authorization tests
- Lifecycle enforcement verification tests
- Role-based access control tests
- Form validation and sanitization tests
- Analytics dashboard tests
- Navigation and UI tests

[0.9.0]: https://github.com/j-cadena1/sim-rq/releases/tag/v0.9.0
[0.8.1]: https://github.com/j-cadena1/sim-rq/releases/tag/v0.8.1
[0.8.0]: https://github.com/j-cadena1/sim-rq/releases/tag/v0.8.0
[0.7.0]: https://github.com/j-cadena1/sim-rq/releases/tag/v0.7.0
