# Sim-Flow Test Credentials

This document contains the default credentials for testing the Sim-Flow application.

## Default Test Accounts

### Admin Account

- **Email:** `qadmin@simflow.local`
- **Password:** `admin123`
- **Permissions:** Full unrestricted access to all features

### Manager Account

- **Email:** `bob@simflow.local`
- **Password:** `manager123`
- **Permissions:**
  - Approve/deny requests
  - Assign engineers
  - Manage projects
  - Review title change requests
  - Review discussion requests

### Engineer Account

- **Email:** `charlie@simflow.local`
- **Password:** `engineer123`
- **Permissions:**
  - View assigned requests
  - Add time entries
  - Request discussions
  - Update work progress

### End-User Account

- **Email:** `alice@simflow.local`
- **Password:** `user123`
- **Permissions:**
  - Create new requests
  - View own requests
  - Request title changes
  - Add comments

## Security Notes

- These are **test credentials only** and should be changed in production
- All passwords are hashed using bcrypt with 10 salt rounds
- Session-based authentication with HTTP-only cookies
- Sessions are stored in the database and automatically cleaned up

## Changing Passwords

To change a password, you'll need to:

1. Generate a new bcrypt hash
2. Update the `password_hash` column in the `users` table

Example using Node.js:

```javascript
const bcrypt = require('bcrypt');
const hash = bcrypt.hashSync('new-password', 10);
console.log(hash);
```
