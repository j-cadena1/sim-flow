# Repository Structure

This document describes the organization of the Sim-Flow codebase.

## Root Directory

```text
sim-flow/
├── backend/              # Backend API server
├── components/           # React UI components
├── contexts/             # React context providers
├── database/             # Database schema and migrations
├── lib/                  # Shared libraries and utilities
├── nginx/                # Nginx configuration for production
├── scripts/              # Operational scripts (backup, restore)
├── utils/                # Frontend utility functions
├── docker-compose.yaml   # Development Docker setup
├── docker-compose.prod.yaml  # Production Docker setup
└── package.json          # Frontend dependencies
```

## Backend (`backend/`)

Node.js/Express API server with TypeScript.

```text
backend/
├── src/
│   ├── controllers/      # Request handlers
│   ├── db/               # Database connection and queries
│   ├── middleware/       # Express middleware (auth, validation)
│   ├── routes/           # API route definitions
│   ├── services/         # Business logic (SSO, Graph API)
│   ├── types/            # TypeScript type definitions
│   ├── utils/            # Utilities (password validation, logger)
│   └── server.ts         # Express server entry point
├── dist/                 # Compiled JavaScript (gitignored)
├── package.json          # Backend dependencies
└── tsconfig.json         # TypeScript configuration
```

### Key Backend Files

