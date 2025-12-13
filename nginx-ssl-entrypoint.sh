#!/bin/sh
# Nginx SSL entrypoint script
# - Waits for SSL certificates to be available
# - Substitutes environment variables in nginx config
# - Starts nginx with certificate reload support
set -e

echo "============================================"
echo "SimRQ Nginx SSL Frontend"
echo "============================================"

# Validate required environment variables
if [ -z "${SSL_DOMAIN}" ]; then
  echo "ERROR: SSL_DOMAIN environment variable is required"
  exit 1
fi

echo "Domain: ${SSL_DOMAIN}"

# Certificate paths
CERT_PATH="/etc/letsencrypt/live/${SSL_DOMAIN}/fullchain.pem"
KEY_PATH="/etc/letsencrypt/live/${SSL_DOMAIN}/privkey.pem"

# Wait for certificates to be available
echo ""
echo "Waiting for SSL certificates..."
MAX_WAIT=300  # 5 minutes max wait
WAITED=0

while [ ! -f "$CERT_PATH" ] || [ ! -f "$KEY_PATH" ]; do
  if [ $WAITED -ge $MAX_WAIT ]; then
    echo ""
    echo "ERROR: Certificates not available after ${MAX_WAIT} seconds"
    echo "Expected certificate at: ${CERT_PATH}"
    echo "Expected key at: ${KEY_PATH}"
    echo ""
    echo "Check certbot container logs: docker logs sim-rq-certbot"
    exit 1
  fi

  sleep 5
  WAITED=$((WAITED + 5))
  echo "  Waiting for certificates... (${WAITED}s)"
done

echo ""
echo "✅ SSL certificates found!"
echo ""

# Show certificate info
echo "Certificate details:"
openssl x509 -in "$CERT_PATH" -noout -subject -dates 2>/dev/null || true
echo ""

# Process nginx config template with environment variable substitution
echo "Generating nginx configuration..."
envsubst '${SSL_DOMAIN}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

# Verify nginx configuration
echo "Verifying nginx configuration..."
nginx -t

if [ $? -ne 0 ]; then
  echo ""
  echo "ERROR: Nginx configuration test failed"
  exit 1
fi

echo ""
echo "✅ Nginx configuration valid"
echo ""

# Function to reload nginx on SIGHUP (for certificate renewal)
reload_nginx() {
  echo "[$(date)] Reloading nginx configuration..."
  nginx -s reload
  echo "[$(date)] Nginx reloaded successfully"
}

# Trap SIGHUP for graceful reload
trap reload_nginx HUP

echo "Starting nginx..."
echo "  HTTPS: https://${SSL_DOMAIN}"
echo "  HTTP → HTTPS redirect enabled"
echo ""

# Start nginx in foreground
exec nginx -g "daemon off;"
