#!/bin/bash
# Certbot entrypoint script for Let's Encrypt certificates via Cloudflare DNS-01
# Supports multiple domains: SSL_DOMAIN (CN) and SSL_DOMAIN_ALIASES (SANs)

echo "============================================"
echo "Sim RQ Certificate Manager (Certbot)"
echo "============================================"
echo ""

# Validate required environment variables
if [ -z "${SSL_DOMAIN}" ]; then
  echo "❌ ERROR: SSL_DOMAIN is required"
  echo "   Example: SSL_DOMAIN=simrq.example.com"
  exit 1
fi

if [ -z "${SSL_EMAIL}" ]; then
  echo "❌ ERROR: SSL_EMAIL is required"
  echo "   Example: SSL_EMAIL=admin@example.com"
  exit 1
fi

if [ -z "${CLOUDFLARE_API_TOKEN}" ]; then
  echo "❌ ERROR: CLOUDFLARE_API_TOKEN is required"
  echo "   Create at: https://dash.cloudflare.com/profile/api-tokens"
  echo "   Required permissions: Zone > DNS > Edit"
  exit 1
fi

# Validate token format (basic check - should not be empty or contain spaces)
if [[ "${CLOUDFLARE_API_TOKEN}" =~ [[:space:]] ]]; then
  echo "❌ ERROR: CLOUDFLARE_API_TOKEN contains spaces - this looks invalid"
  exit 1
fi

echo "Configuration:"
echo "  Domain: ${SSL_DOMAIN}"
echo "  Email: ${SSL_EMAIL}"
echo "  Token: ${CLOUDFLARE_API_TOKEN:0:8}... (${#CLOUDFLARE_API_TOKEN} chars)"

# Build domain arguments for certbot
# SSL_DOMAIN becomes the primary domain (CN)
# SSL_DOMAIN_ALIASES adds additional SANs
DOMAIN_ARGS="-d ${SSL_DOMAIN}"

if [ -n "${SSL_DOMAIN_ALIASES}" ]; then
  echo "Primary domain (CN): ${SSL_DOMAIN}"
  echo "Additional SANs: ${SSL_DOMAIN_ALIASES}"

  # Split comma-separated aliases and add each as -d argument
  IFS=',' read -ra ALIASES <<< "${SSL_DOMAIN_ALIASES}"
  for alias in "${ALIASES[@]}"; do
    # Trim whitespace
    alias=$(echo "$alias" | xargs)
    if [ -n "$alias" ]; then
      DOMAIN_ARGS="${DOMAIN_ARGS} -d ${alias}"
    fi
  done
else
  echo "Domain: ${SSL_DOMAIN}"
fi

# Set staging flag if requested (recommended for testing)
STAGING_ARG=""
if [ "${LETSENCRYPT_STAGING}" = "true" ]; then
  STAGING_ARG="--staging"
  echo ""
  echo "⚠️  Using Let's Encrypt STAGING environment"
  echo "   Certificates will NOT be trusted by browsers"
  echo "   Set LETSENCRYPT_STAGING=false for production"
  echo ""
fi

# Create Cloudflare credentials file with restricted permissions
mkdir -p /etc/letsencrypt
cat > /etc/letsencrypt/cloudflare.ini << EOF
# Cloudflare API token for DNS-01 challenge
dns_cloudflare_api_token = ${CLOUDFLARE_API_TOKEN}
EOF
chmod 600 /etc/letsencrypt/cloudflare.ini

# Check if certificate already exists
CERT_PATH="/etc/letsencrypt/live/${SSL_DOMAIN}/fullchain.pem"
if [ ! -f "$CERT_PATH" ]; then
  echo ""
  echo "📜 Obtaining new certificate..."
  echo "   This may take 30-60 seconds for DNS propagation"
  echo ""
  echo "   Certbot command:"
  echo "   certbot certonly --dns-cloudflare ${STAGING_ARG} ${DOMAIN_ARGS}"
  echo ""

  # Run certbot and capture output
  if certbot certonly \
    --dns-cloudflare \
    --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini \
    --dns-cloudflare-propagation-seconds 60 \
    ${STAGING_ARG} \
    --email "${SSL_EMAIL}" \
    --agree-tos \
    --non-interactive \
    --keep-until-expiring \
    --expand \
    ${DOMAIN_ARGS} 2>&1; then
    echo ""
    echo "✅ Certificate obtained successfully!"
  else
    echo ""
    echo "❌ Failed to obtain certificate"
    echo ""
    echo "Common issues:"
    echo "  1. Invalid Cloudflare API token (check permissions: Zone > DNS > Edit)"
    echo "  2. Domain not managed by Cloudflare"
    echo "  3. API token doesn't have access to this zone"
    echo "  4. Rate limited (use staging mode first: LETSENCRYPT_STAGING=true)"
    echo ""
    echo "Check logs above for specific error message."
    exit 1
  fi
else
  echo ""
  echo "✅ Certificate already exists at ${CERT_PATH}"
fi

# Show certificate info
echo ""
echo "Certificate details:"
if openssl x509 -in "$CERT_PATH" -noout -subject -issuer -dates 2>/dev/null; then
  # Check if it's a staging cert
  ISSUER=$(openssl x509 -in "$CERT_PATH" -noout -issuer 2>/dev/null)
  if echo "$ISSUER" | grep -q "STAGING"; then
    echo ""
    echo "⚠️  This is a STAGING certificate (not trusted by browsers)"
  fi
else
  echo "  (Unable to read certificate)"
fi
echo ""

# Create a marker file for health checks
touch /etc/letsencrypt/.ready

# Function to handle certificate renewal
renew_certificates() {
  echo "[$(date)] Checking for certificate renewal..."
  certbot renew --quiet \
    --dns-cloudflare \
    --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini

  if [ $? -eq 0 ]; then
    echo "[$(date)] Renewal check complete"
  fi
}

# Start renewal daemon
echo "Starting certificate renewal daemon..."
echo "Certificates will be checked for renewal every 12 hours"
echo ""

while true; do
  # Sleep for 12 hours
  sleep 12h

  # Attempt renewal
  renew_certificates
done
