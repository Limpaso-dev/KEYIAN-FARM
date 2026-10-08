import Account from "../models/Account.js";

const cashAccountNames = [/^cash on hand$/i, /^cash drawer$/i];

export const ensureCashAccount = async () => {
  const existing = await Account.findOne({ accountName: { $in: cashAccountNames }, accountType: "asset" }).sort({ status: 1 });
  if (existing) {
    if (existing.accountType !== "asset") {
      throw new Error(`Account ${existing.accountName} must be an asset account to receive cash payments`);
    }
    if (existing.status !== "active") {
      existing.status = "active";
      await existing.save();
    }
    return existing;
  }
  if (await Account.exists({ accountName: { $in: cashAccountNames } })) {
    throw new Error("Cash on Hand or Cash Drawer already exists as a non-asset account; correct its account type before continuing");
  }

  const usedCodes = new Set(await Account.distinct("accountCode", { accountCode: { $regex: /^1\d{3}$/ } }));
  let accountCode;
  for (let code = 1000; code <= 1999; code += 1) {
    if (!usedCodes.has(String(code))) {
      accountCode = String(code);
      break;
    }
  }
  if (!accountCode) throw new Error("No unused asset account code is available in the 1000-1999 range");

  return Account.create({
    accountCode,
    accountName: "Cash on Hand",
    accountType: "asset",
    openingBalance: 0,
    status: "active",
  });
};
