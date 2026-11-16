# Keiyian ERP - departments, roles and setup

## Departments

| Department | What it records |
|---|---|
| HR | Staff, contracts, salary reviews and promotions, payroll, disciplinary cases (letters served, dismissals, summary), terminations, and the members register (pioneer founders and their hereditary successors). |
| Livestock | Herd register by dairy (Dairy A, Dairy C; a male is not kept in a dairy) with mother (dam) and father (sire) and the dates each animal joined and left the herd, calvings (twins included) and lactations, vaccinations (FMD, LSD, Blanthax), diseases from a list and herd health, milk per cow in kilograms (Dairy A milks morning and evening, Dairy C also at midday), and milk sent to MVA in kilograms, never more than was recorded at that milking and not yet sent. Reports: herd, milk, calvings, vaccinations and health, each on its own or together as the full report. |
| Milk Value Addition (MVA) | Milk received from Livestock and from numbered local farmers (130, 131, ...; the farmer number identifies a farmer across the cooperative and is what farmers are searched by), the milk price per litre, processing of raw milk into Fresh milk, Mala and Yoghurt, and products (including unprocessed raw milk) sent to Sales. |
| Sales | Products received from MVA, local sales (cash, M-Pesa or credit), vehicles and their two-person crew, morning dispatch and evening returns, damages and customer replacements, and Sales stock. |
| Stores | Items by name and category (transport & construction, crops, animal feeds, MVA processing tools, other), the stock in the store with each item's stock card, requests from the departments, goods received and stock out to departments, in quantities only (no item codes, costs, suppliers, delivery notes or purchase orders). Goods received add to stock and stock out takes from it. Reports: stock out, goods received and stock remaining. |
| Crops | Sugarcane, tea, coffee and fodder farms: farm number, Field ID (each farm's unique identification number, which farms are searched by), acreage, location, ratoon count, status history and harvests. Reports: a summary (farms and acres by crop), then one report per crop listing each farm's number, Field ID, location, age, acres, ratoon (sugarcane) and status as at the end of the period. Age counts from planting, or for sugarcane and fodder from the last harvest after it; tea and coffee are aged from planting. |
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

1. A department raises a requisition: items with estimated cost, each with its own purpose or justification. Stores does not.
2. The head of Accounts or the General Manager approves, returns (with a comment) or rejects it. Nobody can decide their own requisition.
3. A returned requisition can be edited and resubmitted by the person who raised it.
4. Accounts buys or pays for what was approved and marks it fulfilled.
5. Everyone in the department hears of each answer given by someone else: a count beside Requisitions -> To Accounts in the sidebar, and an item in the bell, until they open that list, where the answers since they last looked are listed and marked New. Answers to requests to Stores are counted the same way beside To Stores.

### Requests to Stores

1. A department asks Stores for items under Requisitions -> To Stores (items from the store's list, with quantities and what each is for). What an item is for goes on its stock out.
2. Stores sees the request under Stores -> Requests (and on its dashboard and bell) and dispatches it: the date, who received the items, and how much of each line (never more than asked for, nor more than the store holds). Each line becomes a stock out to that department and comes off stock.
3. Stores may decline a request with a reason; the person who asked may cancel it while it is waiting.
4. A department may still ask by word of mouth: Stores then records the stock out directly.

## End-of-day reports

Reports -> choose the report in the sidebar (departments with several, such as Crops, list each one) and the period -> view on screen, Download PDF or Download CSV. Staff see their own department; the General Manager, administrators and Accounts can see every department or "All departments" in one file.

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