- **server.ts**: Express application setup, middleware, routes
- **controllers/**: Business logic for each API endpoint
  - `authController.ts`: Login, SSO authentication
  - `requestController.ts`: Sim request CRUD operations
  - `userManagementController.ts`: Admin user management
  - `projectController.ts`: Project management
- **services/**: External integrations
  - `msalService.ts`: Microsoft Entra ID OAuth/PKCE
  - `graphService.ts`: Microsoft Graph API (users, photos)
- **middleware/**: Request processing
  - `authentication.ts`: Session cookie validation
  - `authorization.ts`: Role-based access control

## Frontend

React application with TypeScript and Vite.

```text
root/
├── components/           # React components
│   ├── Dashboard.tsx     # Main dashboard view
│   ├── Login.tsx         # Authentication page
│   ├── RequestList.tsx   # List of sim requests
│   ├── RequestDetail.tsx # Detailed request view
│   ├── NewRequest.tsx    # Create new request form
│   ├── Projects.tsx      # Project management
│   ├── Settings.tsx      # Admin settings (SSO, users)
│   ├── Sidebar.tsx       # Navigation sidebar
│   ├── Modal.tsx         # Modal dialog system
│   └── Toast.tsx         # Toast notification system
├── contexts/             # React context providers
│   ├── AuthContext.tsx   # Authentication state
│   └── SimFlowContext.tsx # Global app state
├── lib/
│   └── api/              # API client
│       ├── client.ts     # Axios instance configuration
│       └── hooks.ts      # React Query hooks for API calls
├── utils/                # Utility functions
│   ├── validation.ts     # Form validation
│   └── sanitize.ts       # Input sanitization
├── App.tsx               # Root application component
├── index.tsx             # React entry point
├── types.ts              # Shared TypeScript types
└── constants.ts          # Application constants
```

### Component Organization

- **Layout Components**: Sidebar, Dashboard
- **Feature Components**: RequestList, RequestDetail, NewRequest, Projects, Settings
- **Utility Components**: Modal, Toast, ErrorBoundary, RoleSwitcher

## Database (`database/`)

PostgreSQL schema and migrations.

```text
database/
├── init.sql              # Initial schema (users, requests, comments)
├── migrations/           # Sequential database migrations
│   ├── 001_add_projects_and_revisions.sql
│   ├── 002_add_time_tracking.sql
│   ├── 003_add_title_change_requests.sql
│   ├── 004_add_discussion_requests.sql
│   ├── 005_add_user_passwords.sql
│   ├── 006_add_sso_configuration.sql
│   ├── 007_add_user_sso_tracking.sql
│   ├── 008_extend_avatar_url.sql
│   └── 009_add_performance_indexes.sql
└── backups/              # Database backups (gitignored)
```

### Migration Strategy

- Migrations are numbered sequentially
- Each migration is idempotent (safe to run multiple times)
- Run migrations manually or via initialization scripts

## Production Infrastructure

### Docker Compose (`docker-compose.prod.yaml`)

Production deployment configuration:

- **postgres**: PostgreSQL 16 database (internal network only)
- **backend**: API server with resource limits
- **frontend**: Nginx serving static files
- **nginx**: Reverse proxy with SSL termination

### Nginx (`nginx/`)

```text
nginx/
├── nginx.conf            # Production configuration
│   ├── HTTP → HTTPS redirect
│   ├── SSL/TLS configuration
│   ├── Rate limiting
│   └── Security headers
├── ssl/                  # SSL certificates (gitignored)
└── logs/                 # Nginx logs (gitignored)
```

### Operational Scripts (`scripts/`)

- **backup-database.sh**: Automated database backups with retention
- **restore-database.sh**: Database restoration from backup
- **crontab.example**: Example cron jobs for automated backups

## Configuration Files

### Environment Variables

- **.env.example**: Template for environment configuration
- **.env**: Actual secrets (gitignored)

Required variables:

- Database: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- SSO Encryption: `SSO_ENCRYPTION_KEY` (for storing SSO client secrets)
- API: `CORS_ORIGIN`, `RATE_LIMIT_MAX_REQUESTS`

### Build Configuration

- **package.json**: Frontend dependencies (React, Vite, TanStack Query)
- **backend/package.json**: Backend dependencies (Express, MSAL, pg)
- **tsconfig.json**: TypeScript configuration
- **vite.config.ts**: Vite build configuration
- **vitest.config.ts**: Test configuration

## Development Workflow

1. **Install Dependencies**

   ```bash
   npm install
   cd backend && npm install
   ```

2. **Start Development Environment**

   ```bash
   docker compose up -d
   ```

3. **Run Tests**

   ```bash
   npm test
   ```

4. **Build for Production**

   ```bash
   npm run build
   cd backend && npm run build
   ```

## Production Deployment

1. **Configure Environment**

   ```bash
   cp .env.example .env
   # Edit .env with production values
   ```

2. **Obtain SSL Certificates**

   ```bash
   # Using Let's Encrypt
   sudo certbot certonly --webroot -w /var/www/certbot -d yourdomain.com
   ```

3. **Deploy**

   ```bash
   docker compose -f docker-compose.prod.yaml up -d
   ```

4. **Set Up Backups**

   ```bash
   crontab -e
   # Add: 0 2 * * * /path/to/scripts/backup-database.sh
   ```

## Security Considerations

### Authentication & Authorization

- Session-based authentication with HTTP-only cookies
- Microsoft Entra ID SSO with PKCE
- Role-based access control (Admin, Manager, Engineer, User)

### Database Security

- User permissions limited by role
- Connection pooling with configurable limits
- Performance indexes on frequently queried columns

### Production Hardening

- HTTPS only with TLS 1.2/1.3
- Rate limiting on API and login endpoints
- Security headers (HSTS, CSP, X-Frame-Options)
- Container security (no-new-privileges, resource limits)
- Database not exposed externally

## Testing

### Unit Tests

- Component tests: `components/*.test.tsx`
- Utility tests: `utils/*.test.ts`
- Context tests: `contexts/*.test.tsx`

Run with: `npm test`

### Integration Tests

- API endpoint testing (manual/Postman)
- SSO flow testing with real Entra ID tenant

## Version Control

### Git Ignore

Build artifacts, dependencies, and secrets are excluded:

- `node_modules/`, `dist/`, `backend/dist/`
- `.env`, `.DS_Store`
- `nginx/ssl/*.pem`, `database/backups/`

### Branching Strategy

- `master`: Production-ready code
- `dev`: Development branch
- Feature branches: Merged to `dev` via pull requests

## Documentation Files

- **README.md**: Project overview and quick start
- **STRUCTURE.md**: This file - repository organization
- **QUICKSTART.md**: Step-by-step setup guide
- **DEPLOYMENT.md**: Production deployment instructions
- **BACKEND-STATUS.md**: Backend implementation status
- **CREDENTIALS.md**: Local development credentials
- **CLAUDE.md**: Instructions for Claude Code assistant

## License

Copyright © 2025 - All rights reserved
