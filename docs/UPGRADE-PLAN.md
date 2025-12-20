# Major Dependency Upgrade Plan

**Goal:** Safely upgrade all major dependencies while keeping the app working at every step.

**Approach:** Upgrade in phases, testing thoroughly after each phase. Each phase is independently deployable.

**Related Issue:** <https://github.com/j-cadena1/sim-rq/issues/18>

---

## Phase 1: Redis 8 (Infrastructure) ✅ COMPLETE

**Status:** Completed 2025-12-14 | Commit: `2f91939`

**Risk: ZERO** - No code changes required

**Changes:**

- `docker-compose.yaml`: Change `redis:${REDIS_VERSION:-7}-alpine` to `redis:${REDIS_VERSION:-8}-alpine`
- `docker-compose.dev.yaml`: Same change

**Why safe:**

- Application uses only basic Redis commands (INCR, EXPIRE, pub/sub)
- node-redis v5.10.0 is already compatible with Redis 8
- rate-limit-redis and @socket.io/redis-adapter work with Redis 8
- Redis 8 is backward compatible with Redis 7 commands

**Testing:**

```bash
make dev                    # Start with Redis 8
# Verify logs show Redis connection
curl http://localhost:3001/ready  # Check redis.connected: true
make test-e2e               # Run full E2E suite
```

---

## Phase 2: Safe Backend Upgrades (No Breaking Changes) ✅ COMPLETE

**Status:** Completed 2025-12-14 | Commit: `1a578b1`

**Risk: LOW** - Direct upgrades, no code changes

**Packages:**

| Package   | From   | To     | Notes                            |
|-----------|--------|--------|----------------------------------|
| dotenv    | 16.3.1 | 17.2.3 | ✅ `.config()` API unchanged     |
| bcrypt    | 5.1.1  | 6.0.0  | ✅ `hash()`/`compare()` unchanged |
| helmet    | 7.1.0  | 8.1.0  | ✅ Config object API stable      |
| file-type | 20.5.0 | 21.1.1 | ✅ `fileTypeFromBuffer()` unchanged |
| sharp     | 0.33.5 | 0.34.5 | ✅ Added node-gyp for Alpine builds |

**Commands:**

```bash
cd backend
npm install dotenv@latest bcrypt@latest helmet@latest file-type@latest sharp@0.34
npm install @types/bcrypt@latest  # Update types
```

**Testing:**

```bash
make test                   # Unit tests (423 backend + 152 frontend)
make test-e2e               # E2E tests (86 tests, 4 conditionally skip)
```

---

## Phase 3: Zod 4 Migration ✅ COMPLETE

**Status:** Completed 2025-12-16 | Commit: `5532c63`

**Risk: LOW-MEDIUM** - Minor API changes possible

**Package:** zod 3.22.4 → 4.2.1

**Files reviewed:**

- `backend/src/middleware/validation.ts` - No changes needed (schemas compatible)
- `backend/src/middleware/errorHandler.ts` - No changes needed (ZodError API unchanged)

**Why it worked without changes:**

- All schema definitions use stable Zod 3/4 compatible APIs
- `z.object()`, `z.string()`, `z.enum()`, `z.number()` unchanged
- `.min()`, `.max()`, `.transform()`, `.optional()`, `.default()` unchanged
- `ZodError.errors` and error path handling unchanged
- `z.string().uuid()` still works (deprecated but functional)

**Commands:**

```bash
cd backend
npm install zod@latest
```

**Testing:**

```bash
make test                   # Backend unit tests (423 passed)
make test-e2e               # Full E2E (82 passed, 4 conditionally skip)
```

---

## Phase 4: Express 5 Migration ✅ COMPLETE

**Status:** Completed 2025-12-16 | Commit: `78cf9fa`

**Risk: LOW** - Codebase already Express 5-ready

**Package:** express 4.18.2 → 5.2.1, @types/express 4.17.21 → 5.0.6

**Why low risk:**

- All middleware uses standard 3-param signature
- Error handler uses 4-param signature (correct)
- No deprecated Express 4 patterns found
- `asyncHandler()` wrapper handles promises correctly
- Route parameters use standard patterns

**Commands:**

```bash
cd backend
npm install express@latest
npm install @types/express@latest
```

**Testing:**

```bash
make test                   # Backend unit tests
make test-e2e               # Full E2E (tests all API endpoints)
```

---

## Phase 5: express-rate-limit 8 Migration ✅ COMPLETE

**Status:** Completed 2025-12-19 | Commit: `63895be`

**Risk: LOW** - No code changes required

