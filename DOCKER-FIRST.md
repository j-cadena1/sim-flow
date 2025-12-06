# 🐳 Docker-First Deployment Guide

**Zero Dependencies. Just Docker.**

This guide shows you how to deploy and develop Sim-Flow using only Docker and Docker Compose. No Node.js, no PostgreSQL, no npm - just Docker.

---

## ✅ Prerequisites

**Required:**

- Docker 20.10+
- Docker Compose V2 (built into modern Docker)

**That's it!** No other dependencies needed.

### Verify Docker Installation

```bash
docker --version
docker compose version
```

Expected output:

```text
Docker version 24.0.0 or higher
Docker Compose version v2.0.0 or higher
```

---

## 🚀 Production Deployment

Perfect for deploying on a server, VM, or your local machine.

### 3-Step Deployment

```bash
# 1. Clone the repository
git clone https://github.com/j-cadena1/sim-flow.git
cd sim-flow

# 2. (Optional) Configure environment
cp .env.example .env
# Edit .env and set DB_PASSWORD

# 3. Start everything
make prod
```

**That's it!** 🎉

### What Just Happened?

Docker built and started three containers:

| Container | Purpose | Port |
|-----------|---------|------|
| **sim-flow-db** | PostgreSQL 16 database | 5432 (internal) |
| **sim-flow-api** | Node.js backend API | 3001 |
| **sim-flow-frontend** | Nginx + React app | 8080 |

### Access Your Application

```text
🌐 Application:  http://localhost:8080
📚 API Docs:     http://localhost:3001/api-docs
📊 Metrics:      http://localhost:3001/metrics
```

### Default Login

```text
Email:    qadmin@simflow.local
Password: admin123
```

**⚠️ Change this password in production!**

---

## 💻 Development Mode

Hot reload for both frontend and backend - no local Node.js needed!

### Start Development Environment

```bash
make dev
```

This starts:

- **Frontend dev server** (Vite with HMR) on port 5173
- **Backend dev server** (tsx watch) on port 3001
- **PostgreSQL** on port 5432
- **Node debugger** on port 9229 (for VS Code/IDE debugging)

### Access Development Environment

```text
🔥 Frontend (Hot Reload):  http://localhost:5173
🔌 Backend API:            http://localhost:3001
🗄️  Database:              localhost:5432
🐛 Node Debugger:          localhost:9229
```

### How Hot Reload Works

Source code is mounted as volumes:

- Edit files in `src/`, `components/`, `contexts/`, etc.
- Vite automatically reloads frontend changes
- tsx watch automatically restarts backend on changes
- Database data persists in Docker volumes

### View Logs

```bash
# All services
make dev-logs

# Or individual services
docker compose -f docker-compose.dev.yaml logs -f backend
docker compose -f docker-compose.dev.yaml logs -f frontend
```

### Stop Development Environment

```bash
make dev-down
```

---

## 📖 Available Make Commands

```bash
make help         # Show all commands with descriptions

# Development Commands
make dev          # Start dev environment with hot reload
make dev-build    # Rebuild and start dev environment
make dev-logs     # View development logs (live)
make dev-down     # Stop dev environment

# Production Commands
make prod         # Start production environment
make prod-build   # Rebuild and start production
make prod-logs    # View production logs (live)
make prod-down    # Stop production environment

# Testing Commands
make test         # Run unit tests in containers
make test-e2e     # Run E2E tests with Playwright

# Database Commands
make db-shell     # Open PostgreSQL shell
make db-backup    # Backup database to backup.sql
make db-restore   # Restore from backup.sql

# Utility Commands
make status       # Show status of all containers
make clean        # Remove all containers, volumes, images
```

---

## 🧪 Running Tests

### Unit Tests (in Docker)

```bash
# Start dev environment first
make dev

# Run tests
make test
```

This runs tests in Docker containers:

- Frontend tests: React Testing Library + Vitest
- Backend tests: Vitest

### E2E Tests (Playwright)

```bash
# Start production environment
make prod

# Run E2E tests
make test-e2e
```

