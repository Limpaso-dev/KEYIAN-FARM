-- Stores: an item keeps the quantity it was added with and the day it was
-- counted, so the stock remaining can be worked out for any day.
ALTER TABLE "StoreItem" ADD COLUMN "openingDate" DATE,
ADD COLUMN "openingQuantity" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Existing items: whatever is on hand beyond their receipts and issues is the
-- quantity they were added with, counted on the day they were added
-- (Nairobi time, three hours ahead of UTC).
UPDATE "StoreItem" AS i SET
  "openingQuantity" = i."quantityOnHand"
    - COALESCE((SELECT SUM(r."quantity") FROM "StoreReceipt" AS r WHERE r."itemId" = i."id"), 0)
    + COALESCE((SELECT SUM(s."quantity") FROM "StoreIssue" AS s WHERE s."itemId" = i."id"), 0),
  "openingDate" = (i."createdAt" + INTERVAL '3 hours')::date;
