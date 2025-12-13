.PHONY: help dev dev-build dev-logs dev-down dev-ssl dev-ssl-build dev-ssl-staging dev-ssl-logs dev-ssl-down prod prod-build prod-logs prod-down prod-ssl prod-ssl-build prod-ssl-staging prod-ssl-logs prod-ssl-down ssl-status ssl-renew ssl-test test test-e2e test-e2e-build clean db-shell db-backup db-restore status

# Default target - show help
help:
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "  Sim RQ Docker Commands"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo ""
	@echo "  🚀 DEVELOPMENT"
	@echo "     make dev            Start development environment with hot reload"
	@echo "     make dev-build      Rebuild and start development environment"
	@echo "     make dev-logs       View development logs (live)"
	@echo "     make dev-down       Stop development environment"
	@echo ""
	@echo "  🔒 DEVELOPMENT SSL (Native HTTPS - ports 8443/8080)"
	@echo "     make dev-ssl        Start dev with native SSL"
	@echo "     make dev-ssl-build  Rebuild and start dev with SSL"
	@echo "     make dev-ssl-staging Start dev with Let's Encrypt staging"
	@echo "     make dev-ssl-logs   View dev SSL logs"
	@echo "     make dev-ssl-down   Stop dev SSL environment"
	@echo ""
	@echo "  🏭 PRODUCTION (HTTP - use with reverse proxy)"
	@echo "     make prod           Start production environment (port 8080)"
	@echo "     make prod-build     Rebuild and start production environment"
	@echo "     make prod-logs      View production logs (live)"
	@echo "     make prod-down      Stop production environment"
	@echo ""
	@echo "  🔒 PRODUCTION SSL (Native HTTPS - Let's Encrypt)"
	@echo "     make prod-ssl       Start with native SSL (ports 443, 80)"
	@echo "     make prod-ssl-build Rebuild and start with SSL"
	@echo "     make prod-ssl-staging  Start with Let's Encrypt staging (testing)"
	@echo "     make prod-ssl-logs  View SSL production logs"
	@echo "     make prod-ssl-down  Stop SSL production environment"
	@echo "     make ssl-status     Show certificate info (CN, SANs, expiry)"
	@echo "     make ssl-renew      Force certificate renewal"
	@echo ""
	@echo "  🧪 TESTING"
	@echo "     make test           Run unit tests in containers"
	@echo "     make test-e2e       Run E2E tests in container (auto-detects env)"
	@echo "     make test-e2e-build Rebuild Playwright container"
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
	docker compose -p sim-rq-dev -f docker-compose.dev.yaml up -d
	@echo "✅ Development environment started!"
	@echo ""
	@echo "   Frontend: http://localhost:5173"
	@echo "   Backend:  http://localhost:3001"
	@echo "   Database: localhost:5432"
	@echo ""
	@echo "   Run 'make dev-logs' to view logs"

dev-build:
	@echo "🔨 Building development environment..."
	docker compose -p sim-rq-dev -f docker-compose.dev.yaml up -d --build
	@echo "✅ Development environment rebuilt and started!"

dev-logs:
	@echo "📋 Showing development logs (Ctrl+C to exit)..."
	docker compose -p sim-rq-dev -f docker-compose.dev.yaml logs -f

dev-down:
	@echo "🛑 Stopping development environment..."
	docker compose -p sim-rq-dev -f docker-compose.dev.yaml down
	@echo "✅ Development environment stopped"

# ============================================================================
# DEVELOPMENT SSL COMMANDS (Native HTTPS - ports 8443/8080)
# ============================================================================

dev-ssl:
	@echo "🔒 Starting development environment with native SSL..."
	@echo ""
	@if [ -z "$$DEV_SSL_DOMAIN" ]; then \
		echo "❌ ERROR: DEV_SSL_DOMAIN environment variable is required"; \
		echo ""; \
		echo "   Set in .env file:"; \
		echo "     DEV_SSL_DOMAIN=simrq-dev.example.com"; \
		echo "     SSL_EMAIL=admin@example.com"; \
		echo "     CLOUDFLARE_API_TOKEN=your-token"; \
		echo ""; \
		exit 1; \
	fi
	docker compose -p sim-rq-dev -f docker-compose.dev.yaml -f docker-compose.ssl-dev.yaml up -d
	@echo ""
	@echo "✅ Development SSL environment started!"
	@echo ""
	@echo "   HTTPS: https://$$DEV_SSL_DOMAIN:8443"
	@echo "   HTTP → HTTPS redirect on port 8080"
	@echo ""
	@echo "   Run 'make dev-ssl-logs' to view logs"

