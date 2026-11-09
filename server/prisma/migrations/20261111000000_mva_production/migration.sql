-- Milk from Livestock comes from one of two dairies. Earlier transfers did not
-- record which, so they start as Dairy A.
ALTER TABLE "MilkTransfer" ADD COLUMN "dairy" TEXT NOT NULL DEFAULT 'dairy_a';

-- Accounts keeps each farmer's payment details: bank and account number.
ALTER TABLE "MilkSupplier" RENAME COLUMN "paymentDetails" TO "accountNumber";
ALTER TABLE "MilkSupplier" ADD COLUMN "bankName" TEXT;

-- Product output: kilograms processed and Fresh 250 ml packets.
ALTER TABLE "ProcessingBatch" ADD COLUMN "malaKg" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "ProcessingBatch" ADD COLUMN "yoghurtKg" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "ProcessingBatch" ADD COLUMN "fresh250" INTEGER NOT NULL DEFAULT 0;

-- Mala is packed and counted in 500 ml pieces.
UPDATE "Product" SET "unit" = 'pieces' WHERE "code" = 'MALA';

-- Where each day's milk went.
CREATE TABLE "MilkAllocation" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MilkAllocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MilkAllocationLine" (
    "id" TEXT NOT NULL,
    "allocationId" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "MilkAllocationLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MilkAllocation_date_key" ON "MilkAllocation"("date");
CREATE UNIQUE INDEX "MilkAllocationLine_allocationId_destination_key" ON "MilkAllocationLine"("allocationId", "destination");

ALTER TABLE "MilkAllocationLine" ADD CONSTRAINT "MilkAllocationLine_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "MilkAllocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The raw milk that an L.Sale allocation sends to Sales.
ALTER TABLE "ProductTransfer" ADD COLUMN "allocationId" TEXT;
CREATE UNIQUE INDEX "ProductTransfer_allocationId_key" ON "ProductTransfer"("allocationId");
ALTER TABLE "ProductTransfer" ADD CONSTRAINT "ProductTransfer_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "MilkAllocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
