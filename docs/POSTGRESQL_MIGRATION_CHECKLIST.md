# PostgreSQL and Prisma Migration Checklist

## Baseline audit findings

The following findings describe the repository before the PostgreSQL conversion and are retained as migration history:

- The backend is an ES-module Express application. Its database models, controllers, authorization middleware, startup helpers, and migration utilities still use Mongoose.
- The audit found MongoDB/Mongoose-dependent code in 35 model files, 21 controllers, and the database config, auth middleware, a service, utilities, and a migration script. The backend currently has 587 Mongo/Mongoose query or schema-pattern matches across 63 files.
- The Mongoose model definitions are the current business-data contract. They include nested records for workflow approvals/history, procurement and sales line items, property units, crop records, and HMIS billing. Those structures need explicit relational/JSON mapping rather than automatic field conversion.
- HMIS authorization is enforced in Express routes and middleware. It must remain server-side, and clinical information must not become available through general-purpose cooperative endpoints.
- The existing backend tests are utility and authorization tests; they do not exercise API/database integration.
- No IndexedDB, service worker, offline queue, or synchronization implementation was found in the frontend.
- The initial scan found 587 Mongo/Mongoose query or schema-pattern matches across 63 files. The Prisma administrator seed conversion removed one Mongo-dependent file; a repeat scan then found 573 matches across 62 files.
- The administrator seed now targets PostgreSQL and requires `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`. Do not run it before the backend cutover, because the current login API still reads MongoDB.
- Existing local worktree changes already add a Prisma 7 config/schema stub, a Prisma client module, Prisma dependencies, a PostgreSQL-only Compose service, and a root `.gitignore`. These files are pre-existing edits and must be integrated, not replaced blindly.
- The checked-in `server/.env.example` documents MongoDB settings only. The Compose file requires `POSTGRES_PASSWORD`, and no root `.env.example`, application Dockerfiles, or Nginx configuration was found.
- No production MongoDB credential or backup was used or inspected during this audit.

## Current application state

- Backend runtime database access now uses Prisma/PostgreSQL. Startup connects to PostgreSQL, runs the existing startup checks, and disconnects Prisma on shutdown.
- MongoDB model files, the Mongoose connection module, the Mongo-specific index script, the Mongoose package, and Mongo environment injection have been removed.
- The runtime source and dependency manifest no longer reference MongoDB or Mongoose. MongoDB remains only as the source system for the separately documented data export/import and cutover process.
- No PostgreSQL migration was applied and no MongoDB records were imported or changed. The actual environment files contain `DATABASE_URL` and no `MONGO_URI`; their values were not inspected.
- The Prisma-backed API has not been validated against a live PostgreSQL database. Data import, reconciliation, and database-backed integration tests remain outstanding.

## Original migration inventory

This inventory records the surfaces identified before the runtime cutover. Backend database access and startup have since been migrated as described above; data import and live PostgreSQL verification remain outstanding.

### Database models (35)

- Cooperative and shared records: `server/src/models/Account.js`, `AnimalFeed.js`, `AuditLog.js`, `Customer.js`, `Employee.js`, `Farmer.js`, `Inventory.js`, `Livestock.js`, `MilkCollection.js`, `MilkTest.js`, `MilkValueAddition.js`, `Product.js`, `Supplier.js`, `Transaction.js`, `User.js`.
- Procurement and approval workflow: `server/src/models/GoodsReceipt.js`, `PurchaseOrder.js`, `PurchaseRequest.js`, `SupplierInvoice.js`, `SupplierPayment.js`, `WorkflowPolicy.js`.
- Finance, HR, sales, and rentals: `server/src/models/Payroll.js`, `Sale.js`, `SalePayment.js`, `Property.js`, `Tenant.js`, `Lease.js`, `RentPayment.js`.
- HMIS: `server/src/models/Patient.js`, `MedicalVisit.js`, `MedicalLabResult.js`, `MedicalBill.js`, `Prescription.js`.
- Agriculture: `server/src/models/TeaFarm.js`, `SugarcaneFarm.js`.

### Controllers (21)

`server/src/controllers/animalFeeds.controller.js`, `auth.controller.js`, `farmer.controller.js`, `finance.controller.js`, `hr.controller.js`, `inventory.controller.js`, `invoice.controller.js`, `livestock.controller.js`, `medical.controller.js`, `medicalBilling.controller.js`, `milkCollection.controller.js`, `milkLaboratory.controller.js`, `milkValueAddition.controller.js`, `procurement.controller.js`, `receipt.controller.js`, `rental.controller.js`, `reports.controller.js`, `sales.controller.js`, `sugarcane.controller.js`, `tea.controller.js`, and `workflow.controller.js`.

### Shared backend and lifecycle surfaces

- Prisma startup and graceful shutdown are implemented in `server/src/server.js`.
- Auth middleware, services, and database-backed utilities now use Prisma. The administrator seed is an environment-driven, idempotent Prisma seed; run it only against the intended migrated database.
- The old Mongo-specific index script was removed; its required indexes are represented in the Prisma schema and initial PostgreSQL migration.
- Preserve API and frontend compatibility through Prisma record mapping, including identifiers and relation fields; validate this with database-backed tests.

### Configuration, deployment, tests, and data migration

- Package/lockfile, Prisma config/schema, Compose, environment examples, ignore rules, Dockerfiles, and Nginx routing have been updated for PostgreSQL.
- Add database-backed tests for Prisma authentication, authorization, core cooperative transactions, HMIS separation, and financial transaction boundaries.
- Add a repeatable, non-destructive MongoDB export/import process that maps identifiers and references, reports invalid/orphan records, and verifies per-collection counts and financial relationships before cutover.
- Preserve the current frontend unless an API compatibility adjustment is required. Offline synchronization is not currently present; document its required design rather than introducing an unsafe partial queue.

## Ordered migration checklist

- [x] Inventory repository structure, dependencies, models, routes, controllers, tests, environment examples, and existing uncommitted migration work.
- [x] Search for MongoDB/Mongoose usage and inspect representative/high-risk schemas, auth, HMIS permissions, and startup helpers.
- [x] Preserve imported Mongo ObjectId strings as text primary keys and use UUID-formatted text IDs for new records; the importer must retain those IDs for existing API/JWT references.
- [x] Define Prisma relations and constraints from the existing schemas; explicitly resolve embedded records and HMIS data boundaries.
- [x] Validate Prisma 7 configuration and schema; generate the client.
- [ ] Apply the generated initial PostgreSQL migration to a reviewed local/staging database without resetting or deleting an existing database or volume.
- [x] Migrate backend runtime access to Prisma, retaining API response and authorization behavior.
- [ ] Add safe export/import tooling and verify counts, references, and financial totals against a backup or staging export.
- [x] Add container build files and Nginx routing; keep PostgreSQL bound to localhost for local development and private to backend services in deployment.
- [x] Switch backend startup and runtime configuration to PostgreSQL and remove Mongoose/MongoDB runtime dependencies.
- [ ] Run unit, integration, and build checks; perform endpoint smoke tests against a local PostgreSQL database before cutover.
- [ ] Keep MongoDB data untouched until verified cutover and an independently restorable backup are confirmed.

## Cutover guardrails

- Do not connect this migration to production records or change the live database during development.
- Do not direct production traffic to PostgreSQL until data import, reconciliation, and API integration tests are complete.
- Do not run destructive schema/database/volume commands.
- A database backup and access to a non-production MongoDB export are required to validate the importer. Neither was available as part of this audit.
