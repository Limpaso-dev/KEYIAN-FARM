/**
 * A department as Accounts names it: from its own list (Tea, Sugarcane,
 * Coffee, Dispensary, Rentals ...), or for older entries the staff
 * department they were recorded against (Crops). label: from useAuth().
 */
export const departmentLabel = (label, value) => {
  if (!value) return "No department";
  const own = label("accountDepartments", value);
  return own !== value ? own : label("departments", value);
};
