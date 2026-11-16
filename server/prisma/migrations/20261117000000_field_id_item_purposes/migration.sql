-- Crops: the long farm number becomes the Field ID, the farm's unique
-- identification number (kept in capitals). Farms are searched by it.
ALTER TABLE "CropFarm" RENAME COLUMN "longFarmNumber" TO "fieldId";
UPDATE "CropFarm" SET "fieldId" = NULLIF(UPPER(BTRIM("fieldId")), '');
CREATE UNIQUE INDEX "CropFarm_fieldId_key" ON "CropFarm"("fieldId");

-- Requisitions to Accounts and requests to Stores: each item asked for
-- carries its own purpose. A requisition's own purpose stays on those
-- raised before.
ALTER TABLE "Requisition" ALTER COLUMN "purpose" DROP NOT NULL;
ALTER TABLE "RequisitionItem" ADD COLUMN "purpose" TEXT;
ALTER TABLE "StoreRequestItem" ADD COLUMN "purpose" TEXT;

-- When each user last looked at a list, for the counts in the sidebar
-- (answers to their department's requests since then).
CREATE TABLE "SeenMark" (
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeenMark_pkey" PRIMARY KEY ("userId","key")
);

ALTER TABLE "SeenMark" ADD CONSTRAINT "SeenMark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
