import { fullName, money } from "./format";

// Drop-down sources shared by many forms.

export const refs = {
  employees: { path: "/hr/employees", params: { status: "active" }, label: (e) => `${e.staffNumber} - ${fullName(e)}` },
  allEmployees: { path: "/hr/employees", label: (e) => `${e.staffNumber} - ${fullName(e)} (${e.status})` },
  members: { path: "/hr/members", params: { status: "active" }, label: (m) => `${m.memberNumber} - ${fullName(m)}` },
  allMembers: { path: "/hr/members", label: (m) => `${m.memberNumber} - ${fullName(m)}` },

  animals: { path: "/livestock/animals", params: { status: "active" }, label: (a) => `${a.tagNumber}${a.name ? ` - ${a.name}` : ""}` },
  cows: { path: "/livestock/animals", params: { status: "active", sex: "female" }, label: (a) => `${a.tagNumber}${a.name ? ` - ${a.name}` : ""}` },
  bulls: { path: "/livestock/animals", params: { sex: "male" }, label: (a) => `${a.tagNumber}${a.name ? ` - ${a.name}` : ""}` },

  milkSuppliers: { path: "/mva/milk-suppliers", params: { status: "active" }, label: (s) => `${s.supplierNumber} - ${fullName(s)}` },
  products: { path: "/sales/products", params: { isActive: "true" }, label: (p) => `${p.name} (${p.unit})` },
  processedProducts: { path: "/sales/products", params: { isActive: "true" }, label: (p) => `${p.name} (${p.unit})`, filter: (p) => p.code !== "RAW_MILK" },

  // Includes products no longer sold, so leftover stock can still be adjusted.
  allProducts: { path: "/sales/products", label: (p) => `${p.name} (${p.unit})${p.isActive ? "" : " - no longer sold"}` },
  openTrips: { path: "/sales/dispatches", params: { status: "dispatched" }, label: (d) => `${d.vehicle?.registrationNumber} - ${d.dispatchNumber}` },
  vehicles: { path: "/sales/vehicles", params: { status: "active" }, label: (v) => `${v.registrationNumber} - ${v.driverName} / ${v.salesPersonName}` },

  // Items are known by name; their unit is shown beside the quantity, not in the list.
  storeItems: { path: "/stores/items", params: { isActive: "true" }, label: (i) => i.name },
  // What a department can ask Stores for (names only; quantities stay with Stores).
  requestableStoreItems: { path: "/store-requests/items", label: (i) => i.name },
  farms: { path: "/crops/farms", label: (f) => `${f.farmNumber} - ${f.location}` },

  moneyAccounts: { path: "/accounts/accounts/balances", label: (a) => `${a.name} (${money(a.balance)})`, filter: (a) => a.isActive },
  suppliers: { path: "/accounts/suppliers", params: { status: "active" }, label: (s) => s.name },
  approvedRequisitions: { path: "/requisitions", params: { status: "approved" }, label: (r) => `${r.requisitionNumber} - ${r.title}` },
};
