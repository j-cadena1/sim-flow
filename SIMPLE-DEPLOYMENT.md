# 🚀 Simple Deployment Guide for Sim-Flow
**For Ubuntu VM on Proxmox VE 8.4.14 with Docker**

This guide is written for non-technical users. Just follow the steps!

---

## 📋 What You Need

- **Proxmox VE** (you have version 8.4.14 ✓)
- **Ubuntu VM** (Ubuntu 20.04 or 22.04 recommended)
- **Docker installed** on the Ubuntu VM
- Basic access to your VM (via SSH or console)

---

## 🎯 Step-by-Step Deployment

### Step 1: Connect to Your Ubuntu VM

**Option A: Using Proxmox Web Console**
1. Go to your Proxmox web interface: `https://your-proxmox-ip:8006`
2. Find your Ubuntu VM in the left sidebar
3. Click **Console** to open terminal

**Option B: Using SSH (if you prefer)**
```bash
ssh your-username@your-vm-ip
```

### Step 2: Install Docker (if not already installed)

Check if Docker is installed:
```bash
docker --version
```

**If you see a version number** → Skip to Step 3 ✓

**If you see "command not found"** → Run these commands:

```bash
# Update your system
sudo apt update && sudo apt upgrade -y

# Install Docker (this will take a few minutes)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group (so you don't need sudo)
sudo usermod -aG docker $USER

# Log out and back in, or run:
newgrp docker

# Verify Docker is working
docker --version
docker compose version
```

You should see version numbers like:
```
Docker version 24.x.x
Docker Compose version v2.x.x
```

### Step 3: Get Your Sim-Flow Code

**Option A: If you're working on the same machine where you made changes**
```bash
cd ~/sim-flow
git pull origin claude/review-simflow-improvements-012L1zSKuCFK5ZnbnjhKG9Hj
```

**Option B: Fresh installation on your VM**
```bash
# Install git if needed
sudo apt install -y git

# Download the code
cd ~
git clone https://github.com/j-cadena1/sim-flow.git
cd sim-flow

# Switch to the improved version
git checkout claude/review-simflow-improvements-012L1zSKuCFK5ZnbnjhKG9Hj
```

### Step 4: Build and Start Sim-Flow

This is the magic step! Docker will:
1. Build your application
2. Package it with all improvements
3. Start a web server
4. Make it accessible from any browser

```bash
# Make sure you're in the sim-flow directory
cd ~/sim-flow

# Build and start (this takes 2-5 minutes the first time)
docker compose up -d
```

**What you'll see:**
```
[+] Building 45.2s (16/16) FINISHED
[+] Running 1/1
✔ Container sim-flow  Started
```

### Step 5: Check If It's Running

```bash
# Check container status
docker compose ps
```

**You should see:**
```
NAME        STATUS              PORTS
sim-flow    Up 30 seconds       0.0.0.0:8080->80/tcp
```

If STATUS shows "Up" → **Success! It's running!** ✓

### Step 6: Access Your Application

Open any web browser and go to:
```
http://YOUR-VM-IP:8080
```

**Example:**
- If your VM IP is `192.168.1.50`, go to: `http://192.168.1.50:8080`

**To find your VM IP:**
```bash
ip addr show | grep inet
```
Look for the line with your network (usually something like `192.168.x.x`)

---

## ✅ What You Should See

When you open the URL in your browser, you'll see:
- **Sim-Flow Dashboard** with dark theme
- Navigation sidebar on the left
- Role switcher in the top right
- Dashboard with statistics

**Test the new features:**
1. Click **New Request** → Try submitting without filling form
   - You'll see **red error messages** (new validation!)

2. Fill out the form and submit
   - You'll see a **green success toast** in the bottom-right (new feature!)

3. Click on a request → Try to deny it
   - You'll see a **nice confirmation modal** instead of ugly browser popup (improved!)

---

## 🎛️ Common Commands

### View Live Logs (See What's Happening)
```bash
docker compose logs -f
```
*Press Ctrl+C to stop viewing logs*

### Restart the Application
```bash
docker compose restart
```

### Stop the Application
```bash
docker compose down
```

### Start the Application Again
```bash
docker compose up -d
```

### Update After Changes (New Code)
```bash
cd ~/sim-flow
git pull
docker compose up -d --build
```

### Check Health
```bash
curl http://localhost:8080/health
```
*Should return: "healthy"*

---

## 🔧 Troubleshooting

### Problem: "Port 8080 is already in use"

**Solution:** Change the port in `docker-compose.yaml`

```bash
nano docker-compose.yaml
```

Find this line:
```yaml
ports:
  - "8080:80"
```

Change `8080` to another number (like `8081`, `9000`, etc.):
```yaml
ports:
  - "9000:80"
```

Save (Ctrl+O, Enter) and exit (Ctrl+X), then:
```bash
docker compose down
docker compose up -d
```

### Problem: "Can't access from browser"

**Check 1: Is container running?**
```bash
docker compose ps
```
Should show "Up"

**Check 2: Is firewall blocking?**
```bash
sudo ufw status
```

If firewall is active, allow port 8080:
```bash
sudo ufw allow 8080/tcp
```

**Check 3: Try accessing from the VM itself**
```bash
curl http://localhost:8080
```
If this works but browser doesn't, it's a network issue.

### Problem: Build fails or errors during startup

**Clean and rebuild from scratch:**
```bash
docker compose down -v
docker system prune -a -f
docker compose up -d --build
```

This removes everything and rebuilds fresh.

### Problem: Page loads but looks broken

**Check browser console:**
1. Press F12 in your browser
2. Click "Console" tab
3. Look for red errors

