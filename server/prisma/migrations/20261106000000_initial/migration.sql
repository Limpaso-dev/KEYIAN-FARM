-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Department" AS ENUM ('hr', 'livestock', 'mva', 'sales', 'stores', 'crops', 'accounts');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('super_admin', 'admin', 'general_manager', 'head', 'officer');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "department" "Department",
    "employeeId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "emailVerified" BOOLEAN NOT NULL DEFAULT true,
    "emailVerificationCodeHash" TEXT,
    "emailVerificationExpiresAt" TIMESTAMP(3),
    "emailVerificationAttempts" INTEGER NOT NULL DEFAULT 0,
    "emailVerificationLastSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sequence" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Sequence_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "staffNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "nationalId" TEXT,
    "gender" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "department" "Department" NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "employmentType" TEXT NOT NULL DEFAULT 'permanent',
    "dateHired" TIMESTAMP(3) NOT NULL,
    "basicSalary" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "bankName" TEXT,
    "bankAccount" TEXT,
    "kraPin" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "contractNumber" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "contractType" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "salary" DECIMAL(18,2) NOT NULL,
    "terms" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryReview" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "reviewType" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "previousSalary" DECIMAL(18,2) NOT NULL,
    "newSalary" DECIMAL(18,2) NOT NULL,
    "previousJobTitle" TEXT,
    "newJobTitle" TEXT,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalaryReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payroll" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "basicSalary" DECIMAL(18,2) NOT NULL,
    "allowances" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "deductions" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "netPay" DECIMAL(18,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "paidAt" TIMESTAMP(3),
    "transactionId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payroll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisciplinaryCase" (
    "id" TEXT NOT NULL,
    "caseNumber" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "incidentDate" TIMESTAMP(3) NOT NULL,
    "offence" TEXT NOT NULL,
    "actionTaken" TEXT NOT NULL,
    "letterServed" BOOLEAN NOT NULL DEFAULT false,
    "letterDate" TIMESTAMP(3),
    "description" TEXT,
    "outcome" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisciplinaryCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Termination" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "terminationType" TEXT NOT NULL,
    "terminationDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "finalDues" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "clearanceStatus" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Termination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "memberNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "nationalId" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "joinDate" TIMESTAMP(3) NOT NULL,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "isPioneer" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'active',
    "predecessorId" TEXT,
    "relationship" TEXT,
    "successionDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Animal" (
    "id" TEXT NOT NULL,
    "tagNumber" TEXT NOT NULL,
    "name" TEXT,
    "breed" TEXT,
    "sex" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'born_on_farm',
    "damId" TEXT,
    "sireId" TEXT,
    "sireDetails" TEXT,
    "lactationCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Animal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lactation" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "lactationNumber" INTEGER NOT NULL,
    "calvingDate" TIMESTAMP(3) NOT NULL,
    "calfId" TEXT,
    "dryOffDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'milking',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lactation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vaccination" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "vaccine" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "dose" TEXT,
    "nextDueDate" TIMESTAMP(3),
    "administeredBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vaccination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthRecord" (
    "id" TEXT NOT NULL,
    "animalId" TEXT,
    "recordType" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "condition" TEXT NOT NULL,
    "treatment" TEXT,
    "vet" TEXT,
    "cost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "outcome" TEXT NOT NULL DEFAULT 'under_treatment',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MilkRecord" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "session" TEXT NOT NULL,
    "litres" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MilkRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MilkTransfer" (
    "id" TEXT NOT NULL,
    "transferNumber" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "session" TEXT NOT NULL,
    "litres" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "receivedLitres" DECIMAL(10,2),
    "receivedAt" TIMESTAMP(3),
    "receivedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MilkTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MilkSupplier" (
    "id" TEXT NOT NULL,
    "supplierNumber" INTEGER NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "nationalId" TEXT,
    "phone" TEXT,
    "location" TEXT,
    "paymentMethod" TEXT NOT NULL DEFAULT 'mpesa',
    "paymentDetails" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MilkSupplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MilkPrice" (
    "id" TEXT NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "pricePerLitre" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MilkPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MilkDelivery" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "session" TEXT NOT NULL,
    "litres" DECIMAL(10,2) NOT NULL,
    "pricePerLitre" DECIMAL(10,2) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "paymentRunId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MilkDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessingBatch" (
    "id" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "rawMilkInput" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessingBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessingOutput" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "ProcessingOutput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductTransfer" (
    "id" TEXT NOT NULL,
    "transferNumber" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "receivedAt" TIMESTAMP(3),
    "receivedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductTransferItem" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "ProductTransferItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "movementType" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "date" DATE NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "customerType" TEXT NOT NULL DEFAULT 'individual',
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "saleNumber" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "customerId" TEXT,
    "customerName" TEXT,
    "paymentMethod" TEXT NOT NULL DEFAULT 'cash',
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "amountPaid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'paid',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleItem" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalePayment" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "description" TEXT,
    "driverName" TEXT NOT NULL,
    "driverPhone" TEXT,
    "salesPersonName" TEXT NOT NULL,
    "salesPersonPhone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleDispatch" (
    "id" TEXT NOT NULL,
    "dispatchNumber" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverName" TEXT NOT NULL,
    "salesPersonName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'dispatched',
    "expectedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "cashReturned" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "mpesaReturned" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "variance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "reconciledAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DispatchItem" (
    "id" TEXT NOT NULL,
    "dispatchId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantityDispatched" DECIMAL(10,2) NOT NULL,
    "quantityReturned" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "quantityDamaged" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "quantitySold" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "DispatchItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DamageReplacement" (
    "id" TEXT NOT NULL,
    "recordNumber" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "recordType" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "value" DECIMAL(18,2) NOT NULL,
    "customerId" TEXT,
    "customerName" TEXT,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DamageReplacement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreItem" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantityOnHand" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "reorderLevel" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreReceipt" (
    "id" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unitCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'purchase',
    "supplierId" TEXT,
    "purchaseOrderId" TEXT,
    "deliveryNote" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreIssue" (
    "id" TEXT NOT NULL,
    "issueNumber" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "department" "Department" NOT NULL,
    "issuedTo" TEXT NOT NULL,
    "requisitionId" TEXT,
    "purpose" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CropFarm" (
    "id" TEXT NOT NULL,
    "farmNumber" TEXT NOT NULL,
    "cropType" TEXT NOT NULL,
    "acreage" DECIMAL(10,2) NOT NULL,
    "location" TEXT NOT NULL,
    "plantingDate" TIMESTAMP(3),
    "ratoonCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'land_preparation',
    "statusNote" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CropFarm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CropStatusLog" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CropStatusLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CropHarvest" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "harvestDate" DATE NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unit" TEXT NOT NULL,
    "buyer" TEXT,
    "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CropHarvest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "accountNumber" TEXT,
    "openingBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "description" TEXT NOT NULL,
    "party" TEXT,
    "department" "Department",
    "sourceType" TEXT,
    "sourceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'posted',
    "voidReason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MilkPaymentRun" (
    "id" TEXT NOT NULL,
    "runNumber" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "totalLitres" DECIMAL(12,2) NOT NULL,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "paidAt" TIMESTAMP(3),
    "transactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MilkPaymentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MilkPaymentLine" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "litres" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "deductions" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "MilkPaymentLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberPayment" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "paymentType" TEXT NOT NULL DEFAULT 'dividend',
    "amount" DECIMAL(18,2) NOT NULL,
    "description" TEXT,
    "transactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Requisition" (
    "id" TEXT NOT NULL,
    "requisitionNumber" TEXT NOT NULL,
    "department" "Department" NOT NULL,
    "title" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestedById" TEXT NOT NULL,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionComment" TEXT,
    "fulfilledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Requisition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequisitionItem" (
    "id" TEXT NOT NULL,
    "requisitionId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unit" TEXT,
    "unitCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "RequisitionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "kraPin" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "supplierId" TEXT NOT NULL,
    "requisitionId" TEXT,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "amountPaid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ordered',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderItem" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "storeItemId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "quantityReceived" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeId_key" ON "User"("employeeId");

-- CreateIndex
CREATE INDEX "User_role_department_isActive_idx" ON "User"("role", "department", "isActive");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_createdAt_idx" ON "AuditLog"("entity", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_staffNumber_key" ON "Employee"("staffNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_nationalId_key" ON "Employee"("nationalId");

-- CreateIndex
CREATE INDEX "Employee_department_status_idx" ON "Employee"("department", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_contractNumber_key" ON "Contract"("contractNumber");

-- CreateIndex
CREATE INDEX "Contract_employeeId_status_idx" ON "Contract"("employeeId", "status");

-- CreateIndex
CREATE INDEX "SalaryReview_employeeId_effectiveDate_idx" ON "SalaryReview"("employeeId", "effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "Payroll_transactionId_key" ON "Payroll"("transactionId");

-- CreateIndex
CREATE INDEX "Payroll_period_status_idx" ON "Payroll"("period", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Payroll_employeeId_period_key" ON "Payroll"("employeeId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "DisciplinaryCase_caseNumber_key" ON "DisciplinaryCase"("caseNumber");

-- CreateIndex
CREATE INDEX "DisciplinaryCase_employeeId_incidentDate_idx" ON "DisciplinaryCase"("employeeId", "incidentDate");

-- CreateIndex
CREATE UNIQUE INDEX "Termination_employeeId_key" ON "Termination"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Member_memberNumber_key" ON "Member"("memberNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Member_nationalId_key" ON "Member"("nationalId");

-- CreateIndex
CREATE INDEX "Member_status_idx" ON "Member"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Animal_tagNumber_key" ON "Animal"("tagNumber");

-- CreateIndex
CREATE INDEX "Animal_status_sex_idx" ON "Animal"("status", "sex");

-- CreateIndex
CREATE UNIQUE INDEX "Lactation_animalId_lactationNumber_key" ON "Lactation"("animalId", "lactationNumber");

-- CreateIndex
CREATE INDEX "Vaccination_date_idx" ON "Vaccination"("date");

-- CreateIndex
CREATE INDEX "HealthRecord_date_recordType_idx" ON "HealthRecord"("date", "recordType");

-- CreateIndex
CREATE INDEX "MilkRecord_date_idx" ON "MilkRecord"("date");

-- CreateIndex
CREATE UNIQUE INDEX "MilkRecord_animalId_date_session_key" ON "MilkRecord"("animalId", "date", "session");

-- CreateIndex
CREATE UNIQUE INDEX "MilkTransfer_transferNumber_key" ON "MilkTransfer"("transferNumber");

-- CreateIndex
CREATE INDEX "MilkTransfer_date_status_idx" ON "MilkTransfer"("date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MilkSupplier_supplierNumber_key" ON "MilkSupplier"("supplierNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MilkSupplier_nationalId_key" ON "MilkSupplier"("nationalId");

-- CreateIndex
CREATE UNIQUE INDEX "MilkPrice_effectiveDate_key" ON "MilkPrice"("effectiveDate");

-- CreateIndex
CREATE INDEX "MilkDelivery_date_supplierId_idx" ON "MilkDelivery"("date", "supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessingBatch_batchNumber_key" ON "ProcessingBatch"("batchNumber");

-- CreateIndex
CREATE INDEX "ProcessingBatch_date_idx" ON "ProcessingBatch"("date");

-- CreateIndex
CREATE UNIQUE INDEX "ProductTransfer_transferNumber_key" ON "ProductTransfer"("transferNumber");

-- CreateIndex
CREATE INDEX "ProductTransfer_date_status_idx" ON "ProductTransfer"("date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Product_code_key" ON "Product"("code");

-- CreateIndex
CREATE INDEX "StockMovement_productId_location_idx" ON "StockMovement"("productId", "location");

-- CreateIndex
CREATE INDEX "StockMovement_date_location_idx" ON "StockMovement"("date", "location");

-- CreateIndex
CREATE INDEX "StockMovement_referenceType_referenceId_idx" ON "StockMovement"("referenceType", "referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_saleNumber_key" ON "Sale"("saleNumber");

-- CreateIndex
CREATE INDEX "Sale_date_idx" ON "Sale"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_registrationNumber_key" ON "Vehicle"("registrationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleDispatch_dispatchNumber_key" ON "VehicleDispatch"("dispatchNumber");

-- CreateIndex
CREATE INDEX "VehicleDispatch_date_status_idx" ON "VehicleDispatch"("date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DamageReplacement_recordNumber_key" ON "DamageReplacement"("recordNumber");

-- CreateIndex
CREATE INDEX "DamageReplacement_date_recordType_idx" ON "DamageReplacement"("date", "recordType");

-- CreateIndex
CREATE UNIQUE INDEX "StoreItem_code_key" ON "StoreItem"("code");

-- CreateIndex
CREATE INDEX "StoreItem_category_idx" ON "StoreItem"("category");

-- CreateIndex
CREATE UNIQUE INDEX "StoreReceipt_receiptNumber_key" ON "StoreReceipt"("receiptNumber");

-- CreateIndex
CREATE INDEX "StoreReceipt_date_idx" ON "StoreReceipt"("date");

-- CreateIndex
CREATE UNIQUE INDEX "StoreIssue_issueNumber_key" ON "StoreIssue"("issueNumber");

-- CreateIndex
CREATE INDEX "StoreIssue_date_department_idx" ON "StoreIssue"("date", "department");

-- CreateIndex
CREATE UNIQUE INDEX "CropFarm_farmNumber_key" ON "CropFarm"("farmNumber");

-- CreateIndex
CREATE INDEX "CropFarm_cropType_status_idx" ON "CropFarm"("cropType", "status");

-- CreateIndex
CREATE INDEX "CropStatusLog_date_idx" ON "CropStatusLog"("date");

-- CreateIndex
CREATE INDEX "CropHarvest_harvestDate_idx" ON "CropHarvest"("harvestDate");

-- CreateIndex
CREATE UNIQUE INDEX "Account_name_key" ON "Account"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_reference_key" ON "Transaction"("reference");

-- CreateIndex
CREATE INDEX "Transaction_date_type_category_idx" ON "Transaction"("date", "type", "category");

-- CreateIndex
CREATE INDEX "Transaction_sourceType_sourceId_idx" ON "Transaction"("sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "MilkPaymentRun_runNumber_key" ON "MilkPaymentRun"("runNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MilkPaymentRun_transactionId_key" ON "MilkPaymentRun"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberPayment_transactionId_key" ON "MemberPayment"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "Requisition_requisitionNumber_key" ON "Requisition"("requisitionNumber");

-- CreateIndex
CREATE INDEX "Requisition_department_status_createdAt_idx" ON "Requisition"("department", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_name_key" ON "Supplier"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_poNumber_key" ON "PurchaseOrder"("poNumber");

-- CreateIndex
CREATE INDEX "PurchaseOrder_date_status_idx" ON "PurchaseOrder"("date", "status");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryReview" ADD CONSTRAINT "SalaryReview_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplinaryCase" ADD CONSTRAINT "DisciplinaryCase_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Termination" ADD CONSTRAINT "Termination_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_predecessorId_fkey" FOREIGN KEY ("predecessorId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_damId_fkey" FOREIGN KEY ("damId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_sireId_fkey" FOREIGN KEY ("sireId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lactation" ADD CONSTRAINT "Lactation_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vaccination" ADD CONSTRAINT "Vaccination_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthRecord" ADD CONSTRAINT "HealthRecord_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilkRecord" ADD CONSTRAINT "MilkRecord_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilkDelivery" ADD CONSTRAINT "MilkDelivery_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "MilkSupplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilkDelivery" ADD CONSTRAINT "MilkDelivery_paymentRunId_fkey" FOREIGN KEY ("paymentRunId") REFERENCES "MilkPaymentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessingOutput" ADD CONSTRAINT "ProcessingOutput_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ProcessingBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessingOutput" ADD CONSTRAINT "ProcessingOutput_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductTransferItem" ADD CONSTRAINT "ProductTransferItem_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "ProductTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductTransferItem" ADD CONSTRAINT "ProductTransferItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalePayment" ADD CONSTRAINT "SalePayment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleDispatch" ADD CONSTRAINT "VehicleDispatch_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchItem" ADD CONSTRAINT "DispatchItem_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "VehicleDispatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchItem" ADD CONSTRAINT "DispatchItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DamageReplacement" ADD CONSTRAINT "DamageReplacement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DamageReplacement" ADD CONSTRAINT "DamageReplacement_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreReceipt" ADD CONSTRAINT "StoreReceipt_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "StoreItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreReceipt" ADD CONSTRAINT "StoreReceipt_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreReceipt" ADD CONSTRAINT "StoreReceipt_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreIssue" ADD CONSTRAINT "StoreIssue_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "StoreItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreIssue" ADD CONSTRAINT "StoreIssue_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "Requisition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CropStatusLog" ADD CONSTRAINT "CropStatusLog_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "CropFarm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CropHarvest" ADD CONSTRAINT "CropHarvest_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "CropFarm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilkPaymentLine" ADD CONSTRAINT "MilkPaymentLine_runId_fkey" FOREIGN KEY ("runId") REFERENCES "MilkPaymentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilkPaymentLine" ADD CONSTRAINT "MilkPaymentLine_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "MilkSupplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberPayment" ADD CONSTRAINT "MemberPayment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requisition" ADD CONSTRAINT "Requisition_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requisition" ADD CONSTRAINT "Requisition_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequisitionItem" ADD CONSTRAINT "RequisitionItem_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "Requisition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "Requisition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_storeItemId_fkey" FOREIGN KEY ("storeItemId") REFERENCES "StoreItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

