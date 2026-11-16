// The farmer number identifies a farmer across the cooperative (MVA, Accounts):
// it is what a farmer is searched by, everywhere.

/** Only digits: what a farmer-number box keeps of what is typed. */
export const digitsOnly = (text) => String(text ?? "").replace(/\D/g, "");

/** A list's search box for farmers, by number (see ResourcePage filters). */
export const farmerNumberFilter = { type: "search", numeric: true, label: "Farmer number", placeholder: "Farmer number" };

/** Whether a farmer's number starts with what was typed (13 finds 130 to 139). */
export const numberStartsWith = (number, typed) => Boolean(typed) && String(number).startsWith(typed);
