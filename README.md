# Sim-Flow Dashboard

A role-based engineering simulation request management system with comprehensive audit logging, analytics, and Microsoft Entra ID SSO integration.

## Features

- **Role-Based Access Control**: Admin, Manager, Engineer, and End-User roles
- **Request Management**: Full lifecycle tracking from submission to completion
- **Project Hour Tracking**: Allocate and monitor project hour budgets
- **SSO Integration**: Microsoft Entra ID (Azure AD) authentication
- **Audit Logging**: Comprehensive tracking of all system actions
- **Analytics Dashboard**: Real-time insights into team productivity and resource utilization
- **Discussion Workflow**: Engineers can request hour adjustments with manager approval
- **Title Change Approval**: Controlled request title modifications
- **Security**: JWT with refresh tokens, rate limiting, structured logging
- **Monitoring**: Prometheus metrics, health checks, API documentation

## 🚀 Quick Start (Docker-First)

**Prerequisites:** Docker and Docker Compose only!

### Production Deployment

```bash
# 1. Clone the repository
git clone https://github.com/j-cadena1/sim-flow.git
cd sim-flow

# 2. Create environment file (optional - has secure defaults)
cp .env.example .env

# 3. Start the application
make prod

# That's it! ✨
# Application: http://localhost:8080
# API Docs:    http://localhost:3001/api-docs
```

### Development with Hot Reload

```bash
# Start development environment (hot reload enabled)
make dev

# Frontend: http://localhost:5173 (Vite dev server)
# Backend:  http://localhost:3001
# Database: localhost:5432
```

## 📖 Available Commands

Run `make help` to see all available commands:

```bash
make help         # Show all commands

# Development
make dev          # Start dev environment with hot reload
make dev-logs     # View development logs
make dev-down     # Stop dev environment

# Production
make prod         # Start production environment
make prod-logs    # View production logs
make prod-down    # Stop production environment

# Testing
make test         # Run unit tests
make test-e2e     # Run E2E tests with Playwright

# Database
make db-shell     # Open PostgreSQL shell
make db-backup    # Backup database to backup.sql
make db-restore   # Restore from backup.sql

# Utilities
make status       # Show container status
make clean        # Remove all containers and volumes
```

## 🏗️ Architecture

- **Frontend**: React + TypeScript + Vite + TailwindCSS
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL 16
- **Authentication**: JWT + Microsoft Entra ID PKCE flow
- **Deployment**: Docker + Docker Compose
- **Monitoring**: Prometheus metrics, structured logging
- **Documentation**: OpenAPI/Swagger

## 📐 Development Philosophy

This project follows two core principles:

1. **Docker-First Approach**: The application is designed to run anywhere Docker is installed. All services (frontend, backend, database) are containerized, ensuring consistent behavior across development, testing, and production environments. No local dependencies required beyond Docker.

2. **Well-Documented Code**: All new features and code changes should be thoroughly documented. This includes JSDoc comments for functions, inline comments for complex logic, and updated README sections for user-facing features.

## 🔒 Security Configuration

### Default Credentials

**Admin User:**

- Email: `qadmin@simflow.local`
- Password: `admin123`

**⚠️ Change the admin password immediately in production!**

### Environment Variables

Create a `.env` file for production (optional - defaults are provided):

```bash
# Database
DB_PASSWORD=YourStrongPasswordHere123!@#

# JWT Secret (REQUIRED for production)
JWT_SECRET=$(openssl rand -base64 32)

# CORS (restrict to your domain in production)
CORS_ORIGIN=https://your-domain.com

# Node Environment
NODE_ENV=production
```

### Production Security Checklist

- [ ] Change default admin password
- [ ] Set a strong `JWT_SECRET` in `.env`
- [ ] Set a strong `DB_PASSWORD` in `.env`
- [ ] Configure `CORS_ORIGIN` to your domain
- [ ] Use HTTPS with a reverse proxy (nginx/Traefik/Caddy)
- [ ] Restrict database port (5432) to localhost only
- [ ] Set up regular database backups (`make db-backup`)
- [ ] Monitor logs for suspicious activity
- [ ] Keep Docker images updated

## 🛠️ Development

### Prerequisites (for local development only)

If you want to develop outside of Docker, you'll need:

- Node.js 20+
- PostgreSQL 16+

