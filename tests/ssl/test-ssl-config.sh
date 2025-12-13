#!/bin/bash
# SSL Configuration Tests
# Tests that can run without external dependencies (Cloudflare, Let's Encrypt)
#
# Run: ./tests/ssl/test-ssl-config.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

TESTS_PASSED=0
TESTS_FAILED=0

pass() {
  echo -e "${GREEN}✓${NC} $1"
  TESTS_PASSED=$((TESTS_PASSED + 1))
}

fail() {
  echo -e "${RED}✗${NC} $1"
  TESTS_FAILED=$((TESTS_FAILED + 1))
}

warn() {
  echo -e "${YELLOW}⚠${NC} $1"
}

echo "============================================"
echo "SimRQ SSL Configuration Tests"
echo "============================================"
echo ""

# ============================================
# File Existence Tests
# ============================================
echo "File Existence Tests:"
echo "--------------------------------------------"

[ -f "$PROJECT_ROOT/Dockerfile.certbot" ] && pass "Dockerfile.certbot exists" || fail "Dockerfile.certbot missing"
[ -f "$PROJECT_ROOT/Dockerfile.ssl" ] && pass "Dockerfile.ssl exists" || fail "Dockerfile.ssl missing"
[ -f "$PROJECT_ROOT/certbot-entrypoint.sh" ] && pass "certbot-entrypoint.sh exists" || fail "certbot-entrypoint.sh missing"
[ -f "$PROJECT_ROOT/nginx-ssl-entrypoint.sh" ] && pass "nginx-ssl-entrypoint.sh exists" || fail "nginx-ssl-entrypoint.sh missing"
[ -f "$PROJECT_ROOT/nginx-ssl.conf.template" ] && pass "nginx-ssl.conf.template exists" || fail "nginx-ssl.conf.template missing"
[ -f "$PROJECT_ROOT/docker-compose.ssl.yaml" ] && pass "docker-compose.ssl.yaml exists" || fail "docker-compose.ssl.yaml missing"

echo ""

# ============================================
# Shell Script Syntax Tests
# ============================================
echo "Shell Script Syntax Tests:"
echo "--------------------------------------------"

if bash -n "$PROJECT_ROOT/certbot-entrypoint.sh" 2>/dev/null; then
  pass "certbot-entrypoint.sh has valid bash syntax"
else
  fail "certbot-entrypoint.sh has syntax errors"
fi

if bash -n "$PROJECT_ROOT/nginx-ssl-entrypoint.sh" 2>/dev/null; then
  pass "nginx-ssl-entrypoint.sh has valid bash syntax"
else
  fail "nginx-ssl-entrypoint.sh has syntax errors"
fi

echo ""

# ============================================
# Docker Compose Config Validation
# ============================================
echo "Docker Compose Configuration Tests:"
echo "--------------------------------------------"

# Set dummy values for required env vars
export SSL_DOMAIN="test.example.com"
export SSL_EMAIL="test@example.com"
export CLOUDFLARE_API_TOKEN="test-token"

if docker compose -f "$PROJECT_ROOT/docker-compose.yaml" -f "$PROJECT_ROOT/docker-compose.ssl.yaml" config --quiet 2>/dev/null; then
  pass "docker-compose.ssl.yaml is valid"
else
  fail "docker-compose.ssl.yaml has configuration errors"
fi

unset SSL_DOMAIN SSL_EMAIL CLOUDFLARE_API_TOKEN

echo ""

# ============================================
# Nginx Configuration Tests
# ============================================
echo "Nginx Configuration Tests:"
echo "--------------------------------------------"

# Check for required SSL directives
if grep -q "ssl_protocols TLSv1.2 TLSv1.3" "$PROJECT_ROOT/nginx-ssl.conf.template"; then
  pass "TLS 1.2/1.3 only (modern protocols)"
else
  fail "Missing modern TLS protocol configuration"
fi

if grep -q "ssl_prefer_server_ciphers off" "$PROJECT_ROOT/nginx-ssl.conf.template"; then
  pass "Server cipher preference disabled (modern config)"
else
  fail "Missing ssl_prefer_server_ciphers directive"
fi

if grep -q "ssl_session_tickets off" "$PROJECT_ROOT/nginx-ssl.conf.template"; then
  pass "Session tickets disabled (forward secrecy)"
else
  fail "Missing ssl_session_tickets directive"
fi

if grep -q "Strict-Transport-Security" "$PROJECT_ROOT/nginx-ssl.conf.template"; then
  pass "HSTS header configured"
else
  fail "Missing HSTS header"
fi

