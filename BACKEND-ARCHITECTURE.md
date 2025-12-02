# 🏗️ Backend Architecture with PostgreSQL

## Overview

Transform Sim-Flow from client-side only to full-stack application with:
- **PostgreSQL Database** - Persistent data storage
- **Node.js API Server** - REST API backend
- **React Frontend** - Enhanced to use API
- **Docker Compose** - All services containerized

---

## Architecture

### Current (Client-Side Only)
```
┌─────────────────────────────────────┐
│          Browser                    │
│  ┌──────────────────────────────┐   │
│  │      React App               │   │
│  │         ↓                    │   │
│  │    localStorage              │   │
│  │  (data in browser only)      │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

### New (Full-Stack)
```
┌─────────────────────────────────────────────────┐
│              Docker Compose                     │
│  ┌──────────────────────────────────────────┐   │
│  │     Nginx (Frontend)                     │   │
│  │     Port 80 → 8080                       │   │
│  │     Serves React App                     │   │
│  └──────────────────────────────────────────┘   │
│                    ↓ API calls                  │
│  ┌──────────────────────────────────────────┐   │
│  │     Node.js API Server                   │   │
│  │     Port 3001                            │   │
│  │     Express + TypeScript                 │   │
│  └──────────────────────────────────────────┘   │
│                    ↓ SQL queries                │
│  ┌──────────────────────────────────────────┐   │
│  │     PostgreSQL Database                  │   │
│  │     Port 5432                            │   │
│  │     Data Volume (persistent)             │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

---

## Database Schema

### Tables

#### 1. **users**
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL,
    avatar_url VARCHAR(512),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 2. **requests**
```sql
CREATE TABLE requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    vendor VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    priority VARCHAR(20) NOT NULL,
    created_by UUID REFERENCES users(id),
    created_by_name VARCHAR(255) NOT NULL,
    assigned_to UUID REFERENCES users(id),
    assigned_to_name VARCHAR(255),
    estimated_hours INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 3. **comments**
```sql
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID REFERENCES requests(id) ON DELETE CASCADE,
    author_id UUID REFERENCES users(id),
    author_name VARCHAR(255) NOT NULL,
    author_role VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 4. **activity_log** (Optional - for audit trail)
```sql
CREATE TABLE activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID REFERENCES requests(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Indexes
```sql
CREATE INDEX idx_requests_status ON requests(status);
CREATE INDEX idx_requests_created_by ON requests(created_by);
CREATE INDEX idx_requests_assigned_to ON requests(assigned_to);
CREATE INDEX idx_comments_request_id ON comments(request_id);
CREATE INDEX idx_activity_log_request_id ON activity_log(request_id);
```

---

## API Endpoints

### Base URL: `http://localhost:8080/api`

### Authentication (Phase 1 - Simple)
For now, use session-based auth with the same mock users.

### Requests API

#### **GET /api/requests**
Get all requests (filtered by role)
```typescript
Response: {
  requests: Request[]
}
```

#### **GET /api/requests/:id**
Get single request with comments
```typescript
Response: {
  request: Request,
  comments: Comment[]
}
```

#### **POST /api/requests**
Create new request
```typescript
Request: {
  title: string,
  description: string,
  vendor: string,
  priority: 'Low' | 'Medium' | 'High'
}
Response: {
  request: Request
}
```

#### **PATCH /api/requests/:id/status**
Update request status
```typescript
Request: {
  status: RequestStatus
}
Response: {
  request: Request
}
```

#### **PATCH /api/requests/:id/assign**
Assign engineer
```typescript
Request: {
  engineerId: string,
  estimatedHours: number
}
Response: {
  request: Request
}
```

### Comments API

#### **POST /api/requests/:id/comments**
Add comment
```typescript
Request: {
  content: string
}
Response: {
  comment: Comment
}
```

### Users API

#### **GET /api/users**
Get all users

#### **GET /api/users?role=ENGINEER**
Get users by role

---

## Technology Stack

### Backend
- **Node.js** 20 LTS
- **TypeScript** - Type safety
- **Express** - Web framework
- **PostgreSQL** - Database
- **node-postgres (pg)** - Database driver
- **Zod** - Runtime validation
- **Winston** - Logging

### Frontend Changes
- Keep existing React/TypeScript
- Replace Context API with API calls
- Add **TanStack Query (React Query)** for data fetching
- Add loading states and error handling

---

## File Structure

```
sim-flow/
├── frontend/               # React app (existing code)
│   ├── components/
│   ├── context/
│   ├── utils/
│   └── ...
│
├── backend/               # New backend API
│   ├── src/
│   │   ├── routes/       # API routes
│   │   ├── controllers/  # Business logic
│   │   ├── models/       # Database models
│   │   ├── middleware/   # Auth, validation
│   │   ├── db/           # Database connection
│   │   └── server.ts     # Entry point
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
│
├── database/
│   ├── init.sql          # Schema + seed data
│   └── migrations/       # Future migrations
│
├── docker-compose.yaml    # Updated with 3 services
└── nginx.conf           # Updated to proxy /api
```

---

## Docker Compose Configuration

