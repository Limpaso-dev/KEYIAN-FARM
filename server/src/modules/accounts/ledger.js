import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "../../config/catalog.js";
import { badRequest, conflict, notFound } from "../../lib/http.js";
import { nextNumber } from "../../lib/numbers.js";
import { round2 } from "../../lib/validate.js";

const CATEGORY_VALUES = {
  income: INCOME_CATEGORIES.map((c) => c.value),
  expense: EXPENSE_CATEGORIES.map((c) => c.value),
};

export const checkCategory = (type, category) => {
  if (!CATEGORY_VALUES[type]) throw badRequest("Type must be income or expense");
  if (!CATEGORY_VALUES[type].includes(category)) throw badRequest(`"${category}" is not a valid ${type} category`);
};

/** Current balance of a money account (opening + income - expenses). */
export const accountBalance = async (tx, accountId) => {
  const account = await tx.account.findUnique({ where: { id: accountId } });
  if (!account) throw notFound("Account");
  const sums = await tx.transaction.groupBy({
    by: ["type"],
    where: { accountId, status: "posted" },
    _sum: { amount: true },
  });
  const total = (type) => Number(sums.find((row) => row.type === type)?._sum.amount || 0);
  return round2(Number(account.openingBalance) + total("income") - total("expense"));
};

/**
 * Post an income or expense. Expenses may not take an account below zero.
 * Must be called inside a transaction.
 */
export const recordTransaction = async (tx, user, { type, category, accountId, date, amount, description, party, department, sourceType, sourceId }) => {
  checkCategory(type, category);
  const value = round2(amount);
  if (!(value > 0)) throw badRequest("Amount must be more than zero");
  const account = await tx.account.findUnique({ where: { id: accountId } });
  if (!account || !account.isActive) throw badRequest("Choose an active account to pay from or into");

  // Serialise postings per account so balance checks are reliable.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`account:${accountId}`}))`;
  if (type === "expense") {
    const balance = await accountBalance(tx, accountId);
    if (balance < value) {
      throw conflict(`${account.name} has a balance of ${balance.toLocaleString("en-KE")}, which is not enough for ${value.toLocaleString("en-KE")}`);
    }
  }

  return tx.transaction.create({
    data: {
      reference: await nextNumber(tx, type === "income" ? "INC" : "EXP", date),
      type,
      category,
      accountId,
      date,
      amount: value,
      description,
      party: party || null,
      department: department || null,
      sourceType: sourceType || null,
      sourceId: sourceId || null,
      createdById: user?.id || null,
    },
  });
};
