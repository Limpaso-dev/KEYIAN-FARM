-- AlterTable
ALTER TABLE "StoreIssue" ADD COLUMN     "requestId" TEXT;

-- AlterTable
ALTER TABLE "StoreItem" ALTER COLUMN "code" DROP NOT NULL;

-- CreateTable
CREATE TABLE "StoreRequest" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "department" "Department" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "purpose" TEXT,
    "requestedById" TEXT NOT NULL,
    "handledById" TEXT,
    "handledAt" TIMESTAMP(3),
    "declineReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreRequestItem" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "quantityGiven" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "StoreRequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreRequest_requestNumber_key" ON "StoreRequest"("requestNumber");

-- CreateIndex
CREATE INDEX "StoreRequest_status_date_idx" ON "StoreRequest"("status", "date");

-- CreateIndex
CREATE INDEX "StoreRequest_department_date_idx" ON "StoreRequest"("department", "date");

-- AddForeignKey
ALTER TABLE "StoreIssue" ADD CONSTRAINT "StoreIssue_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "StoreRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreRequest" ADD CONSTRAINT "StoreRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreRequest" ADD CONSTRAINT "StoreRequest_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreRequestItem" ADD CONSTRAINT "StoreRequestItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "StoreRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreRequestItem" ADD CONSTRAINT "StoreRequestItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "StoreItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Store categories are now: Transport & construction, Crops, Animal feeds,
-- MVA processing tools, Other.
UPDATE "StoreItem" SET "category" = 'crops' WHERE "category" IN ('fertilisers', 'farm_tools');
UPDATE "StoreItem" SET "category" = 'transport_construction' WHERE "category" IN ('transport_materials', 'construction_materials');
UPDATE "StoreItem" SET "category" = 'other' WHERE "category" NOT IN ('transport_construction', 'crops', 'animal_feeds', 'mva_tools', 'other');
