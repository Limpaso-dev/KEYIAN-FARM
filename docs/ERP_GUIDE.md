# Keiyian ERP - departments, roles and setup

## Departments

| Department | What it records |
|---|---|
| HR | Staff, contracts, salary reviews and promotions, payroll, disciplinary cases (letters served, dismissals, summary), terminations, and the members register (pioneer founders and their hereditary successors). |
| Livestock | Herd register with mother (dam) and father (sire), calvings and lactations, vaccinations, disease and herd health, milk per cow per session, and milk sent to MVA. |
| Milk Value Addition (MVA) | Milk received from Livestock and from numbered local farmers (130, 131, ...), the milk price per litre, processing of raw milk into Fresh milk, Mala and Yoghurt, and products (including unprocessed raw milk) sent to Sales. |
| Sales | Products received from MVA, local sales (cash, M-Pesa or credit), vehicles and their two-person crew, morning dispatch and evening returns, damages and customer replacements, and Sales stock. |
| Stores | Items by category (animal feeds, MVA tools, farm tools, fertilisers, transport and construction materials), goods received and stock out to departments, in quantities only (no costs, suppliers, delivery notes or purchase orders). Departments ask for items by word of mouth. Reports: stock out, goods received and stock remaining. |
| Crops | Sugarcane, tea and coffee farms: farm number, acreage, location, ratoon count, status history and harvests. |
| Accounts | Income and expenses under the cooperative's categories, cash/bank/M-Pesa accounts, farmer milk payments, member dividends, salaries, suppliers and purchase orders (Accounts also does procurement). |

Income categories: Coop Agency Commission, Rentals, Coop Holding, Sales revenue (banked), Other income.
Expense categories: Members payment, Salaries, Hired transport services, Travel and subsistence, Acting allowances, Postage and telephone, Printing and stationery, Electricity, Oil and fuel, Purchases (supplier payments), Other expenses.
These lists live in `server/src/config/catalog.js`.

## Roles

| Role | Can do |
|---|---|
| Super Admin | Everything, including creating other administrators. |
| System Admin | Creates and manages user accounts; full access to records. Does not approve requisitions. |
| General Manager | Reads every department and report; approves requisitions. Does not enter data. |
| Head of Department | Everything in their department, plus deleting records and head-only steps (approve payroll, void entries, adjust stock after a count). The head of Accounts approves requisitions. |
| Officer | Records and edits their department's data. |

Staff see their own department only; the General Manager and administrators see every department. Hand-overs are done by the receiving department: MVA receives milk from Livestock, Sales receives products from MVA, Accounts pays payroll approved by HR.

All rules are in `server/src/config/access.js`; the browser receives the computed permissions at sign-in.

## Requisitions

1. A department raises a requisition (items with estimated cost). Stores does not: its items are asked for by word of mouth.
2. The head of Accounts or the General Manager approves, returns (with a comment) or rejects it. Nobody can decide their own requisition.
3. A returned requisition can be edited and resubmitted by the person who raised it.
4. Accounts buys or pays for what was approved and marks it fulfilled.

## End-of-day reports

Reports -> choose department and date -> view on screen, Download PDF or Download CSV. Staff see their own department; the General Manager, administrators and Accounts can see every department or "All departments" in one file.

## Accounts and passwords

* A System Admin creates each login under User accounts: name, email, role, department (for heads and officers), and optionally the HR staff record.
* The system generates a temporary password, shown once (and emailed if SMTP is configured). The user must choose their own password at first sign-in.
* Passwords need at least 10 characters with letters and numbers. Eight failed sign-ins lock that email for 15 minutes.
* Recording a termination in HR deactivates the linked login automatically.

## Setting up a database

```powershell
docker compose up -d postgres
cd server
npm ci
npm run prisma:deploy      # creates the tables
npm run seed:admin         # first super admin from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD
npm run dev
```

The server creates the four milk products and a "Cash on Hand" account on start-up if they are missing. Set opening balances on the Accounts tab before paying expenses: an account cannot be paid below zero.

With Docker Compose, run `npm run prisma:deploy` against the database before starting the `api` service for the first time.

## Tests

```powershell
cd server
npm test                                             # unit tests
$env:TEST_DATABASE_URL="postgresql://.../empty_db"   # an EMPTY, migrated database
npm run test:integration                             # every department end to end
```
