import { plain } from "./http.js";

const json = (value) => (value == null ? undefined : JSON.parse(JSON.stringify(plain(value))));

/** Write an audit row. Pass the transaction client when inside one. */
export const audit = (db, { user, action, entity, entityId, before, after, metadata }) =>
  db.auditLog.create({
    data: {
      actorId: user?.id ?? null,
      actorRole: user?.role ?? null,
      action,
      entity,
      entityId: entityId == null ? null : String(entityId),
      before: json(before),
      after: json(after),
      metadata: json(metadata),
    },
  });