dev-ssl-build:
	@echo "🔨 Building development SSL environment..."
	@if [ -z "$$DEV_SSL_DOMAIN" ]; then \
		echo "❌ ERROR: DEV_SSL_DOMAIN environment variable is required"; \
		exit 1; \
	fi
	docker compose -p sim-rq-dev -f docker-compose.dev.yaml -f docker-compose.ssl-dev.yaml up -d --build
	@echo "✅ Development SSL environment rebuilt and started!"

dev-ssl-staging:
	@echo "🧪 Starting development with Let's Encrypt STAGING certificates..."
	@echo "   (Certificates will NOT be trusted by browsers - for testing only)"
	@echo ""
	@if [ -z "$$DEV_SSL_DOMAIN" ]; then \
		echo "❌ ERROR: DEV_SSL_DOMAIN environment variable is required"; \
		exit 1; \
	fi
	LETSENCRYPT_STAGING=true docker compose -p sim-rq-dev -f docker-compose.dev.yaml -f docker-compose.ssl-dev.yaml up -d
	@echo ""
	@echo "✅ Development SSL (STAGING) environment started!"
	@echo ""
	@echo "   ⚠️  Using Let's Encrypt STAGING - certificates not trusted"
	@echo "   HTTPS: https://$$DEV_SSL_DOMAIN:8443 (browser will show warning)"
	@echo ""
	@echo "   When ready for production, run:"
	@echo "     make dev-ssl-down"
	@echo "     docker volume rm sim-rq-dev-certs"
	@echo "     make dev-ssl"

dev-ssl-logs:
	@echo "📋 Showing development SSL logs (Ctrl+C to exit)..."
	docker compose -p sim-rq-dev -f docker-compose.dev.yaml -f docker-compose.ssl-dev.yaml logs -f

dev-ssl-down:
	@echo "🛑 Stopping development SSL environment..."
	docker compose -p sim-rq-dev -f docker-compose.dev.yaml -f docker-compose.ssl-dev.yaml down
	@echo "✅ Development SSL environment stopped"
	@echo ""
	@echo "   Note: Certificates are preserved in the sim-rq-dev-certs volume"
	@echo "   To remove certificates: docker volume rm sim-rq-dev-certs"

# ============================================================================
# PRODUCTION COMMANDS
# ============================================================================

prod:
	@echo "🏭 Starting production environment..."
	docker compose -p sim-rq-prod up -d
	@echo "✅ Production environment started!"
	@echo ""
	@echo "   Application: http://localhost:8080"
	@echo ""
	@echo "   Run 'make prod-logs' to view logs"

prod-build:
	@echo "🔨 Building production environment..."
	docker compose -p sim-rq-prod up -d --build
	@echo "✅ Production environment rebuilt and started!"

prod-logs:
	@echo "📋 Showing production logs (Ctrl+C to exit)..."
	docker compose -p sim-rq-prod logs -f

prod-down:
	@echo "🛑 Stopping production environment..."
	docker compose -p sim-rq-prod down
	@echo "✅ Production environment stopped"

# ============================================================================
# PRODUCTION SSL COMMANDS (Native HTTPS with Let's Encrypt)
# ============================================================================

prod-ssl:
	@echo "🔒 Starting production environment with native SSL..."
	@echo ""
	@if [ -z "$$SSL_DOMAIN" ]; then \
		echo "❌ ERROR: SSL_DOMAIN environment variable is required"; \
		echo ""; \
		echo "   Set in .env file:"; \
		echo "     SSL_DOMAIN=simrq.example.com"; \
		echo "     SSL_EMAIL=admin@example.com"; \
		echo "     CLOUDFLARE_API_TOKEN=your-token"; \
		echo ""; \
		exit 1; \
	fi
	docker compose -p sim-rq-prod -f docker-compose.yaml -f docker-compose.ssl.yaml up -d
	@echo ""
	@echo "✅ Production SSL environment started!"
	@echo ""
	@echo "   HTTPS: https://$$SSL_DOMAIN"
	@echo "   HTTP → HTTPS redirect enabled"
	@echo ""
	@echo "   Run 'make prod-ssl-logs' to view logs"
	@echo "   Run 'make ssl-status' to check certificate status"

prod-ssl-build:
	@echo "🔨 Building production SSL environment..."
	@if [ -z "$$SSL_DOMAIN" ]; then \
		echo "❌ ERROR: SSL_DOMAIN environment variable is required"; \
		exit 1; \
	fi
	docker compose -p sim-rq-prod -f docker-compose.yaml -f docker-compose.ssl.yaml up -d --build
	@echo "✅ Production SSL environment rebuilt and started!"

