# Reverse Proxy Integration Guide

This guide explains how to deploy Sim-Flow behind various reverse proxies. The application is designed to work seamlessly with any reverse proxy that can forward HTTP traffic.

## Architecture Overview

```text
[Internet] → [Your Reverse Proxy] → [Sim-Flow :8080]
                                          ↓
                                    [Frontend Nginx]
                                          ↓
                                    [Backend API :3001]
                                          ↓
                                    [PostgreSQL]
```

**Key Points:**

- Sim-Flow exposes a single port: **8080**
- The frontend container handles both static files and API proxying
- Your reverse proxy only needs to forward traffic to port 8080
- SSL/TLS termination happens at your reverse proxy

## Quick Start

Start Sim-Flow:

```bash
make prod
```

1. Configure your reverse proxy to forward traffic to `http://localhost:8080` (or `http://sim-flow-frontend:8080` if on the same Docker network).

2. Set the `CORS_ORIGIN` environment variable to your public URL:

```bash
# In .env file
CORS_ORIGIN=https://simflow.yourdomain.com
```

## Environment Variables for Reverse Proxy

| Variable | Description | Example |
|----------|-------------|---------|
| `CORS_ORIGIN` | Your public URL (required for cookies to work) | `https://simflow.example.com` |

## Reverse Proxy Examples

### Cloudflare Tunnel (cloudflared)

Cloudflare Tunnels provide a secure way to expose your application without opening ports on your firewall.

**1. Install cloudflared:**

```bash
# macOS
brew install cloudflared

# Linux
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb
```

**2. Authenticate:**

```bash
cloudflared tunnel login
```

**3. Create a tunnel:**

```bash
cloudflared tunnel create simflow
```

**4. Configure the tunnel (`~/.cloudflared/config.yml`):**

```yaml
tunnel: <YOUR_TUNNEL_ID>
credentials-file: /home/user/.cloudflared/<YOUR_TUNNEL_ID>.json

ingress:
  - hostname: simflow.yourdomain.com
    service: http://localhost:8080
  - service: http_status:404
```

**5. Route DNS:**

```bash
cloudflared tunnel route dns simflow simflow.yourdomain.com
```

**6. Run the tunnel:**

```bash
cloudflared tunnel run simflow
```

**7. Update Sim-Flow configuration:**

```bash
# .env
CORS_ORIGIN=https://simflow.yourdomain.com
```

---

### Nginx Proxy Manager (NPM)

Nginx Proxy Manager provides a web UI for managing reverse proxies.

**1. Add Proxy Host in NPM:**

- Domain Names: `simflow.yourdomain.com`
- Scheme: `http`
- Forward Hostname/IP: `sim-flow-frontend` (if on same Docker network) or your server IP
- Forward Port: `8080`

**2. SSL Tab:**