E2E tests run on your local machine (requires Playwright) but test the Dockerized application.

---

## 🗄️ Database Management

### Access Database Shell

```bash
make db-shell
```

Now you can run SQL queries:

```sql
SELECT * FROM users;
SELECT * FROM requests;
\dt  -- List all tables
\q   -- Quit
```

### Backup Database

```bash
make db-backup
```

Creates `backup.sql` in the current directory.

### Restore Database

```bash
make db-restore
```

Restores from `backup.sql`. **Warning:** This overwrites current data!

### View Database with GUI Tools

Connect to `localhost:5432` with your favorite database tool:

**Connection details:**

- Host: `localhost`
- Port: `5432`
- Database: `simflow`
- User: `simflow_user`
- Password: (from your `.env` or default `SimFlow2025!Secure`)

Popular tools:

- pgAdmin
- DBeaver
- TablePlus
- DataGrip

---

## 🔧 Configuration

### Environment Variables

Create `.env` file (optional - defaults provided):

```bash
# Database Password
DB_PASSWORD=YourStrongPasswordHere123!@#

# SSO Encryption Key (for storing SSO client secrets)
SSO_ENCRYPTION_KEY=your-encryption-key-min-32-chars

# CORS Origin (restrict in production)
CORS_ORIGIN=https://your-domain.com

# Node Environment
NODE_ENV=production

# Version Overrides (optional)
NODE_VERSION=20
POSTGRES_VERSION=16
```

Generate secure secrets:

```bash
# Generate SSO encryption key
openssl rand -base64 32

# Generate database password
openssl rand -base64 24
```

### Change Ports

Edit `docker-compose.yaml` or `docker-compose.dev.yaml`:

```yaml
# Production frontend (default 8080)
frontend:
  ports:
    - "9000:80"  # Change to port 9000

# Development frontend (default 5173)
frontend:
  ports:
    - "3000:5173"  # Change to port 3000
```

Then restart:

```bash
make prod-down && make prod
# or
make dev-down && make dev
```

---

## 🏗️ How It Works

### Production Build Process

When you run `make prod`:

1. **Backend build:**
   - Installs dependencies in container
   - Compiles TypeScript to JavaScript
   - Creates optimized production image
   - Removes dev dependencies

2. **Frontend build:**
   - Installs dependencies in container
   - Builds React app with Vite
   - Copies build to nginx
   - Creates minimal nginx image

3. **Database setup:**
   - Pulls PostgreSQL 16 Alpine image
   - Runs init.sql migrations
   - Creates persistent volume

### Development Setup

When you run `make dev`:

1. **Source code mounting:**
   - Your local files are mounted into containers
   - Changes trigger hot reload
   - node_modules stay in Docker (no local conflicts)

2. **Hot reload enabled:**
   - Frontend: Vite dev server with HMR
   - Backend: tsx watch restarts on changes
   - Database: Data persists across restarts

3. **Debugging enabled:**
   - Backend runs with `--inspect` flag
   - Debugger exposed on port 9229
   - Connect VS Code or Chrome DevTools

---

## 🐛 Debugging

### Backend Debugging (VS Code)

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "attach",
      "name": "Docker: Attach to Backend",
      "remoteRoot": "/app",
      "localRoot": "${workspaceFolder}/backend",
      "port": 9229,
      "restart": true,
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

Then:

1. Start dev environment: `make dev`
2. Set breakpoints in VS Code
3. Press F5 or click "Run > Start Debugging"

### Frontend Debugging

Use browser DevTools:

1. Open <http://localhost:5173>
2. Open DevTools (F12)
3. Source maps are enabled automatically
4. Debug original TypeScript code

---

## 📊 Monitoring

### Container Health

```bash
# Quick status
make status

# Detailed stats
docker stats

# Logs
make prod-logs    # Production
make dev-logs     # Development
```

### Health Endpoints

```bash
# Frontend health
curl http://localhost:8080/health

# Backend health
curl http://localhost:3001/health

# Backend ready check
curl http://localhost:3001/ready
```

### Prometheus Metrics

