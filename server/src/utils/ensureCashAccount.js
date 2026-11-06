import prisma from "../config/prisma.js";

const cashAccountNames = ["Cash on Hand", "Cash Drawer"];

export const ensureCashAccount = async () => prisma.$transaction(async (transaction) => {
  const existing = await transaction.account.findFirst({
    where: {
      accountName: { in: cashAccountNames, mode: "insensitive" },
      accountType: "asset",
    },
    orderBy: { status: "asc" },
  });

  if (existing) {
    if (existing.status !== "active") {
      return transaction.account.update({
        where: { id: existing.id },
        data: { status: "active" },
      });
    }
    return existing;
  }

  const anyCashAccount = await transaction.account.findFirst({
    where: { accountName: { in: cashAccountNames, mode: "insensitive" } },
  });
  if (anyCashAccount) {
    throw new Error(
      "Cash on Hand or Cash Drawer already exists as a non-asset account; correct its account type before continuing",
    );
  }

  const usedCodes = new Set(
    (await transaction.account.findMany({
      where: { accountCode: { startsWith: "1" } },
      select: { accountCode: true },
    }))
      .map(({ accountCode }) => accountCode)
      .filter((accountCode) => /^1\d{3}$/.test(accountCode)),
  );
  let accountCode;
  for (let code = 1000; code <= 1999; code += 1) {
    if (!usedCodes.has(String(code))) {
      accountCode = String(code);
      break;
    }
  }
  if (!accountCode) {
    throw new Error("No unused asset account code is available in the 1000-1999 range");
  }

  return transaction.account.create({
    data: {
      accountCode,
      accountName: "Cash on Hand",
      accountType: "asset",
      openingBalance: 0,
      status: "active",
    },
  });
}, { isolationLevel: "Serializable" });