- Request a new SSL certificate (Let's Encrypt)
- Force SSL: Yes
- HTTP/2 Support: Yes

**3. Advanced Tab (optional):**

```nginx
# Custom Nginx configuration (usually not needed)
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

**4. Docker Network (if using Docker):**

If NPM is running in Docker, connect it to the Sim-Flow network:

```yaml
# In your NPM docker-compose.yaml, add:
networks:
  default:
    external: true
    name: simflow-network
```

Or connect the existing container:

```bash
docker network connect simflow-network nginx-proxy-manager
```

---

### Traefik

Traefik is a modern reverse proxy with automatic SSL and Docker integration.

#### Option 1: Labels (recommended if Traefik manages Docker)

Add these labels to the frontend service in `docker-compose.yaml`:

```yaml
frontend:
  labels:
    - "traefik.enable=true"
    - "traefik.http.routers.simflow.rule=Host(`simflow.yourdomain.com`)"
    - "traefik.http.routers.simflow.entrypoints=websecure"
    - "traefik.http.routers.simflow.tls.certresolver=letsencrypt"
    - "traefik.http.services.simflow.loadbalancer.server.port=80"
```

### Option 2: File-based configuration

Create `traefik/dynamic/simflow.yaml`:

```yaml
http:
  routers:
    simflow:
      rule: "Host(`simflow.yourdomain.com`)"
      service: simflow
      entryPoints:
        - websecure
      tls:
        certResolver: letsencrypt

  services:
    simflow:
      loadBalancer:
        servers:
          - url: "http://sim-flow-frontend:80"
```

---

### Caddy

Caddy automatically handles SSL certificates.

**Caddyfile:**

```caddyfile
simflow.yourdomain.com {
    reverse_proxy localhost:8080
}
```

Or with Docker:

```caddyfile
simflow.yourdomain.com {
    reverse_proxy sim-flow-frontend:80
}
```

**Run Caddy:**

```bash
caddy run --config Caddyfile
```

---

### Standard Nginx (Manual)

If you're running Nginx directly on the host.

**`/etc/nginx/sites-available/simflow`:**

```nginx
server {
    listen 80;
    server_name simflow.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name simflow.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/simflow.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/simflow.yourdomain.com/privkey.pem;

    # Modern SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Enable and restart:**

```bash
sudo ln -s /etc/nginx/sites-available/simflow /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## Troubleshooting

### Cookies not working / Login issues

**Symptom:** Login succeeds but immediately redirects back to login.

**Cause:** CORS_ORIGIN doesn't match your public URL.

**Fix:**

```bash
# Set CORS_ORIGIN to your exact public URL
CORS_ORIGIN=https://simflow.yourdomain.com

# Restart containers
make prod-down && make prod
```

### 502 Bad Gateway

**Symptom:** Reverse proxy returns 502 error.

**Cause:** Sim-Flow containers aren't running or healthy.

**Fix:**

```bash
# Check container status
make status

# Check logs
make prod-logs

# Restart if needed
make prod-down && make prod
```

### Mixed Content Warnings

**Symptom:** Browser console shows mixed content errors.

**Cause:** SSL termination issues or missing X-Forwarded-Proto header.

**Fix:** Ensure your reverse proxy sends the `X-Forwarded-Proto: https` header.

### WebSocket Connection Issues

**Symptom:** Real-time updates not working.

**Cause:** Reverse proxy not forwarding WebSocket connections.

**Fix:** Add WebSocket support to your reverse proxy configuration:

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection 'upgrade';
```

### Rate Limiting Conflicts

**Symptom:** Getting rate limited unexpectedly.

**Cause:** Rate limiter seeing proxy IP instead of real client IP.

**Fix:** Ensure `X-Real-IP` or `X-Forwarded-For` headers are passed. The backend is configured to trust the first proxy.

---

## Security Checklist

- [ ] SSL/TLS enabled on reverse proxy
- [ ] HTTP → HTTPS redirect configured
- [ ] `CORS_ORIGIN` set to your public URL
- [ ] Reverse proxy forwards `X-Real-IP` and `X-Forwarded-Proto` headers
- [ ] Firewall blocks direct access to port 8080 (only proxy can reach it)
- [ ] Strong `DB_PASSWORD` set in `.env`
- [ ] Default admin password changed

---

## Health Check Endpoints

Your reverse proxy can use these endpoints for health monitoring:

| Endpoint | Purpose | Expected Response |
|----------|---------|-------------------|
| `http://localhost:8080/health` | Frontend liveness | `200 OK` with text "healthy" |

For internal monitoring (within Docker network):

| Endpoint | Purpose | Expected Response |
|----------|---------|-------------------|
| `http://sim-flow-api:3001/health` | Backend liveness | `200 OK` with JSON |
| `http://sim-flow-api:3001/ready` | Backend readiness (DB check) | `200 OK` with JSON |

**Note:** The frontend proxies `/api/*` requests to the backend automatically. Backend health endpoints are not exposed via `/api/` prefix - they're at the root level for internal Docker health checks.