But we recommend using the Docker development environment instead:

```bash
make dev          # Everything runs in Docker with hot reload
make dev-logs     # View logs
```

### Project Structure

```text
sim-flow/
├── backend/              # Express API server
│   ├── src/
│   │   ├── controllers/  # Request handlers
│   │   ├── middleware/   # Auth, logging, rate limiting
│   │   ├── routes/       # API routes
│   │   ├── services/     # Business logic
│   │   └── utils/        # Helpers
│   ├── Dockerfile        # Production build
│   └── Dockerfile.dev    # Development with hot reload
├── components/           # React components
├── contexts/             # React contexts (Auth, Theme, etc)
├── lib/                  # API client, utilities
├── database/             # SQL migrations and init scripts
├── tests/                # E2E tests (Playwright)
├── Dockerfile            # Frontend production build
├── Dockerfile.dev        # Frontend dev server
├── docker-compose.yaml   # Production configuration
├── docker-compose.dev.yaml  # Development configuration
└── Makefile             # Easy Docker commands
```

## 🧪 Testing

### Unit Tests

```bash
# Run in Docker (recommended)
make test

# Or locally
npm test                  # Frontend tests
cd backend && npm test    # Backend tests
```

### E2E Tests

```bash
# Start production environment
make prod

# Run E2E tests
make test-e2e

# Or manually
npx playwright test
npx playwright test --ui    # Interactive mode
```

## 📊 Monitoring

### Health Checks

- Frontend health: `http://localhost:8080/health`
- Backend health: `http://localhost:3001/health`
- Backend ready: `http://localhost:3001/ready`

### Metrics

Prometheus metrics available at: `http://localhost:3001/metrics`

Includes:

- HTTP request counts and durations
- Database connection pool stats
- Active users
- Request status distributions
- Process uptime and memory usage

### API Documentation

Interactive Swagger documentation: `http://localhost:3001/api-docs`

### Logs

```bash
# Production logs
make prod-logs

# Development logs
make dev-logs

# Or directly with Docker
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f postgres
```

## 🗄️ Database Management

### Backup

```bash
# Create backup
make db-backup

# Creates backup.sql in current directory
```

### Restore

```bash
# Restore from backup.sql
make db-restore
```

### Direct Access

```bash
# Open PostgreSQL shell
make db-shell

# Or manually
docker compose exec postgres psql -U simflow_user -d simflow
```

### Migrations

Database migrations are automatically applied on container startup from `database/init.sql`.

To add new migrations:

1. Create SQL file in `database/migrations/`
2. Add to `database/init.sql`
3. Rebuild containers: `make prod-build`

## 🚢 Deployment Options

### Option 1: Docker Compose (Recommended)

```bash
# On your server
git clone https://github.com/j-cadena1/sim-flow.git
cd sim-flow
cp .env.example .env
nano .env  # Set JWT_SECRET and DB_PASSWORD
make prod
```

### Option 2: Behind Reverse Proxy (Production)

Example nginx configuration:

```nginx
server {
    listen 443 ssl http2;
    server_name simflow.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Option 3: Kubernetes (Advanced)

Kubernetes manifests coming soon. For now, use Docker Compose.

## 🔧 Troubleshooting

### Port Already in Use

```bash
# Check what's using the port
sudo lsof -i :8080

# Change port in docker-compose.yaml or use environment variable
FRONTEND_PORT=9000 make prod
```

### Container Won't Start

```bash
# Check logs
make prod-logs

# Rebuild from scratch
make clean
make prod-build
```

### Database Connection Errors

```bash
# Check database health
docker compose ps postgres

# Restart database
docker compose restart postgres

# Check logs
docker compose logs postgres
```

### Permission Errors

```bash
# Reset permissions on volumes
make clean
make prod
```

## 📚 Documentation

- [Quick Start Guide](QUICKSTART.md) - Fast deployment walkthrough
- [Backend Architecture](BACKEND-STATUS.md) - API documentation and architecture
- [Project Structure](STRUCTURE.md) - Codebase organization

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`make test && make test-e2e`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## 📝 License

MIT License - See LICENSE file for details.

## 💬 Support

For issues or questions:

- Open an issue on GitHub
- Check existing documentation
- Review logs with `make prod-logs` or `make dev-logs`
