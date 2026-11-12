-- Sales: bank deposits on vehicle trips; product requests (Sales asks MVA,
-- the administration asks Sales for office use); raw milk in kg and fresh
-- milk in 250 ml packets.

-- AlterTable
ALTER TABLE "DamageReplacement" ADD COLUMN     "requestId" TEXT;

-- AlterTable
ALTER TABLE "VehicleDispatch" ADD COLUMN     "bankDeposit" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ProductRequest" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "fromDepartment" "Department",
    "toDepartment" "Department" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "purpose" TEXT,
    "requestedById" TEXT NOT NULL,
    "handledById" TEXT,
    "handledAt" TIMESTAMP(3),
    "declineReason" TEXT,
    "transferId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductRequestItem" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "quantityGiven" DECIMAL(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT "ProductRequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductRequest_requestNumber_key" ON "ProductRequest"("requestNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ProductRequest_transferId_key" ON "ProductRequest"("transferId");

-- CreateIndex
CREATE INDEX "ProductRequest_toDepartment_status_date_idx" ON "ProductRequest"("toDepartment", "status", "date");

-- AddForeignKey
ALTER TABLE "DamageReplacement" ADD CONSTRAINT "DamageReplacement_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ProductRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductRequest" ADD CONSTRAINT "ProductRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductRequest" ADD CONSTRAINT "ProductRequest_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductRequest" ADD CONSTRAINT "ProductRequest_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "ProductTransfer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductRequestItem" ADD CONSTRAINT "ProductRequestItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ProductRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductRequestItem" ADD CONSTRAINT "ProductRequestItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Raw milk is sold by the kilogram and fresh milk in 250 ml packets. Existing
-- figures keep their numbers under the new units.
UPDATE "Product" SET "unit" = 'kg' WHERE "code" = 'RAW_MILK';
UPDATE "Product" SET "unit" = 'packets' WHERE "code" = 'FRESH_MILK';
UPDATE "Product" SET "name" = 'Fresh milk 250 ml' WHERE "code" = 'FRESH_MILK' AND "name" = 'Fresh milk';
