-- Local sales and vehicles now have separate prices. The one price there was
-- becomes the local price, and vehicles start from the same figure.
ALTER TABLE "Product" RENAME COLUMN "unitPrice" TO "localPrice";
ALTER TABLE "Product" ALTER COLUMN "localPrice" SET DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN "vehiclePrice" DECIMAL(10,2) NOT NULL DEFAULT 0;
UPDATE "Product" SET "vehiclePrice" = "localPrice";

-- Yoghurt is now sold by pack size (added when the server starts).
UPDATE "Product" SET "isActive" = false WHERE "code" = 'YOGHURT';

-- Customers are no longer registered. Any names already used stay on the records.
UPDATE "Sale" AS sale
SET "customerName" = customer."name"
FROM "Customer" AS customer
WHERE sale."customerId" = customer."id" AND sale."customerName" IS NULL;

UPDATE "DamageReplacement" AS record
SET "customerName" = customer."name"
FROM "Customer" AS customer
WHERE record."customerId" = customer."id" AND record."customerName" IS NULL;

ALTER TABLE "DamageReplacement" DROP CONSTRAINT "DamageReplacement_customerId_fkey";
ALTER TABLE "Sale" DROP CONSTRAINT "Sale_customerId_fkey";
ALTER TABLE "DamageReplacement" DROP COLUMN "customerId";
ALTER TABLE "Sale" DROP COLUMN "customerId";
DROP TABLE "Customer";

-- The reference number on a local sale.
ALTER TABLE "Sale" ADD COLUMN "reference" TEXT;

-- Replacements given out from a vehicle.
ALTER TABLE "DispatchItem" ADD COLUMN "quantityReplaced" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Damages, replacements and returns can be recorded against a vehicle's trip.
ALTER TABLE "DamageReplacement" ADD COLUMN "dispatchId" TEXT;
ALTER TABLE "DamageReplacement" ALTER COLUMN "reason" DROP NOT NULL;
ALTER TABLE "DamageReplacement" ADD CONSTRAINT "DamageReplacement_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "VehicleDispatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