prod-ssl-staging:
	@echo "🧪 Starting production with Let's Encrypt STAGING certificates..."
	@echo "   (Certificates will NOT be trusted by browsers - for testing only)"
	@echo ""
	@if [ -z "$$SSL_DOMAIN" ]; then \
		echo "❌ ERROR: SSL_DOMAIN environment variable is required"; \
		exit 1; \
	fi
	LETSENCRYPT_STAGING=true docker compose -p sim-rq-prod -f docker-compose.yaml -f docker-compose.ssl.yaml up -d
	@echo ""
	@echo "✅ Production SSL (STAGING) environment started!"
	@echo ""
	@echo "   ⚠️  Using Let's Encrypt STAGING - certificates not trusted"
	@echo "   HTTPS: https://$$SSL_DOMAIN (browser will show warning)"
	@echo ""
	@echo "   When ready for production, run:"
	@echo "     make prod-ssl-down"
	@echo "     docker volume rm sim-rq-certs"
	@echo "     make prod-ssl"

prod-ssl-logs:
	@echo "📋 Showing production SSL logs (Ctrl+C to exit)..."
	docker compose -p sim-rq-prod -f docker-compose.yaml -f docker-compose.ssl.yaml logs -f

prod-ssl-down:
	@echo "🛑 Stopping production SSL environment..."
	docker compose -p sim-rq-prod -f docker-compose.yaml -f docker-compose.ssl.yaml down
	@echo "✅ Production SSL environment stopped"
	@echo ""
	@echo "   Note: Certificates are preserved in the sim-rq-certs volume"
	@echo "   To remove certificates: docker volume rm sim-rq-certs"

ssl-status:
	@echo "🔐 Certificate Status:"
	@echo ""
	@if [ -z "$$SSL_DOMAIN" ]; then \
		echo "❌ ERROR: SSL_DOMAIN environment variable is required"; \
		exit 1; \
	fi
	@docker compose -p sim-rq-prod -f docker-compose.yaml -f docker-compose.ssl.yaml exec certbot sh -c '\
		CERT_PATH="/etc/letsencrypt/live/$$SSL_DOMAIN/fullchain.pem"; \
		if [ -f "$$CERT_PATH" ]; then \
			echo "Certificate Information:"; \
			echo ""; \
			openssl x509 -in "$$CERT_PATH" -noout -subject -issuer -dates -ext subjectAltName 2>/dev/null | head -20; \
			echo ""; \
			EXPIRY=$$(openssl x509 -in "$$CERT_PATH" -noout -enddate 2>/dev/null | cut -d= -f2); \
			EXPIRY_EPOCH=$$(date -d "$$EXPIRY" +%s 2>/dev/null || date -j -f "%b %d %T %Y %Z" "$$EXPIRY" +%s 2>/dev/null); \
			NOW_EPOCH=$$(date +%s); \
			DAYS_LEFT=$$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 )); \
			echo "Days until expiry: $$DAYS_LEFT"; \
			echo ""; \
			echo "Certificate path: /etc/letsencrypt/live/$$SSL_DOMAIN/"; \
		else \
			echo "❌ No certificate found at $$CERT_PATH"; \
			echo "   Run 'make prod-ssl' to obtain a certificate"; \
		fi \
	' 2>/dev/null || echo "❌ Certbot container not running. Start with 'make prod-ssl'"

ssl-renew:
	@echo "🔄 Forcing certificate renewal..."
	@if [ -z "$$SSL_DOMAIN" ]; then \
		echo "❌ ERROR: SSL_DOMAIN environment variable is required"; \
		exit 1; \
	fi
	docker compose -p sim-rq-prod -f docker-compose.yaml -f docker-compose.ssl.yaml exec certbot certbot renew --force-renewal
	@echo ""
	@echo "✅ Certificate renewed! Reloading nginx..."
	docker compose -p sim-rq-prod -f docker-compose.yaml -f docker-compose.ssl.yaml exec frontend nginx -s reload
	@echo "✅ Nginx reloaded with new certificate"

ssl-test:
	@echo "🧪 Running SSL configuration tests..."
	@./tests/ssl/test-ssl-config.sh

# ============================================================================
# TESTING COMMANDS
# ============================================================================

test:
	@echo "🧪 Running unit tests..."
	@echo ""
	@echo "Backend tests:"
	docker compose -p sim-rq-dev -f docker-compose.dev.yaml exec backend npm test
	@echo ""
	@echo "Frontend tests:"
	docker compose -p sim-rq-dev -f docker-compose.dev.yaml exec frontend npm test

