import prisma from "../config/prisma.js";

export const normalizeActor = (actor) => ({
  id: actor?._id || actor?.id || null,
  role: actor?.role || null,
});

export const buildAuditPayload = ({
  actor,
  action,
  entity,
  entityId,
  before,
  after,
  metadata = {},
}) => {
  const normalizedActor = normalizeActor(actor);

  return {
    actorId: normalizedActor.id,
    actorRole: normalizedActor.role,
    action,
    entity,
    entityId,
    before: before ?? null,
    after: after ?? null,
    metadata: metadata ?? {},
    createdAt: new Date(),
  };
};

export const logAudit = async ({ actor, action, entity, entityId, before, after, metadata = {} }) => {
  const payload = buildAuditPayload({
    actor,
    action,
    entity,
    entityId,
    before,
    after,
    metadata,
  });
  const toJson = (value) => JSON.parse(JSON.stringify(value ?? null));

  return prisma.auditLog.create({
    data: {
      ...payload,
      actorId: payload.actorId == null ? null : String(payload.actorId),
      entityId: payload.entityId == null ? null : String(payload.entityId),
      ...(payload.before == null ? {} : { before: toJson(payload.before) }),
      ...(payload.after == null ? {} : { after: toJson(payload.after) }),
      metadata: toJson(payload.metadata),
    },
  });
};

export const softDeleteRecord = (record, { actor, reason, metadata = {} } = {}) => {
  const now = new Date();
  const actorId = actor?._id || actor?.id || record?.voidedBy || null;

  return {
    ...record,
    status: record?.status === "cancelled" ? "cancelled" : "voided",
    deletedAt: now,
    voidedAt: now,
    deletedBy: actorId,
    voidedBy: actorId,
    voidReason: reason || record?.voidReason || "No reason provided",
    deleted: true,
    metadata: {
      ...(record?.metadata || {}),
      ...(metadata || {}),
    },
  };
};
