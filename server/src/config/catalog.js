// Reference lists used for validation on the server and for drop-downs in
// the client (served by GET /api/meta). Change a list here and both sides
// follow.

const list = (entries) => entries.map(([value, label]) => ({ value, label }));

export const DEPARTMENTS = list([
  ["hr", "HR"],
  ["livestock", "Livestock"],
  ["mva", "Milk Value Addition"],
  ["sales", "Sales"],
  ["stores", "Stores"],
  ["crops", "Crops"],
  ["accounts", "Accounts"],
]);

export const ROLES = list([
  ["super_admin", "Super Admin"],
  ["admin", "System Admin"],
  ["general_manager", "General Manager"],
  ["head", "Head of Department"],
  ["officer", "Officer"],
]);

export const DEPARTMENT_ROLES = ["head", "officer"];

export const EXPENSE_CATEGORIES = list([
  ["members_payment", "Members payment"],
  ["salaries", "Salaries"],
  ["hired_transport", "Hired transport services"],
  ["travel_subsistence", "Travel and subsistence"],
  ["acting_allowances", "Acting allowances"],
  ["postage_telephone", "Postage and telephone"],
  ["printing_stationery", "Printing and stationery"],
  ["electricity", "Electricity"],
  ["oil_fuel", "Oil and fuel"],
  ["purchases", "Purchases (supplier payments)"],
  ["other_expense", "Other expenses"],
]);

export const INCOME_CATEGORIES = list([
  ["coop_agency_commission", "Coop Agency Commission"],
  ["rentals", "Rentals"],
  ["coop_holding", "Coop Holding"],
  ["sales_revenue", "Sales revenue (banked)"],
  ["other_income", "Other income"],
]);