test-e2e:
	@echo "🎭 Running E2E tests with Playwright (in container)..."
	@echo ""
	@# Enable DISABLE_RATE_LIMITING for E2E tests to avoid rate limit issues
	@if docker compose -p sim-rq-prod ps --quiet frontend 2>/dev/null | grep -q .; then \
		echo "📦 Running against production environment..."; \
		echo "🔓 Restarting backend with rate limiting disabled for tests..."; \
		DISABLE_RATE_LIMITING=true docker compose -p sim-rq-prod up -d backend; \
		sleep 5; \
		docker compose -p sim-rq-prod --profile e2e run --rm playwright; \
		echo "🔒 Restarting backend with normal rate limiting..."; \
		docker compose -p sim-rq-prod up -d backend; \
	elif docker compose -p sim-rq-dev -f docker-compose.dev.yaml ps --quiet frontend 2>/dev/null | grep -q .; then \
		echo "📦 Running against development environment..."; \
		echo "🔓 Restarting backend with rate limiting disabled for tests..."; \
		DISABLE_RATE_LIMITING=true docker compose -p sim-rq-dev -f docker-compose.dev.yaml up -d backend; \
		sleep 5; \
		docker compose -p sim-rq-dev -f docker-compose.dev.yaml --profile e2e run --rm playwright; \
		echo "🔒 Restarting backend with normal rate limiting..."; \
		docker compose -p sim-rq-dev -f docker-compose.dev.yaml up -d backend; \
	else \
		echo "❌ No Sim RQ environment running!"; \
		echo "   Start with: make prod  or  make dev"; \
		exit 1; \
	fi
	@echo ""
	@echo "✅ E2E tests complete!"
	@echo "   Reports: ./playwright-report/index.html"

test-e2e-build:
	@echo "🔨 Building Playwright container..."
	docker compose -p sim-rq-dev -f docker-compose.dev.yaml --profile e2e build playwright
	@echo "✅ Playwright container built!"

# ============================================================================
# DATABASE COMMANDS
# ============================================================================

db-shell:
	@echo "🗄️  Opening PostgreSQL shell..."
	@echo "   Database: sim-rq"
	@echo "   User: sim-rq_user"
	@echo ""
	@docker compose -p sim-rq-prod exec postgres psql -U sim-rq_user -d sim-rq || \
	 docker compose -p sim-rq-dev -f docker-compose.dev.yaml exec postgres psql -U sim-rq_user -d sim-rq

db-backup:
	@echo "💾 Backing up database..."
	@docker compose -p sim-rq-prod exec postgres pg_dump -U sim-rq_user sim-rq > backup.sql 2>/dev/null || \
	 docker compose -p sim-rq-dev -f docker-compose.dev.yaml exec postgres pg_dump -U sim-rq_user sim-rq > backup.sql
	@echo "✅ Database backed up to backup.sql"

db-restore:
	@echo "⚠️  Restoring database from backup.sql..."
	@echo "   This will OVERWRITE current data. Press Ctrl+C to cancel."
	@sleep 3
	@docker compose -p sim-rq-prod exec -T postgres psql -U sim-rq_user sim-rq < backup.sql 2>/dev/null || \
	 docker compose -p sim-rq-dev -f docker-compose.dev.yaml exec -T postgres psql -U sim-rq_user sim-rq < backup.sql
	@echo "✅ Database restored from backup.sql"

# ============================================================================
# UTILITY COMMANDS
# ============================================================================

status:
	@echo "📊 Container Status:"
	@echo ""
	@echo "Production:"
	@docker compose -p sim-rq-prod ps 2>/dev/null || echo "  (not running)"
	@echo ""
	@echo "Development:"
	@docker compose -p sim-rq-dev -f docker-compose.dev.yaml ps 2>/dev/null || echo "  (not running)"

clean:
	@echo "⚠️  This will remove ALL Sim RQ containers, volumes, and images!"
	@echo "   Press Ctrl+C to cancel, or wait 5 seconds to continue..."
	@sleep 5
	@echo ""
	@echo "🧹 Cleaning up..."
	-docker compose -p sim-rq-prod down -v 2>/dev/null
	-docker compose -p sim-rq-dev -f docker-compose.dev.yaml down -v 2>/dev/null
	-docker rmi sim-rq-frontend:latest sim-rq-backend:latest 2>/dev/null
	-docker rmi sim-rq-frontend:dev sim-rq-backend:dev 2>/dev/null
	@echo "✅ Cleanup complete!"
