.PHONY: help dev dev-build dev-logs dev-down prod prod-build prod-logs prod-down test test-e2e clean db-shell db-backup db-restore status

# Default target - show help
help:
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "  Sim-Flow Docker Commands"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo ""
	@echo "  🚀 DEVELOPMENT"
	@echo "     make dev            Start development environment with hot reload"
	@echo "     make dev-build      Rebuild and start development environment"
	@echo "     make dev-logs       View development logs (live)"
	@echo "     make dev-down       Stop development environment"
	@echo ""
	@echo "  🏭 PRODUCTION"
	@echo "     make prod           Start production environment"
	@echo "     make prod-build     Rebuild and start production environment"
	@echo "     make prod-logs      View production logs (live)"
	@echo "     make prod-down      Stop production environment"
	@echo ""
	@echo "  🧪 TESTING"
	@echo "     make test           Run unit tests in containers"
	@echo "     make test-e2e       Run E2E tests (requires running env)"
	@echo ""
	@echo "  🗄️  DATABASE"
	@echo "     make db-shell       Open PostgreSQL shell"
	@echo "     make db-backup      Backup database to backup.sql"
	@echo "     make db-restore     Restore database from backup.sql"
	@echo ""
	@echo "  🔧 UTILITIES"
	@echo "     make status         Show status of all containers"
	@echo "     make clean          Remove all containers, volumes, and images"
	@echo ""
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ============================================================================
# DEVELOPMENT COMMANDS
# ============================================================================

dev:
	@echo "🚀 Starting development environment..."
	docker compose -f docker-compose.dev.yaml up -d
	@echo "✅ Development environment started!"
	@echo ""
	@echo "   Frontend: http://localhost:5173"
	@echo "   Backend:  http://localhost:3001"
	@echo "   Database: localhost:5432"
	@echo ""
	@echo "   Run 'make dev-logs' to view logs"

dev-build:
	@echo "🔨 Building development environment..."
	docker compose -f docker-compose.dev.yaml up -d --build
	@echo "✅ Development environment rebuilt and started!"

dev-logs:
	@echo "📋 Showing development logs (Ctrl+C to exit)..."
	docker compose -f docker-compose.dev.yaml logs -f

dev-down:
	@echo "🛑 Stopping development environment..."
	docker compose -f docker-compose.dev.yaml down
	@echo "✅ Development environment stopped"

# ============================================================================
# PRODUCTION COMMANDS
# ============================================================================

prod:
	@echo "🏭 Starting production environment..."
	docker compose up -d
	@echo "✅ Production environment started!"
	@echo ""
	@echo "   Application: http://localhost:8080"
	@echo "   API:         http://localhost:3001"
	@echo "   Metrics:     http://localhost:3001/metrics"
	@echo "   API Docs:    http://localhost:3001/api-docs"
	@echo ""
	@echo "   Run 'make prod-logs' to view logs"

prod-build:
	@echo "🔨 Building production environment..."
	docker compose up -d --build
	@echo "✅ Production environment rebuilt and started!"

prod-logs:
	@echo "📋 Showing production logs (Ctrl+C to exit)..."
	docker compose logs -f

prod-down:
	@echo "🛑 Stopping production environment..."
	docker compose down
	@echo "✅ Production environment stopped"

# ============================================================================
# TESTING COMMANDS
# ============================================================================

test:
	@echo "🧪 Running unit tests..."
	@echo ""
	@echo "Backend tests:"
	docker compose -f docker-compose.dev.yaml exec backend npm test
	@echo ""
	@echo "Frontend tests:"
	docker compose -f docker-compose.dev.yaml exec frontend npm test

test-e2e:
	@echo "🎭 Running E2E tests with Playwright..."
	@echo "⚠️  Make sure production environment is running (make prod)"
	@echo ""
	npx playwright test
	@echo ""
	@echo "✅ E2E tests complete!"

# ============================================================================
# DATABASE COMMANDS
# ============================================================================

db-shell:
	@echo "🗄️  Opening PostgreSQL shell..."
	@echo "   Database: simflow"
	@echo "   User: simflow_user"
	@echo ""
	@docker compose exec postgres psql -U simflow_user -d simflow || \
	 docker compose -f docker-compose.dev.yaml exec postgres psql -U simflow_user -d simflow

db-backup:
	@echo "💾 Backing up database..."
	@docker compose exec postgres pg_dump -U simflow_user simflow > backup.sql 2>/dev/null || \
	 docker compose -f docker-compose.dev.yaml exec postgres pg_dump -U simflow_user simflow > backup.sql
	@echo "✅ Database backed up to backup.sql"

db-restore:
	@echo "⚠️  Restoring database from backup.sql..."
	@echo "   This will OVERWRITE current data. Press Ctrl+C to cancel."
	@sleep 3
	@docker compose exec -T postgres psql -U simflow_user simflow < backup.sql 2>/dev/null || \
	 docker compose -f docker-compose.dev.yaml exec -T postgres psql -U simflow_user simflow < backup.sql
	@echo "✅ Database restored from backup.sql"

# ============================================================================
# UTILITY COMMANDS
# ============================================================================

status:
	@echo "📊 Container Status:"
	@echo ""
	@echo "Production:"
	@docker compose ps 2>/dev/null || echo "  (not running)"
	@echo ""
	@echo "Development:"
	@docker compose -f docker-compose.dev.yaml ps 2>/dev/null || echo "  (not running)"

clean:
	@echo "⚠️  This will remove ALL Sim-Flow containers, volumes, and images!"
	@echo "   Press Ctrl+C to cancel, or wait 5 seconds to continue..."
	@sleep 5
	@echo ""
	@echo "🧹 Cleaning up..."
	-docker compose down -v 2>/dev/null
	-docker compose -f docker-compose.dev.yaml down -v 2>/dev/null
	-docker rmi sim-flow-frontend:latest sim-flow-backend:latest 2>/dev/null
	-docker rmi sim-flow-frontend:dev sim-flow-backend:dev 2>/dev/null
	@echo "✅ Cleanup complete!"