```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:16-alpine
    container_name: sim-flow-db
    environment:
      POSTGRES_DB: simflow
      POSTGRES_USER: simflow_user
      POSTGRES_PASSWORD: ${DB_PASSWORD:-secure_password_change_me}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U simflow_user -d simflow"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  # Backend API
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: sim-flow-api
    environment:
      NODE_ENV: production
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: simflow
      DB_USER: simflow_user
      DB_PASSWORD: ${DB_PASSWORD:-secure_password_change_me}
      PORT: 3001
    ports:
      - "3001:3001"
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3001/health"]
      interval: 30s
      timeout: 3s
      retries: 3
    restart: unless-stopped

  # Frontend (Nginx)
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: sim-flow-frontend
    ports:
      - "8080:80"
    depends_on:
      - backend
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost/health"]
      interval: 30s
      timeout: 3s
      retries: 3
    restart: unless-stopped

volumes:
  postgres_data:
    driver: local
```

---

## Migration Strategy

### Phase 1: Add Backend (Parallel to Current)
1. Create backend API
2. Create PostgreSQL database
3. Keep frontend working with localStorage
4. Test API separately

### Phase 2: Switch Frontend to API
1. Add React Query
2. Replace Context API calls with API calls
3. Add loading states
4. Add error handling
5. Remove localStorage code

### Phase 3: Deploy & Test
1. Deploy all containers
2. Seed database with test data
3. Test all workflows
4. Monitor for issues

### Phase 4: Data Migration (if needed)
If users already have data in localStorage:
1. Create export tool (frontend)
2. Users export their data
3. Import tool on backend
4. One-time migration script

---

## Security Enhancements

### API Security
- ✅ Input validation (Zod schemas)
- ✅ SQL injection prevention (parameterized queries)
- ✅ Rate limiting (express-rate-limit)
- ✅ CORS configuration
- ✅ Helmet.js security headers
- ✅ Request sanitization

### Database Security
- ✅ Separate database user (not postgres superuser)
- ✅ Password in environment variables
- ✅ No direct database access from outside
- ✅ Encrypted connections (SSL/TLS)

### Authentication (Future Phase)
- JWT tokens
- Password hashing (bcrypt)
- Session management
- Role-based access control (RBAC)

---

## Performance Considerations

### Database
- Connection pooling (pg Pool)
- Indexed queries
- Query optimization
- Regular VACUUM

### API
- Response compression (gzip)
- Request caching (Redis - optional)
- Pagination for large datasets
- Rate limiting

### Frontend
- API response caching (React Query)
- Optimistic updates
- Debounced searches
- Lazy loading

---

## Storage Requirements

### Database Size Estimates
```
100 users × 1 KB = 100 KB
10,000 requests × 2 KB = 20 MB
50,000 comments × 500 B = 25 MB
Activity logs × 1 KB = ~50 MB

Total: ~100 MB for moderate usage
```

**Your 200GB allocation:** Can handle millions of requests! 🎉

### Docker Volumes
```
PostgreSQL data: ~100 MB (grows with usage)
Backend image: ~150 MB
Frontend image: ~45 MB
Total: ~300 MB
```

**Plenty of space!**

---

## Backup Strategy

### Database Backups
```bash
# Daily backup script
docker exec sim-flow-db pg_dump -U simflow_user simflow > backup-$(date +%Y%m%d).sql

# Restore from backup
docker exec -i sim-flow-db psql -U simflow_user simflow < backup-20250101.sql
```

### Automated Backups
- Daily PostgreSQL dumps
- Keep 30 days of backups
- Weekly VM snapshots (Proxmox)
- Monthly full backups (off-site)

---

## Monitoring & Logging

### Application Logs
```bash
# Backend logs
docker compose logs -f backend

# Database logs
docker compose logs -f postgres

# All logs
docker compose logs -f
```

### Metrics to Monitor
- API response times
- Database query performance
- Error rates
- Active connections
- Disk usage

---

## Development Workflow

### Local Development
```bash
# Start database only
docker compose up postgres -d

# Run backend in dev mode
cd backend
npm run dev

# Run frontend in dev mode
cd frontend
npm run dev
```

### Testing
```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test

# Integration tests
npm run test:integration
```

---

## Advantages Over localStorage

| Feature | localStorage | PostgreSQL |
|---------|--------------|------------|
| Data persistence | Browser only | Server-side |
| Multi-device | ❌ No | ✅ Yes |
| Data sync | ❌ No | ✅ Real-time |
| Data loss risk | ⚠️ High | ✅ Low |
| Backup | ❌ Manual | ✅ Automated |
| Query capability | ❌ Limited | ✅ Full SQL |
| Concurrent users | ❌ Isolated | ✅ Shared |
| Analytics | ❌ No | ✅ Yes |
| Audit trail | ❌ No | ✅ Yes |
| Security | ⚠️ Client-side | ✅ Server-side |

---

## Timeline

### Implementation Phases

**Week 1: Backend Foundation**
- Set up backend project structure
- Create database schema
- Implement basic API endpoints
- Set up Docker configuration

**Week 2: API Development**
- Implement all CRUD endpoints
- Add validation and error handling
- Write API tests
- Set up logging

**Week 3: Frontend Integration**
- Add React Query
- Replace localStorage with API calls
- Add loading and error states
- Update components

**Week 4: Testing & Deployment**
- Integration testing
- Performance testing
- Deploy to Proxmox
- Monitor and fix issues

---

## Next Steps

1. **Approve Architecture** - Review this plan
2. **Set Up Backend** - Create Node.js API server
3. **Create Database** - PostgreSQL schema
4. **Update Docker** - Multi-service composition
5. **Migrate Frontend** - API integration
6. **Test & Deploy** - Full stack testing

Ready to start building?
