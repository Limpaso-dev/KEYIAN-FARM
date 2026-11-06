# PostgreSQL Cutover and Offline-Sync Runbook

## Current state and safety boundary

Backend runtime database access now uses Prisma/PostgreSQL, and Mongoose runtime dependencies have been removed. This is a code cutover only: no PostgreSQL migration has been applied and no MongoDB data has been imported or changed. Do not direct production traffic to PostgreSQL until the schema is applied, the data importer is completed and reconciled, and API integration tests pass.

The `npm run seed:admin` command creates an administrator in PostgreSQL. Run it only against the intended migrated database; the account will not exist until the seed is run there.

The schema preserves existing Mongo `_id` values as text. New records get UUID-formatted text IDs. Import records with the original `_id` string as `id`, and rewrite reference values to the same preserved strings. Do not convert an ObjectId by parsing it as a UUID.

Medical visits require a clinician in the relational schema, while the existing Mongo model permits a missing clinician. The migration must report and resolve such visits with the business owner before import; it must not assign an invented clinician. Existing duplicate or non-normalized patient national IDs also require a reviewed resolution before the unique PostgreSQL constraint can be created.

## Local PostgreSQL setup

1. Copy the root `.env.example` to `.env` for Compose, and `server/.env.example` to `server/.env` for commands run from the backend directory. Set a unique local `POSTGRES_PASSWORD` and `JWT_SECRET`; use the same password in both database URLs and percent-encode URL-reserved characters there. `DATABASE_URL` uses `127.0.0.1` for the host-run CLI; `DATABASE_URL_DOCKER` uses `postgres` for services in Compose. Keep both `.env` files untracked.
2. The API now requires `DATABASE_URL`; it no longer reads or requires `MONGO_URI`. Existing MongoDB records will not be available in the API until the documented import and reconciliation are complete.
3. Start only the database while the backend migration is incomplete:

   ```powershell
   docker compose up -d postgres
   docker compose ps postgres
   docker compose exec -T postgres pg_isready -U keiyian_user -d keiyian_erp
   ```

4. In `server`, validate and generate the Prisma Client:

   ```powershell
   npm ci
   npm run prisma:validate
   npm run prisma:generate
   ```

5. After reviewing the initial migration and once the local PostgreSQL service is healthy, apply the checked-in migrations:

   ```powershell
   npm run prisma:deploy
   ```

   For local schema iteration only, use `npm run prisma:migrate`. Never use reset or volume deletion commands against a database containing data.

The PostgreSQL port is bound to `127.0.0.1:5432` for local development. In Compose, the API database URL uses the private service hostname `postgres`; PostgreSQL is not connected to the public frontend network.

## MongoDB export and staging migration

Use an authorized, non-production Atlas backup/export first. Never point a migration test at production data.

1. Create a protected backup from a PowerShell session with `MONGO_URI` set to the staging source URI:

   ```powershell
   $archivePath = Join-Path (Get-Location) "keiyian-staging-$(Get-Date -Format yyyyMMdd-HHmmss).archive.gz"
   mongodump --uri="$env:MONGO_URI" --archive="$archivePath" --gzip
   ```

   Store the archive outside the repository, restrict access, record its size and checksum, and verify that it can be restored to an isolated staging MongoDB instance.
2. Capture per-collection document counts, financial totals grouped by date/type/status, farmer counts, milk-collection counts and totals, patient counts, and visit counts from the same snapshot.
3. Run a dry-run importer against the isolated snapshot. It must report, without writing, unsupported fields, invalid ObjectIds, missing required values, duplicate unique keys, orphan references, non-finite numeric values, invalid enum/status values, and visits without clinicians.
4. Resolve data issues with the data owner. Do not silently drop records, synthesize IDs, invent relationships, or round monetary values without an approved rule.
5. Import parent records before dependants in transactions or verified batches. Preserve every legacy ID as text and preserve created/updated timestamps. Normalize fields only where the existing application already defines a normalization rule.
6. Import into an empty staging PostgreSQL database using the versioned schema. Record imported, rejected, and skipped counts for every source collection. The final importer must be repeatable by using stable source IDs and must not overwrite data modified since a previous import.
7. Verify:
   - Per-collection source/imported/rejected totals reconcile.
   - Every milk collection has its farmer; every milk test has its collection.
   - HMIS patient/visit links resolve; every visit has its responsible clinician.
   - Medical records remain behind server-side HMIS authorization and are not included in cooperative general-purpose responses.
   - Debits/credits or existing financial totals, transaction source links, account balances, supplier/payroll/sales/rent transactions, and bill payments reconcile exactly under approved decimal rules.
   - No laboratory result creates or changes a farmer payment or financial transaction.
   - Unique identifiers and audit-log actor/entity references reconcile.
8. Have business owners sign off on the reconciliation report before testing the migrated API against staging.

## Production cutover and rollback

1. Complete the data importer, API compatibility/integration tests, and staging reconciliation. Obtain a restorable backup and an approved maintenance window.
2. Freeze writes in the existing application and take a final MongoDB backup. Record a cutover watermark and source counts/totals.
3. Apply PostgreSQL migrations, import the final snapshot, and run all reconciliation checks before exposing the new API.
4. Switch the backend database configuration, verify authentication, role permissions, farmer registration, milk collection/lab operations, HMIS flows, reports, and financial totals, then enable writes.
5. Keep the MongoDB source intact and read-only for the agreed rollback period. If checks fail, disable PostgreSQL writes and restore the old application/database route; reconcile any post-cutover writes before retrying. Never delete the Atlas database or PostgreSQL volume as a rollback shortcut.

## Offline operation requirements

The frontend currently has no IndexedDB store, service-worker transaction queue, or synchronization API. Docker and PostgreSQL do not provide offline operation. Before implementing offline writes, define and test:

- A versioned IndexedDB cache and explicit list of records safe to read offline. Avoid caching HMIS clinical data on shared devices unless encryption, device access controls, retention, and patient privacy requirements are approved.
- A durable outbound queue with UUID idempotency keys, actor/device IDs, entity versions, timestamps, and operation types. Do not queue irreversible financial, milk-collection, or clinical writes until replay semantics are approved.
- An authenticated sync endpoint that validates permissions again on the server and deduplicates idempotency keys transactionally.
- Conflict detection using server versions/ETags and explicit resolution policies for concurrent edits. Never use silent last-write-wins for money, stock, patient identifiers, or clinical records.
- Visible queued/synced/conflict/error states, retry/backoff behavior, and an audit trail. Offline credentials must expire/revoke safely, and revoked users must not replay writes.
- A recovery and reconciliation procedure for duplicate or rejected queued operations.

Do not advertise offline writes as supported until this architecture is implemented and tested under disconnect/reconnect, duplicate replay, expired-token, permission-change, conflict, and interrupted-sync scenarios.