**Package:** express-rate-limit 7.1.5 → 8.2.1

**File:** `backend/src/middleware/rateLimiter.ts`

**Why no changes needed:**

- All configuration options (`windowMs`, `max`, `message`, `standardHeaders`, `legacyHeaders`, `store`, `handler`, `keyGenerator`) unchanged
- Redis store via `rate-limit-redis` remains compatible
- Custom handlers and key generators work without modification

**Commands:**

```bash
cd backend
npm install express-rate-limit@latest
```

**Testing:**

```bash
make test                   # Backend unit tests (423 passed)
make test-e2e               # E2E tests (82 passed, 4 conditionally skip)
```

---

## Phase 6: Frontend Upgrades ✅ COMPLETE

**Status:** Completed 2025-12-20

### 6a: TypeScript 5.9 ✅ COMPLETE

**Status:** Completed 2025-12-20 | Commit: `1196293`

**Package:** typescript 5.8.2 → 5.9.3

**Why no changes needed:**

- TypeScript 5.9 is a minor version with backward-compatible improvements
- No breaking changes in type checking behavior

### 6b: lucide-react ✅ COMPLETE

**Status:** Completed 2025-12-20 | Commit: `026a820`

**Package:** lucide-react 0.555.0 → 0.562.0

**Why no changes needed:**

- Icon library patch updates with no API changes
- All existing icon imports continue to work

### 6c: Vite 7 ✅ COMPLETE

**Status:** Completed 2025-12-20 | Commit: `1e44d08`

**Packages:**

| Package               | From    | To     |
|-----------------------|---------|--------|
| vite                  | 6.2.0   | 7.3.0  |
| @vitejs/plugin-react  | 5.0.0   | 5.1.2  |
| @tailwindcss/vite     | 4.1.17  | 4.1.18 |
| tailwindcss           | 4.1.17  | 4.1.18 |

**Why no vite.config.ts changes needed:**

- Existing `defineConfig` API unchanged
- Proxy configuration syntax unchanged
- Plugin compatibility maintained
- Build/rollup options unchanged

**Testing:**

```bash
make test                   # Backend unit tests (423 passed)
make test-e2e               # E2E tests (82 passed, 4 conditionally skip)
```

---

## Phase 7: Multer 2 (Optional - Highest Risk)

**Risk: MEDIUM-HIGH** - File upload API changes

**Package:** multer 1.4.5-lts → 2.x

**Files:**

- `backend/src/routes/attachments.ts`
- `backend/src/controllers/attachmentsController.ts`

**Recommendation:** Skip unless security issue. v1.4.5-lts is still maintained.

---

## Execution Order

```text
Phase 1: Redis 8           → Test → Commit  ✅ DONE (2f91939)
Phase 2: Safe backend deps → Test → Commit  ✅ DONE (1a578b1)
Phase 3: Zod 4             → Test → Commit  ✅ DONE (5532c63)
Phase 4: Express 5         → Test → Commit  ✅ DONE (78cf9fa)
Phase 5: Rate limiter 8    → Test → Commit  ✅ DONE (63895be)
Phase 6a: TypeScript 5.9   → Test → Commit  ✅ DONE (1196293)
Phase 6b: lucide-react     → Test → Commit  ✅ DONE (026a820)
Phase 6c: Vite 7           → Test → Commit  ✅ DONE (1e44d08)
Phase 7: Multer 2          → (Optional, skip for now)
```

**Each phase:**

1. Make changes
2. Run `make test` (unit tests)
3. Run `make test-e2e` (E2E tests)
4. If tests pass → commit
5. If tests fail → debug and fix before continuing

---

## Rollback Strategy

Each phase is a separate commit. If issues arise in production:

```bash
git revert <commit-hash>
make prod-build && make prod
```

---

## Files Modified

**Phase 1:**

- `docker-compose.yaml`
- `docker-compose.dev.yaml`

**Phase 2-5:**

- `backend/package.json`
- `backend/package-lock.json`

**Phase 6:**

- `package.json`
- `package-lock.json`
- No `vite.config.ts` changes required

---

## Success Criteria

- [x] All 661 tests passing (86 E2E + 152 frontend + 423 backend) - 4 E2E conditionally skip
- [x] `npm audit` shows 0 vulnerabilities
- [x] Application starts and functions correctly
- [x] Redis 8 connection works
- [ ] File uploads work (not yet tested in Phase 1-2)
- [ ] SSO authentication works (not yet tested in Phase 1-2)
- [ ] Real-time notifications work (not yet tested in Phase 1-2)
