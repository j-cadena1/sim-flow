# Sim RQ

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-0.9.8--beta-blue.svg)](https://github.com/j-cadena1/sim-rq/releases)
[![Docker](https://img.shields.io/badge/Docker-First-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)

Role-based engineering simulation request management system with analytics, audit logging, and Microsoft Entra ID SSO.

## 🔐 Deployment Model

**Sim RQ is designed for Microsoft Entra ID SSO-first environments.** This application is intended to be deployed in organizations using Microsoft Entra ID (Azure AD) for centralized identity management.

- **Production authentication:** Microsoft Entra ID SSO only
- **Local user accounts:** Development and testing purposes only
- **No self-registration:** Users are provisioned through SSO authentication
- **Future scope:** Local user creation functionality is not planned

The included local accounts (qAdmin, test users) exist solely for:

- Development and testing without SSO configuration
- Role-based access control (RBAC) testing
- Demo environments

In production deployments, configure Microsoft Entra ID SSO and disable local login if desired.

## 🐳 Docker-First Philosophy

**No Node.js installation required.** This project runs entirely in Docker containers.

- ✅ Development with hot reload: `make dev`
- ✅ Production deployment: `make prod`
- ✅ All tests containerized: `make test` and `make test-e2e`
- ✅ Database operations via Docker: `make db-backup`, `make db-shell`

Everything you need is managed by Docker Compose. Just install Docker and you're ready to go.

## Features

- **Role-Based Access**: Admin, Manager, Engineer, End-User
- **Request Lifecycle**: Full tracking from submission to completion with enforced workflow stages
- **File Attachments**: S3-compatible storage (Garage) with drag-and-drop uploads up to 3GB
  - Direct browser-to-S3 uploads for large files (bypasses server)
  - Video compression to H.264 720p with real-time progress indicator
  - Automatic thumbnail generation for images and videos
  - HEIC/HEIF and M4V format support for Apple devices
- **Project Hour Tracking**: Budget allocation and monitoring
- **Real-time Notifications**: WebSocket-based in-app notifications with user preferences
- **SSO**: Microsoft Entra ID (Azure AD) PKCE authentication with production-ready multi-instance support
- **Native SSL/TLS**: Built-in Let's Encrypt certificate management via Cloudflare DNS-01
- **Analytics**: Real-time productivity and resource insights
- **Security**: Session-based auth, MIME type validation, rate limiting, audit logging, database-backed PKCE storage

## Quick Start

**Prerequisites:** Docker and Docker Compose

### Production

```bash
git clone https://github.com/j-cadena1/sim-rq.git
cd sim-rq
make prod
```

Application runs on `http://<your-server>:8080`

**Use a reverse proxy for HTTPS in production (see below).**

### Development

```bash
make dev  # Hot reload at http://localhost:5173
```

## Commands

```bash
make help         # Show all commands
make prod         # Start production
make dev          # Start dev with hot reload
make test-e2e     # Run E2E tests
make db-backup    # Backup database
make status       # Show container status
make clean        # Remove all containers
```

## Default Credentials (Development Only)

**Bootstrap Admin Account:**

The `qadmin@sim-rq.local` account is used for initial SSO configuration only:

- Email: `qadmin@sim-rq.local`
- Password: Set via `QADMIN_PASSWORD` in `.env` (default: `admin123`)

After configuring Entra ID and syncing Admin users, disable qAdmin via Settings > User Management.

**Test Accounts (for RBAC testing in development):**

- Manager: `bob@sim-rq.local` / `manager123`
- Engineer: `charlie@sim-rq.local` / `engineer123`
- User: `alice@sim-rq.local` / `user123`

Test passwords can be overridden via environment variables. See `.env.example`.

**⚠️ Production Deployment:**

- Set a strong `QADMIN_PASSWORD` in `.env`
- Configure Microsoft Entra ID SSO (see SSO Configuration section)
- Disable qAdmin after SSO is configured
- All real users should authenticate via SSO
- Disable the local administrator account and delete local users

## HTTPS Setup

Choose one of two approaches for HTTPS:

### Option 1: Native SSL (Recommended for simplicity)

SimRQ can terminate TLS natively using Let's Encrypt certificates via Cloudflare DNS. No reverse proxy needed.

**Requirements:**

- Domain managed by Cloudflare
- Cloudflare API token with DNS edit permissions

**Setup:**

1. Create Cloudflare API token at <https://dash.cloudflare.com/profile/api-tokens>
   - Permissions: Zone > DNS > Edit, Zone > Zone > Read

2. Configure `.env`:

   ```bash
   # Required
   SSL_DOMAIN=simrq.example.com
   SSL_EMAIL=admin@example.com
   CLOUDFLARE_API_TOKEN=your-token
   CORS_ORIGIN=https://simrq.example.com

   # Optional: Additional domains (SANs)
   SSL_DOMAIN_ALIASES=requests.example.com,*.internal.example.com
   ```

3. Start with SSL:

   ```bash
   make prod-ssl           # Production with Let's Encrypt
   make prod-ssl-staging   # Test with staging certs first (recommended)
   ```

4. SSL Management:

   ```bash
   make ssl-status         # Check certificate info and expiry
   make ssl-renew          # Force certificate renewal
   make prod-ssl-logs      # View certbot/nginx logs
   ```

Certificates auto-renew every 60 days. No manual intervention needed.

### Option 2: Reverse Proxy

Use an external reverse proxy (Nginx Proxy Manager, Traefik, Caddy, etc.) if you prefer managing TLS separately.

1. Configure your reverse proxy to forward to `http://<server>:8080`
2. Set environment variables in `.env`:

   ```bash
   CORS_ORIGIN=https://your-domain.com
   ```

3. Start Sim RQ: `make prod`

**Nginx example:**

```nginx
server {
    listen 443 ssl http2;
    server_name sim-rq.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/sim-rq.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sim-rq.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://<sim-rq-server>:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Works with: Cloudflare Tunnel, Nginx Proxy Manager, Traefik, Caddy, standard Nginx/Apache.

### File Attachments

File uploads/downloads use S3-compatible storage (Garage). The built-in nginx proxies storage requests to Garage, enabling presigned URL downloads through your public domain.

`S3_PUBLIC_ENDPOINT` defaults to `CORS_ORIGIN` if not set, so file downloads work automatically once `CORS_ORIGIN` is configured.

## Environment Variables

Create `.env` for production:

```bash
# Database
DB_PASSWORD=YourStrongPassword123!

# SSO Encryption (REQUIRED if using SSO)
ENTRA_SSO_ENCRYPTION_KEY=$(openssl rand -base64 32)

# CORS (your public domain)
CORS_ORIGIN=https://your-domain.com

# Environment
NODE_ENV=production
```

**Important:** The `ENTRA_SSO_ENCRYPTION_KEY` is **required** if you plan to use SSO. The server will fail to start if this key is missing and SSO is configured. Generate a secure key with:

```bash
openssl rand -base64 32
```

## SSO Configuration

### Method 1: Environment Variables (Recommended)

Configure SSO via `.env` file - survives database migrations/deletions:

```bash
# In .env file
SSO_TENANT_ID=your-tenant-id
SSO_CLIENT_ID=your-client-id
SSO_CLIENT_SECRET=your-client-secret
SSO_REDIRECT_URI=https://your-domain.com/api/auth/sso/callback
```

Restart containers: `make prod-down && make prod`

### Method 2: Web UI

1. **Azure Portal:**
   - Register app in Microsoft Entra ID
   - Set Redirect URI: `https://your-domain.com/api/auth/sso/callback`
   - Note Tenant ID, Client ID, create Client Secret

2. **Sim RQ Settings:**
   - Login as qAdmin
   - Navigate to Settings → SSO Configuration
   - Enter Tenant ID, Client ID, Client Secret
   - Set Redirect URI: `https://your-domain.com/api/auth/sso/callback`
   - Enable and save

**Important:** Redirect URI must match exactly in both Azure and Sim RQ. The `.env` method is preferred for production as it survives database resets.

## Architecture

- **Frontend**: React + TypeScript + Vite + TailwindCSS v4
- **Backend**: Node.js + Express + TypeScript + Socket.IO
- **Database**: PostgreSQL 16
- **Storage**: Garage (S3-compatible) for file attachments
- **Cache**: Redis 8 (optional - for multi-instance deployments)
- **Auth**: Session cookies + Microsoft Entra ID PKCE
- **Deployment**: Docker + Docker Compose

## Data Storage

All persistent data is stored in the `./data/` directory (bind mounts):

```text
./data/
├── postgres/     # PostgreSQL database files
└── garage/       # S3-compatible file storage
    ├── data/     # File blobs
    └── meta/     # Garage metadata
```

This makes backups simple - just copy the `./data/` directory. The directory is automatically created on first startup and excluded from git.

## Database Management

```bash
make db-backup      # Creates backup.sql
make db-restore     # Restores from backup.sql
make db-shell       # Open psql shell
```

Migrations are in `database/migrations/` and auto-apply on startup.

## Testing

All tests run inside Docker containers - no local dependencies needed.

```bash
make test         # Unit tests (backend + frontend in containers)
make test-e2e     # E2E tests (Playwright in container)
```

**Test suite:** 633 tests total (86 E2E + 124 frontend unit + 423 backend unit tests) covering auth, roles, requests, lifecycle, analytics, forms, navigation, and notifications.

Test reports are saved to `./playwright-report/` and `./test-results/`.

## Monitoring

### Health Checks

- Application: `http://<server>:8080/health`
- Backend (internal): `http://sim-rq-api:3001/health`
- Readiness (internal): `http://sim-rq-api:3001/ready`

### Logs

```bash
make prod-logs    # View production logs
make dev-logs     # View dev logs
```

### Metrics

Prometheus metrics at `http://sim-rq-api:3001/metrics` (internal only)

## Production Deployment Notes

### Multi-Instance / Load Balancer Support

✅ **Sim RQ supports multi-instance deployments** with proper configuration:

- **PKCE state storage**: Database-backed (multi-instance safe)
- **Session management**: PostgreSQL-based with atomic row-level locking
- **WebSocket**: Each instance maintains its own connections
- **Cleanup jobs**: Run independently on each instance (idempotent)

**Requirements for load-balanced deployments:**

1. Database must be shared across all instances
2. Set `ENTRA_SSO_ENCRYPTION_KEY` in environment (required for SSO)
3. Use sticky sessions for WebSocket connections (optional, improves UX)
4. Ensure reverse proxy forwards `X-Forwarded-For` and `X-Forwarded-Proto` headers

**Example Docker deployment with 3 replicas:**

```bash
docker compose up --scale backend=3 -d
```

All authentication flows (including SSO PKCE) will work correctly across instances.

## Security Checklist

- [ ] Change default admin password
- [ ] Set strong `DB_PASSWORD` in `.env`
- [ ] Set `ENTRA_SSO_ENCRYPTION_KEY` (if using SSO) - **REQUIRED** for SSO
- [ ] Configure `CORS_ORIGIN` to your domain
- [ ] Use HTTPS (native SSL with `make prod-ssl` or reverse proxy)
- [ ] Restrict database port (5432) to localhost
- [ ] Set up regular backups (`make db-backup`)
- [ ] Keep Docker images updated

## Troubleshooting

### Port in use

```bash
sudo lsof -i :8080
# Or change port
FRONTEND_PORT=9000 make prod
```

### Container won't start

```bash
make prod-logs
make clean && make prod-build
```

### Login issues / Cookies not working

```bash
# Set CORS_ORIGIN to your exact public URL
echo "CORS_ORIGIN=https://your-domain.com" >> .env
make prod-down && make prod
```

## Contributing

1. Fork the repo
2. Create feature branch (`git checkout -b feature/name`)
3. Make changes
4. Run tests (`make test && make test-e2e`)
5. Commit (`git commit -m 'Add feature'`)
6. Push and open PR

## License

MIT License

## Support

- Open an issue on GitHub
- Check logs: `make prod-logs` or `make dev-logs`
