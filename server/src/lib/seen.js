// When a user last looked at a list (the SeenMark table), so the sidebar can
// count what changed for them since, e.g. answers to their department's
// requisitions. No mark yet: everything counts as new.

const where = (userId, key) => ({ userId_key: { userId, key } });

/** When the user last looked, or null if never. */
export const seenAt = async (db, userId, key) => (await db.seenMark.findUnique({ where: where(userId, key) }))?.seenAt ?? null;

/** Marks the list seen now; returns when it was seen before (null if never). */
export const markSeen = async (db, userId, key) => {
  const before = await seenAt(db, userId, key);
  const now = new Date();
  await db.seenMark.upsert({ where: where(userId, key), create: { userId, key, seenAt: now }, update: { seenAt: now } });
  return before;
};
