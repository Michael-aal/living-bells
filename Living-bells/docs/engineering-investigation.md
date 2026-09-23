# Living Bells — Engineering Investigation & Future-Proofing

## Scope
This investigation covers the current `fix/backend-access-control` branch and checks the React/Vite frontend, Express backend, Prisma schema, PostgreSQL integration, authentication, authorization, and the database-backed church records.

## Architecture
```
React/Vite
   |
   | fetch()/JSON + Bearer JWT
   v
Express API (port 5000)
   |
   | Prisma Client
   v
PostgreSQL
```

The frontend must never talk directly to PostgreSQL. All database operations go through Express and Prisma.

## Current database-backed modules
- Users / authentication
- Activities
- Attendance
- Expenses
- Sunday staff reviews
- Generic attendance foundation
- Generic financial-record foundation
- Staff department / admin position

## Role model
- ADMIN = Pastor / church owner/leader. Monitoring and administration.
- STAFF = Secretary / assigned church worker. Operational data entry.

Staff registration departments:
- Media
- Technical
- Security
- Secretary
- Others

Admin registration uses a free-text Position field.

## Database connection
Prisma reads `DATABASE_URL` from the backend environment.
The Prisma client is created once in `backend/src/db.js`.
The backend `/health` endpoint performs `SELECT 1`, so it can be used as a database connectivity smoke test.

Recommended local verification:
```bash
cd backend
npx prisma generate
npx prisma migrate status
npm run dev
```

Then check:
```
GET http://localhost:5000/health
```

Expected database response:
```json
{
  "status": "ok",
  "database": "connected",
  "service": "living-bells-backend"
}
```

## Migration safety
Schema changes are represented in Prisma migrations under `backend/prisma/migrations`.
The current role-profile migration adds:
- `User.department`
- `User.position`

Do not manually edit or delete a migration that has already been applied to a shared/production database. Create a new migration for later changes.

## Findings
### Fixed
1. Registration role details were previously frontend-only. They are now validated and persisted by the backend.
2. Admin registration now checks `ADMIN_REGISTRATION_KEY` on the server.
3. Admin and staff use only the `ADMIN` and `STAFF` authorization roles.
4. The backend has a database health check.
5. Local `APP_URL` has a safe development default.

### Important items to verify before production
1. **Runtime database test:** The repository can be inspected remotely, but this environment cannot currently resolve github.com and does not have the user's PostgreSQL instance. A real database smoke test must therefore be run on the user's machine/server.
2. **Migration application:** The role-profile migration is committed but is only physically applied when Prisma migration commands run against the target database.
3. **Email verification:** The frontend API helper lists verification endpoints, but the current backend does not expose those endpoints. This must be implemented before presenting email verification as a working feature.
4. **Weekly reports:** The current branch does not contain the WeeklyReport Prisma model or API. It must not be described as database-connected on this branch until the module is merged/built here.
5. **Multi-tenancy:** The current schema has no tenant/church foreign key. The current branch is effectively single-church. True multi-tenant isolation requires a Church/Tenant model and tenantId on church-owned records before multiple churches share one database.
6. **CORS:** The backend currently allows all origins. Restrict this to the real frontend origin before production.
7. **Authorization:** Server-side role checks exist for staff recording and admin management. Any new write endpoint must have its own server-side authorization check; hiding a button in React is not security.
8. **Database ownership:** Records currently use recordedById, which identifies who entered a record. It is not a tenant boundary.

## Future debugging checklist
When something breaks, check in this order:
1. Browser console/network request.
2. Frontend API base URL.
3. Backend process and port.
4. Backend logs.
5. JWT/authentication status.
6. Route authorization.
7. Prisma Client generation.
8. `DATABASE_URL`.
9. `prisma migrate status`.
10. PostgreSQL availability.
11. Database schema/migration mismatch.

## Definition of "connected"
A feature is considered database-connected only when all four layers exist:
1. React form/list/view.
2. API client request.
3. Express route + validation + authorization.
4. Prisma model/query + applied database migration.

A UI that only stores data in React state or localStorage is not database-connected.

## Production rule
Never claim a feature is fully tested merely because the source code looks correct. Source inspection proves wiring; an actual PostgreSQL smoke test proves runtime connectivity.
