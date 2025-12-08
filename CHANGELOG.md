# Changelog

All notable changes to SimRQ will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!-- markdownlint-disable MD024 -->

## [Unreleased]

### Changed

- **Project renamed from "Sim-Flow" to "SimRQ"** - Updated all user-facing text, documentation, and branding
  - GitHub repository migrated from `j-cadena1/sim-flow` to `j-cadena1/sim-rq`
  - Application stylization standardized to "SimRQ" (uppercase Q)
  - Docker container names updated to `simflow-*` pattern (lowercase, no hyphens)
  - Logger service name updated to `simrq-api`
  - All 36+ files updated for consistent branding

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

[0.8.1]: https://github.com/j-cadena1/sim-rq/releases/tag/v0.8.1
[0.8.0]: https://github.com/j-cadena1/sim-rq/releases/tag/v0.8.0
[0.7.0]: https://github.com/j-cadena1/sim-rq/releases/tag/v0.7.0