if grep -q "ssl_stapling on" "$PROJECT_ROOT/nginx-ssl.conf.template"; then
  pass "OCSP stapling enabled"
else
  fail "Missing OCSP stapling configuration"
fi

if grep -q 'return 301 https://\$host\$request_uri' "$PROJECT_ROOT/nginx-ssl.conf.template"; then
  pass "HTTP to HTTPS redirect configured"
else
  fail "Missing HTTP to HTTPS redirect"
fi

if grep -q 'listen 443 ssl http2' "$PROJECT_ROOT/nginx-ssl.conf.template"; then
  pass "HTTP/2 enabled on port 443"
else
  fail "Missing HTTP/2 configuration"
fi

# Check for variable substitution placeholder
if grep -q '\${SSL_DOMAIN}' "$PROJECT_ROOT/nginx-ssl.conf.template"; then
  pass "SSL_DOMAIN variable placeholder present"
else
  fail "Missing SSL_DOMAIN variable placeholder"
fi

echo ""

# ============================================
# Certbot Entrypoint Tests
# ============================================
echo "Certbot Entrypoint Tests:"
echo "--------------------------------------------"

# Check for required variable validation
if grep -q 'if \[ -z "\${SSL_DOMAIN}"' "$PROJECT_ROOT/certbot-entrypoint.sh"; then
  pass "SSL_DOMAIN validation present"
else
  fail "Missing SSL_DOMAIN validation"
fi

if grep -q 'if \[ -z "\${SSL_EMAIL}"' "$PROJECT_ROOT/certbot-entrypoint.sh"; then
  pass "SSL_EMAIL validation present"
else
  fail "Missing SSL_EMAIL validation"
fi

if grep -q 'if \[ -z "\${CLOUDFLARE_API_TOKEN}"' "$PROJECT_ROOT/certbot-entrypoint.sh"; then
  pass "CLOUDFLARE_API_TOKEN validation present"
else
  fail "Missing CLOUDFLARE_API_TOKEN validation"
fi

# Check for multi-domain support
if grep -q 'SSL_DOMAIN_ALIASES' "$PROJECT_ROOT/certbot-entrypoint.sh"; then
  pass "Multi-domain (SAN) support present"
else
  fail "Missing multi-domain support"
fi

# Check for staging support
if grep -q 'LETSENCRYPT_STAGING' "$PROJECT_ROOT/certbot-entrypoint.sh"; then
  pass "Let's Encrypt staging support present"
else
  fail "Missing staging environment support"
fi

# Check for --staging flag usage
if grep -q '\-\-staging' "$PROJECT_ROOT/certbot-entrypoint.sh"; then
  pass "Certbot --staging flag used when LETSENCRYPT_STAGING=true"
else
  fail "Missing --staging flag in certbot command"
fi

# Check for credentials file permissions
if grep -q 'chmod 600' "$PROJECT_ROOT/certbot-entrypoint.sh"; then
  pass "Credentials file permissions set (600)"
else
  fail "Missing credentials file permission setting"
fi

echo ""

# ============================================
# Staging Environment Tests
# ============================================
echo "Staging Environment Tests:"
echo "--------------------------------------------"

# Test that staging mode is properly configured
if grep -q 'LETSENCRYPT_STAGING=true' "$PROJECT_ROOT/Makefile"; then
  pass "Makefile passes LETSENCRYPT_STAGING=true in staging target"
else
  fail "Missing LETSENCRYPT_STAGING=true in Makefile staging target"
fi

# Test that staging warning is shown
if grep -q 'STAGING' "$PROJECT_ROOT/Makefile" && grep -q 'not trusted' "$PROJECT_ROOT/Makefile"; then
  pass "Staging certificate warning message present"
else
  fail "Missing staging certificate warning in Makefile"
fi

# Test that staging instructions for switching to production exist
if grep -q 'docker volume rm sim-rq-certs' "$PROJECT_ROOT/Makefile"; then
  pass "Instructions to remove staging certs before production"
else
  fail "Missing instructions to remove staging certs"
fi

# Test docker-compose.ssl.yaml has LETSENCRYPT_STAGING env var
if grep -q 'LETSENCRYPT_STAGING' "$PROJECT_ROOT/docker-compose.ssl.yaml"; then
  pass "docker-compose.ssl.yaml supports LETSENCRYPT_STAGING"
else
  fail "Missing LETSENCRYPT_STAGING in docker-compose.ssl.yaml"
fi

# Test that staging defaults to false
if grep -q 'LETSENCRYPT_STAGING:-false' "$PROJECT_ROOT/docker-compose.ssl.yaml"; then
  pass "LETSENCRYPT_STAGING defaults to false"
