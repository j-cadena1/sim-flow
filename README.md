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

## Quick Start

See [QUICKSTART.md](QUICKSTART.md) for deployment instructions.

## Run Locally (Development)

**Prerequisites:** Node.js 20+

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the app:
   ```bash
   npm run dev
   ```

## Production Deployment

### Using Docker Compose (Recommended)

1. **Clone the repository**:
   ```bash
   git clone https://github.com/j-cadena1/sim-flow.git
   cd sim-flow
   ```

2. **Create environment file**:
   ```bash
   cp .env.example .env
   ```

3. **Configure environment variables** (see Security Considerations below)

4. **Start the application**:
   ```bash
   docker compose up -d
   ```

5. **Access the application**:
   - Frontend: `http://your-server:8080`
   - Backend API: `http://your-server:3001`

For detailed deployment instructions, see [SIMPLE-DEPLOYMENT.md](SIMPLE-DEPLOYMENT.md).

## 🔒 Security Considerations

**IMPORTANT**: Before deploying to production, you MUST configure the following:

### 1. Database Password

The default database password in `docker-compose.yaml` is for development only:

```bash
# In your .env file, set a strong password:
DB_PASSWORD=YourStrongPasswordHere123!@#
```

Generate a secure password:

```bash
openssl rand -base64 24
```

### 2. JWT Secret

The JWT secret is critical for authentication security:

```bash
# In your .env file:
JWT_SECRET=$(openssl rand -base64 32)
```

### 3. Change Default Admin Password

On first deployment, immediately change the default admin password:

- **Default credentials**: `admin@simflow.local` / `SimFlow2024!Admin`
- Login and navigate to Settings → Users to change the password

### 4. CORS Configuration

Restrict CORS to your production domain:

```bash
# In your .env file:
CORS_ORIGIN=https://your-production-domain.com
```

### 5. HTTPS/TLS

- Use a reverse proxy (nginx, Traefik, Caddy) with TLS certificates
- Never expose the application over HTTP in production
- Consider using Let's Encrypt for free SSL certificates

### 6. Firewall Configuration

- Restrict database port (5432) to localhost only
- Only expose ports 80/443 to the internet
- Use UFW, firewalld, or your cloud provider's security groups

### 7. SSO Configuration (Optional)

If using Microsoft Entra ID SSO:

- Store SSO secrets securely (consider Azure Key Vault)
- Use environment variables, never commit secrets to Git
- Rotate secrets regularly

### 8. Regular Updates

- Keep Docker images updated
- Monitor security advisories for Node.js and PostgreSQL
- Review audit logs regularly for suspicious activity

## Architecture

- **Frontend**: React + TypeScript + Vite + TailwindCSS
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL 16
- **Authentication**: JWT + Microsoft Entra ID PKCE flow
- **Deployment**: Docker + Docker Compose

## Default Users

The system comes with pre-configured users for testing:

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@simflow.local` | `SimFlow2024!Admin` |
| Manager | `manager@simflow.local` | `SimFlow2024!Manager` |
| Engineer | `engineer@simflow.local` | `SimFlow2024!Engineer` |
| End-User | `user@simflow.local` | `SimFlow2024!User` |

**⚠️ Change these passwords immediately in production!**

## Documentation

- [Quick Start Guide](QUICKSTART.md) - Fast deployment walkthrough
- [Simple Deployment](SIMPLE-DEPLOYMENT.md) - Detailed deployment with troubleshooting
- [Backend Status](BACKEND-STATUS.md) - API documentation and architecture
- [Compatibility Check](COMPATIBILITY-CHECK.md) - System requirements verification
- [Project Structure](STRUCTURE.md) - Codebase organization

## License

MIT License - See LICENSE file for details

## Contributing

Contributions welcome! Please open an issue or submit a pull request.

## Support

For issues or questions, please open an issue on GitHub.
