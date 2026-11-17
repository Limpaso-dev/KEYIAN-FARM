-- Milk is recorded in litres everywhere. The columns are renamed so every
-- figure already entered is kept as it was.
ALTER TABLE "MilkRecord" RENAME COLUMN "kg" TO "litres";
ALTER TABLE "MilkTransfer" RENAME COLUMN "kg" TO "litres";
ALTER TABLE "MilkTransfer" RENAME COLUMN "receivedKg" TO "receivedLitres";
ALTER TABLE "ProcessingBatch" RENAME COLUMN "malaKg" TO "malaLitres";
ALTER TABLE "ProcessingBatch" RENAME COLUMN "yoghurtKg" TO "yoghurtLitres";

-- Products: raw milk in litres; fresh milk named in full; the old Yoghurt
-- (by the litre) comes back as Yoghurt 1 litre, a pack size like the others;
-- Mala and Yoghurt can also go to Sales in bulk, by the litre.
UPDATE "Product" SET "unit" = 'litres', "updatedAt" = CURRENT_TIMESTAMP WHERE "code" = 'RAW_MILK' AND "unit" = 'kg';
UPDATE "Product" SET "name" = 'Fresh Pasteurised Milk 250 ml', "updatedAt" = CURRENT_TIMESTAMP WHERE "code" = 'FRESH_MILK' AND "name" = 'Fresh milk 250 ml';
UPDATE "Product" SET "code" = 'YOGHURT_1000', "name" = 'Yoghurt 1 litre', "unit" = 'pieces', "isActive" = true, "updatedAt" = CURRENT_TIMESTAMP
  WHERE "code" = 'YOGHURT' AND NOT EXISTS (SELECT 1 FROM "Product" WHERE "code" = 'YOGHURT_1000');
INSERT INTO "Product" ("id", "code", "name", "unit", "localPrice", "vehiclePrice", "isActive", "createdAt", "updatedAt") VALUES
  (gen_random_uuid()::text, 'YOGHURT_1000', 'Yoghurt 1 litre', 'pieces', 0, 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'BULK_MALA', 'Bulk Mala', 'litres', 0, 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'BULK_YOGHURT', 'Bulk Yoghurt', 'litres', 0, 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- "L.Sale" is written in full.
UPDATE "ProductTransfer" SET "notes" = 'Local sale allocation' WHERE "notes" = 'L.Sale allocation';
UPDATE "StockMovement" SET "notes" = replace("notes", 'L.Sale', 'Local sale') WHERE "notes" LIKE '%L.Sale%';

-- Farmer deliveries: remarks on rejected milk.
COMMENT ON COLUMN "MilkDelivery"."notes" IS 'Remarks on milk rejected at collection';

-- Raw materials MVA uses up in production: the cups yoghurt is packed in.
CREATE TABLE "RawMaterial" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "usedFor" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RawMaterial_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RawMaterialMovement" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "movementType" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "date" DATE NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RawMaterialMovement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RawMaterial_code_key" ON "RawMaterial"("code");
CREATE UNIQUE INDEX "RawMaterial_usedFor_key" ON "RawMaterial"("usedFor");
CREATE INDEX "RawMaterialMovement_materialId_idx" ON "RawMaterialMovement"("materialId");
CREATE INDEX "RawMaterialMovement_date_idx" ON "RawMaterialMovement"("date");
CREATE INDEX "RawMaterialMovement_referenceType_referenceId_idx" ON "RawMaterialMovement"("referenceType", "referenceId");
ALTER TABLE "RawMaterialMovement" ADD CONSTRAINT "RawMaterialMovement_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "RawMaterial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "RawMaterial" ("id", "code", "name", "unit", "usedFor", "updatedAt") VALUES
  (gen_random_uuid()::text, 'CUP_150', 'Yoghurt cups 150 ml', 'cups', 'YOGHURT_150', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'CUP_250', 'Yoghurt cups 250 ml', 'cups', 'YOGHURT_250', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'CUP_500', 'Yoghurt cups 500 ml', 'cups', 'YOGHURT_500', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'CUP_1000', 'Yoghurt cups 1 litre', 'cups', 'YOGHURT_1000', CURRENT_TIMESTAMP);

-- A requisition's proforma invoice (PDF).
CREATE TABLE "RequisitionProforma" (
    "id" TEXT NOT NULL,
    "requisitionId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequisitionProforma_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RequisitionProforma_requisitionId_key" ON "RequisitionProforma"("requisitionId");
ALTER TABLE "RequisitionProforma" ADD CONSTRAINT "RequisitionProforma_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "Requisition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