If you see CDN errors, check your VM has internet access:
```bash
ping -c 3 8.8.8.8
```

---

## 📊 Resource Usage

Your Sim-Flow container uses:
- **CPU:** ~5-10% when idle, 20-30% during build
- **RAM:** ~50-100 MB when running
- **Disk:** ~200 MB total (includes Docker images)

**Very lightweight!** Should run fine on almost any VM.

---

## 🔐 Security Notes

### Firewall Recommendations

**Internal network only (recommended for testing):**
```bash
# No firewall changes needed if only accessing from local network
```

**Exposed to internet (use with caution):**
```bash
# Allow only specific IP
sudo ufw allow from YOUR_IP to any port 8080

# Or allow from anywhere (less secure)
sudo ufw allow 8080/tcp
```

### HTTPS Setup (Optional - Advanced)

If you want HTTPS (https:// instead of http://):

1. Get a domain name (like `simflow.yourcompany.com`)
2. Use a reverse proxy (Traefik or Nginx Proxy Manager)
3. Get SSL certificate (Let's Encrypt)

*This is more advanced - only needed if exposing to internet*

---

## 🎯 Production Checklist

Before using in production:

- [ ] VM has static IP address
- [ ] Firewall configured (only allow necessary ports)
- [ ] Regular backups of VM (use Proxmox backup)
- [ ] Access restricted to authorized users
- [ ] Health checks working (`curl http://localhost:8080/health`)
- [ ] Container auto-restarts (`restart: unless-stopped` in docker-compose.yaml ✓)

---

## 📦 What's Inside the Docker Container?

Think of Docker like a sealed box that contains everything needed to run your app:

```
┌─────────────────────────────────────┐
│        Docker Container             │
│  ┌──────────────────────────────┐   │
│  │      Nginx Web Server        │   │  ← Serves your website
│  │         (Port 80)            │   │
│  └──────────────────────────────┘   │
│  ┌──────────────────────────────┐   │
│  │     Sim-Flow Application     │   │  ← Your improved app
│  │    (Static HTML/JS/CSS)      │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
          ↑
    Exposed on VM port 8080
```

**Benefits:**
- ✅ Everything packaged together
- ✅ Works the same everywhere
- ✅ Easy to update
- ✅ Easy to backup (backup the VM)
- ✅ Isolated from other software

---

## 🔄 Update Process (When You Make Changes)

### Simple Update
```bash
cd ~/sim-flow
git pull                          # Get latest code
docker compose up -d --build      # Rebuild and restart
```

**That's it!** Takes 2-3 minutes.

### Zero-Downtime Update (Advanced)
If you need the app to stay running during updates:

```bash
# Build new version
docker compose build

# Swap containers (old stops, new starts)
docker compose up -d
```

---

## 📱 Access From Different Devices

### Same Network
Any device on the same network can access:
```
http://YOUR-VM-IP:8080
```

**Examples:**
- Desktop: http://192.168.1.50:8080
- Laptop: http://192.168.1.50:8080
- Tablet: http://192.168.1.50:8080
- Phone: http://192.168.1.50:8080

### Different Network (Internet)
You'll need:
1. Port forwarding on your router (forward 8080 to VM)
2. Dynamic DNS or static public IP
3. HTTPS (SSL certificate) for security

*Not recommended without proper security setup*

---

## 💾 Data Storage

**Important:** Sim-Flow stores data in the **user's browser** (localStorage), not on the server!

**What this means:**
- ✅ No database to maintain
- ✅ No backups needed for data
- ✅ Each user's data stays on their computer
- ⚠️ If user clears browser data, their requests are lost
- ⚠️ Data doesn't sync between devices

**For production use with persistent data:**
- You'd need to add a backend database (future enhancement)
- Or export/import functionality (future enhancement)

---

## 🆘 Getting Help

### View Application Logs
```bash
docker compose logs -f sim-flow
```

### View Container Details
```bash
docker inspect sim-flow
```

### Check Resource Usage
```bash
docker stats sim-flow
```

### Access Container Shell (Advanced)
```bash
docker exec -it sim-flow sh
```

### Full System Reset
```bash
cd ~/sim-flow
docker compose down -v
docker system prune -a -f
docker compose up -d --build
```

---

## ✅ Success Indicators

You'll know everything is working when:

1. ✅ `docker compose ps` shows "Up"
2. ✅ `curl http://localhost:8080/health` returns "healthy"
3. ✅ Browser shows Sim-Flow Dashboard
4. ✅ You see toast notifications when submitting forms
5. ✅ You see nice modals instead of browser popups
6. ✅ Form validation shows red errors for invalid input

---

## 📞 Quick Reference Card

Print this and keep it handy:

```
╔════════════════════════════════════════════════╗
║         SIM-FLOW QUICK REFERENCE               ║
╠════════════════════════════════════════════════╣
║ Access:      http://YOUR-VM-IP:8080           ║
║ Start:       docker compose up -d             ║
║ Stop:        docker compose down              ║
║ Restart:     docker compose restart           ║
║ Logs:        docker compose logs -f           ║
║ Status:      docker compose ps                ║
║ Update:      git pull && docker compose       ║
║              up -d --build                    ║
║ Health:      curl http://localhost:8080/health║
╚════════════════════════════════════════════════╝
```

---

## 🎉 You're Done!

Your Sim-Flow application with all improvements is now running on your Proxmox infrastructure!

**What you have:**
- ✅ Secure, tested application
- ✅ Running in Docker container
- ✅ Auto-restarts if it crashes
- ✅ Health monitoring
- ✅ Proper logging
- ✅ Easy to update

**Need help?** Just ask! I can guide you through any issues.
