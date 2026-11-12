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
    ["local_sale", "L.Sale"],
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
  healthOutcomes: list([["under_treatment", "Under treatment"], ["recovered", "Recovered"], ["died", "Died"], ["not_applicable", "N/A"]]),
  milkSessions: list([["morning", "Morning"], ["midday", "Midday"], ["evening", "Evening"]]),
  transferStatus: list([["sent", "Sent"], ["received", "Received"]]),

  supplierStatus: list([["active", "Active"], ["inactive", "Inactive"]]),
  saleStatus: list([["paid", "Paid"], ["partial", "Partly paid"], ["credit", "Credit"]]),
  vehicleStatus: list([["active", "Active"], ["inactive", "Inactive"]]),
  dispatchStatus: list([["dispatched", "On the road"], ["reconciled", "Reconciled"]]),
  damageTypes: list([["damage", "Damage"], ["replacement", "Customer replacement"], ["vehicle_return", "Return from vehicle"], ["office", "Office use"]]),

  storeCategories: list([
    ["animal_feeds", "Animal feeds"],
    ["mva_tools", "MVA processing tools"],
    ["farm_tools", "Farm tools"],
    ["fertilisers", "Fertilisers"],
    ["transport_materials", "Transport materials"],
    ["construction_materials", "Construction materials"],
    ["other", "Other"],
  ]),
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
  productRequestStatus: list([
    ["pending", "Waiting"],
    ["sent", "Sent"],
    ["received", "Received"],
    ["issued", "Given out"],
    ["declined", "Declined"],
    ["cancelled", "Cancelled"],
  ]),
  purchaseOrderStatus: list([["ordered", "Ordered"], ["partially_received", "Partly received"], ["received", "Received"], ["cancelled", "Cancelled"]]),
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
  // Raw milk is sold by the kilogram; fresh milk always in 250 ml packets.
  { code: "RAW_MILK", name: "Raw milk", unit: "kg", localPrice: 60, vehiclePrice: 60 },
  { code: "FRESH_MILK", name: "Fresh milk 250 ml", unit: "packets", localPrice: 0, vehiclePrice: 0 },
  { code: "MALA", name: "Mala", unit: "pieces", localPrice: 120, vehiclePrice: 120 },
  // Yoghurt is sold by pack size. Sales sets these prices under Prices.
  { code: "YOGHURT_500", name: "Yoghurt 500 ml", unit: "pieces", localPrice: 0, vehiclePrice: 0 },
  { code: "YOGHURT_250", name: "Yoghurt 250 ml", unit: "pieces", localPrice: 0, vehiclePrice: 0 },
  { code: "YOGHURT_150", name: "Yoghurt 150 ml", unit: "pieces", localPrice: 0, vehiclePrice: 0 },
];

export const RAW_MILK = "RAW_MILK";

// How MVA's production sheets work out litres and expected losses.
export const KG_TO_LITRES = 0.968;
export const MALA_YIELD = 0.96;
export const YOGHURT_YIELD = 0.97;
export const PACK_LITRES = { MALA: 0.5, YOGHURT_500: 0.5, YOGHURT_250: 0.25, YOGHURT_150: 0.15 };
