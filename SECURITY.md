# Security Policy

## Supported Versions

We release security patches for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via:

1. **GitHub Security Advisories** (preferred): Navigate to the Security tab and click "Report a vulnerability"
2. **Email**: Open a private issue and we'll provide a secure contact method

### What to Include

Please include the following information:

- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact
- Suggested fix (if any)
- Your contact information

### What to Expect

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 7 days
- **Status Updates**: Every 7 days until resolved
- **Fix Timeline**: Critical issues within 30 days, others within 90 days

### Security Best Practices

When deploying Sim RQ:

- Change default admin password immediately
- Use strong database passwords
- Set `SSO_ENCRYPTION_KEY` for SSO deployments
- Configure `CORS_ORIGIN` to your specific domain
- Use HTTPS with a reverse proxy in production
- Restrict database port (5432) to localhost only
- Keep Docker images updated
- Enable rate limiting (enabled by default)
- Review audit logs regularly

### Known Security Features

- Session-based authentication with HTTP-only cookies
- Rate limiting on authentication endpoints
- Helmet.js security headers
- Input sanitization with DOMPurify
- Bcrypt password hashing
- Database connection pooling with prepared statements
- CORS protection
- Audit logging for sensitive operations

## Disclosure Policy

When we receive a security bug report, we will:

1. Confirm the issue and determine affected versions
2. Audit code to find similar issues
3. Prepare fixes for all supported versions
4. Release security patches as soon as possible

We appreciate your help in keeping Sim RQ secure!
