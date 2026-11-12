// Who may do what. This is the only place permissions are defined; the
// client receives the computed result for the signed-in user.
//
// Rules, in order:
//   * super_admin / admin   - everything except deciding requisitions
//   * general_manager       - read everything, decide requisitions, reports
//   * owning department     - read and write; "delete" needs a head
//   * `read` list           - other departments that may read, where their
//                             own work needs it (Accounts reads payroll to
//                             pay salaries, and members to pay members)
//   * `actions`             - extra named actions and which departments may
//                             perform them (heads only when `headOnly`)
//
// Department screens and reports: staff see their own department only; the
// General Manager and administrators see every department.

const ALL = ["hr", "livestock", "mva", "sales", "stores", "crops", "accounts"];

export const RESOURCES = {
  // HR
  employees: { dept: "hr" },
  contracts: { dept: "hr" },
  salaryReviews: { dept: "hr" },
  payroll: { dept: "hr", read: ["accounts"], actions: { pay: { depts: ["accounts"] } } },
  disciplinary: { dept: "hr" },
  terminations: { dept: "hr" },
  members: { dept: "hr", read: ["accounts"], actions: { succession: { depts: ["hr"] } } },
  jobAdverts: { dept: "hr" },
  jobApplicants: { dept: "hr" },

  // Livestock
  animals: { dept: "livestock" },
  lactations: { dept: "livestock" },
  vaccinations: { dept: "livestock" },
  healthRecords: { dept: "livestock" },
  milkRecords: { dept: "livestock" },
  milkTransfers: { dept: "livestock", read: ["mva"], actions: { receive: { depts: ["mva"] } } },

  // Milk Value Addition
  milkSuppliers: { dept: "mva" },
  milkPrices: { dept: "mva" },
  milkDeliveries: { dept: "mva" },
  processingBatches: { dept: "mva" },
  milkAllocations: { dept: "mva" },
  productTransfers: { dept: "mva", read: ["sales"], actions: { receive: { depts: ["sales"] } } },
  mvaStock: { dept: "mva", read: ["sales"], actions: { adjust: { depts: ["mva"], headOnly: true } } },

  // Sales
  products: { dept: "sales", read: ["mva"] },
  salesStock: { dept: "sales", actions: { adjust: { depts: ["sales"], headOnly: true } } },
  sales: { dept: "sales" },
  vehicles: { dept: "sales" },
  dispatches: { dept: "sales", actions: { reconcile: { depts: ["sales"] } } },
  damages: { dept: "sales" },

  // Stores (Accounts can pick a store item on a purchase order line)
  storeItems: { dept: "stores", read: ["accounts"] },
  storeReceipts: { dept: "stores" },
  storeIssues: { dept: "stores" },

  // Crops
  cropFarms: { dept: "crops" },
  cropHarvests: { dept: "crops" },

  // Accounts (finance + procurement)
  accounts: { dept: "accounts" },
  transactions: { dept: "accounts", actions: { void: { depts: ["accounts"], headOnly: true } } },
  milkPayments: { dept: "accounts", actions: { pay: { depts: ["accounts"] } } },
  farmerDetails: { dept: "accounts" },
  memberPayments: { dept: "accounts", read: ["hr"] },
  // Stores does not use purchase orders or suppliers.
  suppliers: { dept: "accounts" },
  purchaseOrders: { dept: "accounts", actions: { pay: { depts: ["accounts"] } } },
};

export const isSystemAdmin = (user) => ["super_admin", "admin"].includes(user?.role);
export const isGeneralManager = (user) => user?.role === "general_manager";
export const isHead = (user) => user?.role === "head";

/**
 * can(user, resource, action) -> boolean
 * action: "read" | "write" | "delete" | a named action from RESOURCES
 */
export const can = (user, resource, action = "read") => {
  if (!user?.isActive) return false;
  const rule = RESOURCES[resource];
  if (!rule) return false;

  if (isSystemAdmin(user)) return true;
  if (isGeneralManager(user)) return action === "read";

  const dept = user.department;
  if (!dept) return false;
  if (action === "read") {
    return dept === rule.dept || Boolean(rule.read?.includes(dept));
  }
  if (action === "write") return dept === rule.dept;
  if (action === "delete") return dept === rule.dept && isHead(user);

  const named = rule.actions?.[action];
  if (!named) return false;
  return named.depts.includes(dept) && (!named.headOnly || isHead(user));
};

// Requisitions are raised by the departments and decided by the head of
// Accounts or the General Manager; Accounts fulfils them. Stores takes
// requests for its items by word of mouth, so it has no requisitions.
// They are not tied to one department, so they have their own rules.
export const requisitionRules = {
  canRaise: (user) => Boolean(user?.isActive && user.department && user.department !== "stores"),
  canSeeAll: (user) => isSystemAdmin(user) || isGeneralManager(user) || user?.department === "accounts",
  canDecide: (user) =>
    Boolean(user?.isActive && (isGeneralManager(user) || (user.department === "accounts" && isHead(user)))),
  canFulfil: (user) => Boolean(user?.isActive && (isSystemAdmin(user) || user.department === "accounts")),
};

// Product requests. Sales asks MVA for products, and MVA sends them. The
// administrators ask Sales for products, which Sales gives out as office use
// (not paid for). The department asked handles the request; the General
// Manager and administrators see every request.
export const productRequestRules = {
  raiseTo: (user) => {
    if (!user?.isActive) return [];
    if (isSystemAdmin(user)) return ["sales"];
    return user.department === "sales" ? ["mva"] : [];
  },
  handles: (user) => (user?.isActive && ["mva", "sales"].includes(user.department) ? [user.department] : []),
  seeAll: (user) => Boolean(user?.isActive && (isSystemAdmin(user) || isGeneralManager(user))),
};

// A department's screens and reports: its own staff; the General Manager and
// administrators see every department. (Accounts sees every requisition
// because it approves and fulfils them - see requisitionRules.)
export const canOpenDepartment = (user, department) =>
  Boolean(user?.isActive) &&
  (isSystemAdmin(user) || isGeneralManager(user) || user.department === department);

export const canReadReport = canOpenDepartment;

export const canManageUsers = (user) => Boolean(user?.isActive && isSystemAdmin(user));

/** The permission map sent to the client after login. */
export const permissionsFor = (user) => {
  const resources = {};
  for (const [name, rule] of Object.entries(RESOURCES)) {
    const entry = {
      read: can(user, name, "read"),
      write: can(user, name, "write"),
      delete: can(user, name, "delete"),
    };
    for (const action of Object.keys(rule.actions || {})) entry[action] = can(user, name, action);
    resources[name] = entry;
  }
  return {
    resources,
    requisitions: {
      raise: requisitionRules.canRaise(user),
      seeAll: requisitionRules.canSeeAll(user),
      decide: requisitionRules.canDecide(user),
      fulfil: requisitionRules.canFulfil(user),
    },
    productRequests: {
      raiseTo: productRequestRules.raiseTo(user),
      handles: productRequestRules.handles(user),
      seeAll: productRequestRules.seeAll(user),
    },
    departments: ALL.filter((department) => canOpenDepartment(user, department)),
    reports: ALL.filter((department) => canReadReport(user, department)),
    manageUsers: canManageUsers(user),
  };
};