else
  fail "LETSENCRYPT_STAGING should default to false"
fi

echo ""

# ============================================
# Makefile Tests
# ============================================
echo "Makefile Tests:"
echo "--------------------------------------------"

if grep -q 'prod-ssl:' "$PROJECT_ROOT/Makefile"; then
  pass "prod-ssl target exists"
else
  fail "Missing prod-ssl target"
fi

if grep -q 'prod-ssl-staging:' "$PROJECT_ROOT/Makefile"; then
  pass "prod-ssl-staging target exists"
else
  fail "Missing prod-ssl-staging target"
fi

if grep -q 'ssl-status:' "$PROJECT_ROOT/Makefile"; then
  pass "ssl-status target exists"
else
  fail "Missing ssl-status target"
fi

if grep -q 'ssl-renew:' "$PROJECT_ROOT/Makefile"; then
  pass "ssl-renew target exists"
else
  fail "Missing ssl-renew target"
fi

if grep -q 'ssl-test:' "$PROJECT_ROOT/Makefile"; then
  pass "ssl-test target exists"
else
  fail "Missing ssl-test target"
fi

echo ""

# ============================================
# Development SSL Tests
# ============================================
echo "Development SSL Tests:"
echo "--------------------------------------------"

[ -f "$PROJECT_ROOT/docker-compose.ssl-dev.yaml" ] && pass "docker-compose.ssl-dev.yaml exists" || fail "docker-compose.ssl-dev.yaml missing"

# Check dev SSL uses DEV_SSL_DOMAIN
if grep -q 'DEV_SSL_DOMAIN' "$PROJECT_ROOT/docker-compose.ssl-dev.yaml"; then
  pass "docker-compose.ssl-dev.yaml uses DEV_SSL_DOMAIN"
else
  fail "docker-compose.ssl-dev.yaml should use DEV_SSL_DOMAIN"
fi

# Check dev SSL has separate volume
if grep -q 'sim-rq-dev-certs' "$PROJECT_ROOT/docker-compose.ssl-dev.yaml"; then
  pass "Dev SSL uses separate certificate volume"
else
  fail "Dev SSL should use separate sim-rq-dev-certs volume"
fi

# Check dev SSL uses alternate ports
if grep -q '8443:443' "$PROJECT_ROOT/docker-compose.ssl-dev.yaml"; then
  pass "Dev SSL uses port 8443 for HTTPS"
else
  fail "Dev SSL should use port 8443 to avoid conflict with prod"
fi

# Check Makefile has dev-ssl targets
if grep -q 'dev-ssl:' "$PROJECT_ROOT/Makefile"; then
  pass "dev-ssl target exists"
else
  fail "Missing dev-ssl target"
fi

if grep -q 'dev-ssl-staging:' "$PROJECT_ROOT/Makefile"; then
  pass "dev-ssl-staging target exists"
else
  fail "Missing dev-ssl-staging target"
fi

if grep -q 'dev-ssl-down:' "$PROJECT_ROOT/Makefile"; then
  pass "dev-ssl-down target exists"
else
  fail "Missing dev-ssl-down target"
fi

# Check .env.example has DEV_SSL_DOMAIN
if grep -q 'DEV_SSL_DOMAIN' "$PROJECT_ROOT/.env.example"; then
  pass "DEV_SSL_DOMAIN documented in .env.example"
else
  fail "Missing DEV_SSL_DOMAIN in .env.example"
fi

echo ""

# ============================================
# Documentation Tests
# ============================================
echo "Documentation Tests:"
echo "--------------------------------------------"

if grep -q 'Native SSL' "$PROJECT_ROOT/README.md"; then
  pass "Native SSL documented in README.md"
else
  fail "Missing SSL documentation in README.md"
fi

if grep -q 'SSL_DOMAIN' "$PROJECT_ROOT/.env.example"; then
  pass "SSL_DOMAIN documented in .env.example"
else
  fail "Missing SSL_DOMAIN in .env.example"
fi

if grep -q 'CLOUDFLARE_API_TOKEN' "$PROJECT_ROOT/.env.example"; then
  pass "CLOUDFLARE_API_TOKEN documented in .env.example"
else
  fail "Missing CLOUDFLARE_API_TOKEN in .env.example"
fi

echo ""

# ============================================
# Summary
# ============================================
echo "============================================"
echo "Test Summary"
echo "============================================"
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -gt 0 ]; then
  echo -e "${RED}Some tests failed!${NC}"
  exit 1
else
  echo -e "${GREEN}All tests passed!${NC}"
  exit 0
fi