```bash
# View metrics
curl http://localhost:3001/metrics

# Or in browser
open http://localhost:3001/metrics
```

---

## 🚢 Deploying to Server

### Ubuntu/Debian Server

```bash
# 1. Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker

# 2. Clone and deploy
git clone https://github.com/j-cadena1/sim-flow.git
cd sim-flow
cp .env.example .env
nano .env  # Set DB_PASSWORD

# 3. Start
make prod

# 4. Configure firewall
sudo ufw allow 8080/tcp
sudo ufw enable
```

### Behind Nginx Reverse Proxy

Install nginx on host:

```bash
sudo apt install nginx
```

Create `/etc/nginx/sites-available/simflow`:

```nginx
server {
    listen 80;
    server_name simflow.yourdomain.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable and add SSL:

```bash
sudo ln -s /etc/nginx/sites-available/simflow /etc/nginx/sites-enabled/
sudo certbot --nginx -d simflow.yourdomain.com
sudo nginx -t
sudo systemctl reload nginx
```

---

## 🔥 Troubleshooting

### Container Won't Start

```bash
# Check logs
make prod-logs

# Rebuild from scratch
make clean
make prod-build
```

### Port Already in Use

```bash
# Find what's using the port
sudo lsof -i :8080

# Kill it
sudo kill -9 <PID>

# Or change port in docker-compose.yaml
```

### Database Connection Failed

```bash
# Check database is running
docker compose ps postgres

# Check logs
docker compose logs postgres

# Restart database
docker compose restart postgres

# Nuclear option - reset everything
make clean
make prod
```

### Permission Denied

```bash
# Make sure you're in docker group
sudo usermod -aG docker $USER
newgrp docker

# Try again
make prod
```

### Out of Disk Space

```bash
# Clean unused Docker resources
docker system prune -a

# Or complete cleanup
make clean
```

---

## 💡 Pro Tips

### Automatic Restart on Boot

```bash
# Production services already have restart: unless-stopped
# This means they'll auto-start on system reboot

# Verify
docker compose ps
# Should show "restart: unless-stopped"
```

### Regular Backups

Add to crontab:

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * cd /path/to/sim-flow && make db-backup
```

### Monitor Resource Usage

```bash
# Real-time stats
docker stats

# Container inspect
docker compose ps
docker compose top
```

### Update to Latest Version

```bash
cd sim-flow
git pull
make prod-build
```

---

## 🎯 Common Workflows

### Fresh Start

```bash
make clean
make prod
```

### Switch Dev ↔ Prod

```bash
# Stop production
make prod-down

# Start development
make dev

# Later: stop dev, start prod
make dev-down
make prod
```

### Run Tests

```bash
# Start dev environment
make dev

# Run unit tests
make test

# Stop dev, start prod for E2E
make dev-down
make prod

# Run E2E tests
make test-e2e
```

---

## 🆘 Getting Help

1. **Check logs:**

   ```bash
   make prod-logs
   # or
   make dev-logs
   ```

2. **Check container status:**

   ```bash
   make status
   docker compose ps
   ```

3. **Check health endpoints:**

   ```bash
   curl http://localhost:8080/health
   curl http://localhost:3001/health
   ```

4. **View documentation:**
   - README.md - Overview
   - BACKEND-STATUS.md - API docs
   - docker-compose.yaml - Production config
   - docker-compose.dev.yaml - Dev config

5. **GitHub Issues:**
   - <https://github.com/j-cadena1/sim-flow/issues>

---

## ✨ Summary

You now have a fully Dockerized application:

- ✅ **Zero local dependencies** - just Docker
- ✅ **Development mode** - hot reload for frontend & backend
- ✅ **Production mode** - optimized builds
- ✅ **Easy commands** - `make dev`, `make prod`, `make test`
- ✅ **Database included** - PostgreSQL in container
- ✅ **Debugging support** - VS Code remote debugging
- ✅ **Monitoring** - health checks, metrics, logs
- ✅ **Testing** - unit and E2E tests in Docker

**Happy Dockering!** 🐳
