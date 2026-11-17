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
  ["consultancy", "Consultancy"],
  ["auditing_fee", "Auditing fee"],
  ["security", "Security"],
  ["legal_fee", "Legal fee"],
  ["food_beverage", "Food and beverage"],
  ["sundry_expense", "Sundry expense"],
  ["purchases", "Purchases (supplier payments)"],
  ["other_expense", "Other expenses"],
]);

/**
 * The departments Accounts records income and expenses against. Crops counts
 * as its three crops (requisitions still come from Crops), and the dispensary
 * and the rentals are departments of their own.
 */
export const ACCOUNT_DEPARTMENTS = list([
  ["hr", "HR"],
  ["livestock", "Livestock"],
  ["mva", "Milk Value Addition"],
  ["sales", "Sales"],
  ["stores", "Stores"],
  ["tea", "Tea"],
  ["sugarcane", "Sugarcane"],
  ["coffee", "Coffee"],
  ["accounts", "Accounts"],
  ["dispensary", "Dispensary"],
  ["rentals", "Rentals"],
]);

/** A staff or requisition department as Accounts records it; null for Crops, which Accounts splits by crop. */
export const accountDepartmentOf = (department) => (ACCOUNT_DEPARTMENTS.some((d) => d.value === department) ? department : null);

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
  accountDepartments: ACCOUNT_DEPARTMENTS,
  transactionTypes: list([["income", "Income"], ["expense", "Expense"]]),
  accountTypes: list([["cash", "Cash"], ["bank", "Bank"], ["mobile_money", "Mobile money"]]),
  paymentMethods: list([["cash", "Cash"], ["mpesa", "M-Pesa"], ["bank", "Bank"], ["credit", "Credit"]]),

  gender: list([["female", "Female"], ["male", "Male"]]),
  employmentTypes: list([["permanent", "Permanent"], ["contract", "Contract"], ["casual", "Casual"], ["intern", "Intern"]]),
  employeeStatus: list([["active", "Active"], ["suspended", "Suspended"], ["terminated", "Terminated"], ["resigned", "Resigned"], ["retired", "Retired"]]),
  contractTypes: list([["permanent", "Permanent"], ["fixed_term", "Fixed term"], ["casual", "Casual"], ["probation", "Probation"]]),
  contractStatus: list([["active", "Active"], ["expired", "Expired"], ["renewed", "Renewed"], ["terminated", "Terminated"]]),
  salaryReviewTypes: list([["promotion", "Promotion"], ["annual_review", "Annual review"], ["adjustment", "Adjustment"], ["demotion", "Demotion"]]),
  payrollStatus: list([["with_finance", "With Finance"], ["paid", "Paid"]]),
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
  dairies: list([["dairy_a", "Dairy A"], ["dairy_c", "Dairy C"]]),
  // Where a day's milk can go, in the order of the production sheet.
  allocationDestinations: list([
    ["mala", "Mala"],
    ["yoghurt", "Yoghurt"],
    ["nkcc", "NKCC"],
    ["own_use", "Own use"],
    ["local_sale", "Local sale"],
    ["staff", "Staff"],
    ["police", "Police"],
    ["school", "School"],
    ["spoilage", "Spoilage"],
  ]),
  memberStatus: list([["active", "Active"], ["deceased", "Deceased"], ["succeeded", "Succeeded"], ["withdrawn", "Withdrawn"]]),
  successionReasons: list([["death", "Death"], ["old_age", "Old age"], ["other", "Other reason"]]),
  advertStatus: list([["open", "Open"], ["closed", "Closed"], ["filled", "Filled"], ["cancelled", "Cancelled"]]),
  applicantStages: list([
    ["applied", "Applied"],
    ["shortlisted", "Shortlisted"],
    ["interview", "Interview scheduled"],
    ["passed", "Passed interview"],
    ["hired", "Hired"],
    ["rejected", "Not successful"],
  ]),
  interviewResults: list([["passed", "Passed"], ["failed", "Not successful"]]),
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
  // Disease cases and treatments name the disease; "Other" is written in the details.
  diseases: list([
    ["ecf", "ECF"],
    ["trypanosomiasis", "Trypanosomiasis"],
    ["mastitis", "Mastitis"],
    ["anaplasmosis", "Anaplasmosis"],
    ["pneumonia", "Pneumonia"],
    ["ephemeral_fever", "Ephemeral fever"],
    ["foot_rot", "Foot rot"],
    ["injuries", "Injuries"],
    ["retained_afterbirth", "Retained afterbirth"],
    ["abortions", "Abortions"],
    ["pink_eye", "Pink eye"],
    ["abscess", "Abscess"],
    ["prolapse", "Prolapse"],
    ["other", "Other"],
  ]),
  vaccines: list([["fmd", "FMD"], ["lsd", "LSD"], ["blanthax", "Blanthax"]]),
  healthOutcomes: list([["under_treatment", "Under treatment"], ["recovered", "Recovered"], ["died", "Died"], ["not_applicable", "N/A"]]),
  // Each dairy's milking times are in DAIRY_SESSIONS below.
  milkSessions: list([["morning", "Morning"], ["midday", "Midday"], ["evening", "Evening"]]),
  transferStatus: list([["sent", "Sent"], ["received", "Received"]]),

  supplierStatus: list([["active", "Active"], ["inactive", "Inactive"]]),
  saleStatus: list([["paid", "Paid"], ["partial", "Partly paid"], ["credit", "Credit"]]),
  vehicleStatus: list([["active", "Active"], ["inactive", "Inactive"]]),
  dispatchStatus: list([["dispatched", "On the road"], ["reconciled", "Reconciled"]]),
  damageTypes: list([["damage", "Damage"], ["replacement", "Customer replacement"], ["vehicle_return", "Return from vehicle"], ["office", "Office use"]]),

  storeCategories: list([
    ["transport_construction", "Transport & construction"],
    ["crops", "Crops"],
    ["animal_feeds", "Animal feeds"],
    ["mva_tools", "MVA processing tools"],
    ["other", "Other"],
  ]),
  storeRequestStatus: list([["pending", "Waiting"], ["issued", "Dispatched"], ["declined", "Declined"], ["cancelled", "Cancelled"]]),
  // The Stock page: everything, or only what needs restocking.
  stockStates: list([["low", "Low or out of stock"], ["out", "Out of stock"]]),
  // An item's opening stock is entered with the item, not received.
  receiptSources: list([["purchase", "Purchase"], ["donation", "Donation"], ["return", "Returned by department"]]),

  cropTypes: list([["sugarcane", "Sugarcane"], ["tea", "Tea"], ["coffee", "Coffee"], ["fodder", "Fodder"]]),
  reportPeriods: list([["month", "Monthly"], ["quarter", "Quarterly"], ["half", "Half-yearly"], ["year", "Annual"]]),
  farmStatus: list([
    ["land_preparation", "Land preparation"],
    ["planted", "Planted"],
    ["weeding", "Weeding"],
    ["awaiting_fertiliser", "Weeding done, awaiting fertiliser"],
    ["fertiliser_applied", "Fertiliser applied"],
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
  productRequestStatus: list([
    ["pending", "Waiting"],
    ["sent", "Sent"],
    ["received", "Received"],
    ["issued", "Given out"],
    ["declined", "Declined"],
    ["cancelled", "Cancelled"],
  ]),
  // Stores records the delivery against the order.
  purchaseOrderStatus: list([["ordered", "Ordered"], ["partially_received", "Partly delivered"], ["received", "Delivered"], ["cancelled", "Cancelled"]]),
  // Stores' deliveries list: those still expected, or those delivered.
  deliveryStatus: list([["waiting", "Expected"], ["partially_received", "Partly delivered"], ["received", "Delivered"]]),
};

/**
 * Departments whose report comes in several parts, each printable on its own
 * (the paper sheets they keep). Left out, the parts print together with the
 * rest of the department's report.
 */
export const REPORT_PARTS = {
  mva: [{ key: "production", title: "Production report" }, { key: "output", title: "Product output" }],
  sales: [{ key: "vehicles", title: "Vehicles register" }, { key: "store", title: "Store register" }, { key: "local", title: "Local sales register" }],
  stores: [{ key: "out", title: "Stock out" }, { key: "received", title: "Goods received" }, { key: "stock", title: "Stock remaining" }],
  livestock: [
    { key: "herd", title: "Herd report" },
    { key: "milk", title: "Milk report" },
    { key: "calvings", title: "Calvings report" },
    { key: "vaccinations", title: "Vaccination report" },
    { key: "health", title: "Health report" },
  ],
  // Requisitions raised, approved and declined; then income and expenses, for all departments and for each.
  // `group` gathers parts in the sidebar; `short` is their name there.
  accounts: [
    { key: "raised", title: "Requisitions raised", short: "Raised", group: "Requisitions" },
    { key: "approved", title: "Requisitions approved", short: "Approved", group: "Requisitions" },
    { key: "declined", title: "Requisitions declined", short: "Declined", group: "Requisitions" },
    { key: "departments", title: "Income and expenses by department", short: "All departments", group: "Income & expenses" },
    ...ACCOUNT_DEPARTMENTS.map(({ value, label }) => ({ key: `dept-${value}`, title: `${label} income and expenses`, short: label, group: "Income & expenses" })),
  ],
  // The summary (farms and acres by crop), then one report per crop.
  crops: [{ key: "summary", title: "Summary" }, ...OPTIONS.cropTypes.map(({ value, label }) => ({ key: value, title: `${label} report` }))],
};

/** When each dairy milks: Dairy A in the morning and evening, Dairy C also at midday. */
export const DAIRY_SESSIONS = {
  dairy_a: ["morning", "evening"],
  dairy_c: ["morning", "midday", "evening"],
};

/** Health record types that name a disease (required for a disease case). */
export const DISEASE_RECORD_TYPES = ["disease", "treatment"];

export const optionValues = (name) => {
  const options = OPTIONS[name];
  if (!options) throw new Error(`Unknown option list: ${name}`);
  return options.map((option) => option.value);
};

export const optionLabel = (name, value) =>
  OPTIONS[name]?.find((option) => option.value === value)?.label ?? value ?? "";

/// Products MVA makes and Sales sells. Seeded on start-up if missing.
/// All milk is in litres.
export const DEFAULT_PRODUCTS = [
  // Raw milk is sold by the litre; fresh milk always in 250 ml packets.
  { code: "RAW_MILK", name: "Raw milk", unit: "litres", localPrice: 60, vehiclePrice: 60 },
  { code: "FRESH_MILK", name: "Fresh Pasteurised Milk 250 ml", unit: "packets", localPrice: 0, vehiclePrice: 0 },
  { code: "MALA", name: "Mala", unit: "pieces", localPrice: 120, vehiclePrice: 120 },
  // Yoghurt is sold by pack size. Sales sets these prices under Prices.
  { code: "YOGHURT_1000", name: "Yoghurt 1 litre", unit: "pieces", localPrice: 0, vehiclePrice: 0 },
  { code: "YOGHURT_500", name: "Yoghurt 500 ml", unit: "pieces", localPrice: 0, vehiclePrice: 0 },
  { code: "YOGHURT_250", name: "Yoghurt 250 ml", unit: "pieces", localPrice: 0, vehiclePrice: 0 },
  { code: "YOGHURT_150", name: "Yoghurt 150 ml", unit: "pieces", localPrice: 0, vehiclePrice: 0 },
  // Mala and Yoghurt also go to Sales unpacked, by the litre.
  { code: "BULK_MALA", name: "Bulk Mala", unit: "litres", localPrice: 0, vehiclePrice: 0 },
  { code: "BULK_YOGHURT", name: "Bulk Yoghurt", unit: "litres", localPrice: 0, vehiclePrice: 0 },
];

export const RAW_MILK = "RAW_MILK";

/** The order products are listed in, as on MVA's output sheet; others follow by name. */
export const PRODUCT_ORDER = ["RAW_MILK", "MALA", "BULK_MALA", "YOGHURT_1000", "YOGHURT_500", "YOGHURT_250", "YOGHURT_150", "BULK_YOGHURT", "FRESH_MILK"];

/// What MVA uses up in production besides the milk: a cup for each piece of
/// yoghurt packed. usedFor is the product each cup is used by.
export const RAW_MATERIALS = [
  { code: "CUP_150", name: "Yoghurt cups 150 ml", unit: "cups", usedFor: "YOGHURT_150" },
  { code: "CUP_250", name: "Yoghurt cups 250 ml", unit: "cups", usedFor: "YOGHURT_250" },
  { code: "CUP_500", name: "Yoghurt cups 500 ml", unit: "cups", usedFor: "YOGHURT_500" },
  { code: "CUP_1000", name: "Yoghurt cups 1 litre", unit: "cups", usedFor: "YOGHURT_1000" },
];

// How MVA's production sheets work out expected losses: of the litres
// processed, this share should come out as product.
export const MALA_YIELD = 0.96;
export const YOGHURT_YIELD = 0.97;
/** Litres in one piece of each packed product. */
export const PACK_LITRES = { MALA: 0.5, YOGHURT_1000: 1, YOGHURT_500: 0.5, YOGHURT_250: 0.25, YOGHURT_150: 0.15 };