export const OPTIONS = {
  departments: DEPARTMENTS,
  roles: ROLES,
  expenseCategories: EXPENSE_CATEGORIES,
  incomeCategories: INCOME_CATEGORIES,
  transactionTypes: list([["income", "Income"], ["expense", "Expense"]]),
  accountTypes: list([["cash", "Cash"], ["bank", "Bank"], ["mobile_money", "Mobile money"]]),
  paymentMethods: list([["cash", "Cash"], ["mpesa", "M-Pesa"], ["bank", "Bank"], ["credit", "Credit"]]),

  gender: list([["female", "Female"], ["male", "Male"]]),
  employmentTypes: list([["permanent", "Permanent"], ["contract", "Contract"], ["casual", "Casual"], ["intern", "Intern"]]),
  employeeStatus: list([["active", "Active"], ["suspended", "Suspended"], ["terminated", "Terminated"], ["resigned", "Resigned"], ["retired", "Retired"]]),
  contractTypes: list([["permanent", "Permanent"], ["fixed_term", "Fixed term"], ["casual", "Casual"], ["probation", "Probation"]]),
  contractStatus: list([["active", "Active"], ["expired", "Expired"], ["renewed", "Renewed"], ["terminated", "Terminated"]]),
  salaryReviewTypes: list([["promotion", "Promotion"], ["annual_review", "Annual review"], ["adjustment", "Adjustment"], ["demotion", "Demotion"]]),
  payrollStatus: list([["draft", "Draft"], ["approved", "Approved"], ["paid", "Paid"]]),
  disciplinaryActions: list([
    ["verbal_warning", "Verbal warning"],
    ["warning_letter", "Warning letter"],
    ["final_warning", "Final warning letter"],
    ["suspension", "Suspension"],
    ["dismissal", "Dismissal"],
  ]),
  caseStatus: list([["open", "Open"], ["closed", "Closed"]]),
  terminationTypes: list([
    ["dismissal", "Dismissal"],
    ["resignation", "Resignation"],
    ["retirement", "Retirement"],
    ["redundancy", "Redundancy"],
    ["contract_end", "End of contract"],
    ["death", "Death"],
  ]),
  clearanceStatus: list([["pending", "Pending"], ["cleared", "Cleared"]]),
  memberStatus: list([["active", "Active"], ["deceased", "Deceased"], ["succeeded", "Succeeded"], ["withdrawn", "Withdrawn"]]),
  memberPaymentTypes: list([["dividend", "Dividend"], ["bonus", "Bonus"], ["other", "Other"]]),

  animalSex: list([["female", "Female"], ["male", "Male"]]),
  animalSource: list([["born_on_farm", "Born on farm"], ["purchased", "Purchased"], ["donated", "Donated"]]),
  animalStatus: list([["active", "Active"], ["sold", "Sold"], ["dead", "Dead"], ["culled", "Culled"]]),
  lactationStatus: list([["milking", "Milking"], ["dry", "Dry"]]),
  healthRecordTypes: list([
    ["disease", "Disease case"],
    ["treatment", "Treatment"],
    ["herd_check", "Herd health check"],
    ["deworming", "Deworming"],
    ["dipping", "Dipping / spraying"],
  ]),
  healthOutcomes: list([["under_treatment", "Under treatment"], ["recovered", "Recovered"], ["died", "Died"], ["not_applicable", "N/A"]]),
  milkSessions: list([["morning", "Morning"], ["midday", "Midday"], ["evening", "Evening"]]),
  transferStatus: list([["sent", "Sent"], ["received", "Received"]]),

  supplierStatus: list([["active", "Active"], ["inactive", "Inactive"]]),
  customerTypes: list([["individual", "Individual"], ["shop", "Shop"], ["hotel", "Hotel"], ["institution", "Institution"]]),
  saleStatus: list([["paid", "Paid"], ["partial", "Partly paid"], ["credit", "Credit"]]),
  vehicleStatus: list([["active", "Active"], ["inactive", "Inactive"]]),
  dispatchStatus: list([["dispatched", "On the road"], ["reconciled", "Reconciled"]]),
  damageTypes: list([["damage", "Damage / write-off"], ["replacement", "Customer replacement"]]),

  storeCategories: list([
    ["animal_feeds", "Animal feeds"],
    ["mva_tools", "MVA processing tools"],
    ["farm_tools", "Farm tools"],
    ["fertilisers", "Fertilisers"],
    ["transport_materials", "Transport materials"],
    ["construction_materials", "Construction materials"],
    ["other", "Other"],
  ]),
  receiptSources: list([["purchase", "Purchase"], ["donation", "Donation"], ["return", "Returned by department"], ["opening", "Opening stock"]]),

  cropTypes: list([["sugarcane", "Sugarcane"], ["tea", "Tea"], ["coffee", "Coffee"], ["fodder", "Fodder"]]),
  reportPeriods: list([["month", "Monthly"], ["quarter", "Quarterly"], ["half", "Half-yearly"], ["year", "Annual"]]),
  farmStatus: list([
    ["land_preparation", "Land preparation"],
    ["planted", "Planted"],
    ["weeding", "Weeding"],
    ["awaiting_fertiliser", "Weeding done, awaiting fertiliser"],
    ["fertiliser_applied", "Fertiliser applied"],
    ["growing", "Growing"],
    ["awaiting_harvest", "Awaiting harvest"],
    ["harvesting", "Harvesting"],
    ["harvested", "Harvested"],
    ["fallow", "Fallow"],
  ]),
  harvestUnits: list([["tonnes", "Tonnes"], ["kg", "Kilograms"], ["bales", "Bales"]]),

  requisitionStatus: list([
    ["pending", "Pending approval"],
    ["approved", "Approved"],
    ["returned", "Returned for changes"],
    ["rejected", "Rejected"],
    ["fulfilled", "Fulfilled"],
    ["cancelled", "Cancelled"],
  ]),
  priorities: list([["low", "Low"], ["normal", "Normal"], ["urgent", "Urgent"]]),
  purchaseOrderStatus: list([["ordered", "Ordered"], ["partially_received", "Partly received"], ["received", "Received"], ["cancelled", "Cancelled"]]),
};

export const optionValues = (name) => {
  const options = OPTIONS[name];
  if (!options) throw new Error(`Unknown option list: ${name}`);
  return options.map((option) => option.value);
};

export const optionLabel = (name, value) =>
  OPTIONS[name]?.find((option) => option.value === value)?.label ?? value ?? "";

/// Products MVA makes and Sales sells. Seeded on start-up if missing.
export const DEFAULT_PRODUCTS = [
  { code: "RAW_MILK", name: "Raw milk", unit: "litres", unitPrice: 60 },
  { code: "FRESH_MILK", name: "Fresh milk", unit: "litres", unitPrice: 80 },
  { code: "MALA", name: "Mala", unit: "litres", unitPrice: 120 },
  { code: "YOGHURT", name: "Yoghurt", unit: "litres", unitPrice: 150 },
];

export const RAW_MILK = "RAW_MILK";
