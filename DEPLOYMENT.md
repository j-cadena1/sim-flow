# Sim-Flow Deployment Guide

## Proxmox VM Deployment with Docker

This guide walks you through deploying Sim-Flow on a Proxmox VE host using a VM with Docker.

---

## Prerequisites

- Proxmox VE host
- Ubuntu 22.04 LTS or Debian 12 ISO
- 2 vCPU, 2GB RAM, 20GB disk minimum (recommended)
- SSH access to Proxmox host

---

## Part 1: Create VM on Proxmox

### 1.1 Create VM via Proxmox Web UI

1. Navigate to Proxmox web interface: `https://your-proxmox-ip:8006`
2. Click **Create VM**
3. Configure VM settings:
   - **General**: VM ID (e.g., 100), Name: `sim-flow`
   - **OS**: Select Ubuntu Server 22.04 LTS ISO
   - **System**: Default (BIOS: OVMF/UEFI optional)
   - **Disks**: 20GB (or more), Storage: local-lvm
   - **CPU**: 2 cores
   - **Memory**: 2048 MB (2GB)
   - **Network**: Default bridge (vmbr0)
4. Click **Finish** (don't start yet)

### 1.2 Install Ubuntu

1. Start the VM and open Console
2. Install Ubuntu Server:
   - Language: English
   - Network: Configure with static IP or DHCP
   - Storage: Use entire disk
   - Profile: Create user (e.g., `admin`)
   - SSH: Install OpenSSH server ✓
   - Featured Server Snaps: Skip
3. Reboot after installation
4. SSH into your VM: `ssh admin@<vm-ip>`

---

## Part 2: Install Docker

### 2.1 Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### 2.2 Install Docker

```bash
# Install prerequisites
sudo apt install -y ca-certificates curl gnupg

# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add your user to docker group
sudo usermod -aG docker $USER

# Apply group changes
newgrp docker
```

### 2.3 Verify Docker Installation

```bash
docker --version
docker compose version
```

---

## Part 3: Deploy Sim-Flow

### 3.1 Clone Repository

```bash
# Install git if not already installed
sudo apt install -y git

# Clone the repository
cd ~
git clone https://github.com/j-cadena1/sim-flow.git
cd sim-flow
```

### 3.2 Build and Run with Docker Compose

```bash
# Build and start the container
docker compose up -d

# Check container status
docker compose ps

# View logs
docker compose logs -f
```

### 3.3 Access the Application

Open your browser and navigate to:
```
http://<vm-ip>:8080
```

You should see the Sim-Flow Dashboard!

---

## Part 4: Configuration & Management

### 4.1 Change Port (Optional)

Edit `docker-compose.yaml`:
```yaml
ports:
  - "80:80"  # Change 8080 to 80 for standard HTTP
```

Then restart:
```bash
docker compose down
docker compose up -d
```

### 4.2 Docker Commands

```bash
# View running containers
docker compose ps

# View logs
docker compose logs -f sim-flow

# Restart container
docker compose restart

# Stop container
docker compose down

# Rebuild after code changes
docker compose up -d --build

# Remove everything (including volumes)
docker compose down -v
```

### 4.3 Updates & Maintenance

```bash
# Pull latest code
git pull origin master

# Rebuild and restart
docker compose up -d --build

# View container health
docker inspect sim-flow | grep -A 5 Health
```

---

## Part 5: Production Enhancements (Optional)

### 5.1 Reverse Proxy with Traefik

If you want HTTPS and a custom domain:

```bash
# Install Traefik (in a separate compose file)
# See: https://doc.traefik.io/traefik/getting-started/quick-start/
```

### 5.2 Automatic Backups

Since Sim-Flow uses localStorage (client-side), no backend data to backup. However, you can backup the VM:

```bash
# On Proxmox host
vzdump <vmid> --mode snapshot --storage local
```

### 5.3 Monitoring

```bash
# Check resource usage
docker stats sim-flow

# Container health check
curl http://localhost:8080/health
```

### 5.4 Firewall

```bash
# Allow port 8080 through UFW (Ubuntu firewall)
sudo ufw allow 8080/tcp
sudo ufw enable
```

---

## Troubleshooting

### Container won't start

```bash
# Check logs
docker compose logs

# Check if port is already in use
sudo netstat -tulpn | grep 8080

# Rebuild from scratch
docker compose down -v
docker compose build --no-cache
docker compose up -d
```

### Can't access from browser

- Verify container is running: `docker compose ps`
- Check firewall: `sudo ufw status`
- Verify VM network connectivity: `ping <vm-ip>`
- Check nginx logs: `docker compose logs sim-flow`

### Build fails

```bash
# Check Docker disk space
docker system df

# Clean up unused images
docker system prune -a
```

---

## Architecture

```
┌─────────────────────────────────────────┐
│         Proxmox VE Host                 │
│  ┌───────────────────────────────────┐  │
│  │      Ubuntu VM (sim-flow)         │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │  Docker Container           │  │  │
│  │  │  ┌────────────┐             │  │  │
│  │  │  │   Nginx    │             │  │  │
│  │  │  │  (Port 80) │             │  │  │
│  │  │  │     ↓      │             │  │  │
│  │  │  │  React SPA │             │  │  │
│  │  │  │ (Static)   │             │  │  │
│  │  │  └────────────┘             │  │  │
│  │  └─────────────────────────────┘  │  │
│  │         Port 8080:80               │  │
│  └───────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
              ↓
    Browser: http://<vm-ip>:8080
```

---

## Quick Reference

| Command | Description |
|---------|-------------|
| `docker compose up -d` | Start containers in background |
| `docker compose down` | Stop and remove containers |
| `docker compose logs -f` | Follow container logs |
| `docker compose ps` | List running containers |
| `docker compose restart` | Restart containers |
| `docker compose up -d --build` | Rebuild and restart |

---

## Support

- Repository: https://github.com/j-cadena1/sim-flow
- Issues: https://github.com/j-cadena1/sim-flow/issues
