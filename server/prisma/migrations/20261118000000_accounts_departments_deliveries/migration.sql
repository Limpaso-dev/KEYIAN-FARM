-- Accounts records income and expenses against its own list of departments:
-- Tea, Sugarcane and Coffee in place of Crops, plus Dispensary and Rentals.
ALTER TABLE "Transaction" ALTER COLUMN "department" TYPE TEXT USING "department"::text;

-- Stores records deliveries against purchase orders, and Accounts is told.
ALTER TABLE "PurchaseOrder" ADD COLUMN "deliveredAt" TIMESTAMP(3),
ADD COLUMN "deliveredById" TEXT,
ADD COLUMN "deliveryNote" TEXT;

ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_deliveredById_fkey" FOREIGN KEY ("deliveredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
