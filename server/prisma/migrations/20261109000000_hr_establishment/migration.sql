-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "dependants" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "jobGroup" TEXT,
ADD COLUMN     "nextOfKinName" TEXT,
ADD COLUMN     "nextOfKinNationalId" TEXT,
ADD COLUMN     "nextOfKinPhone" TEXT;

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "successionReason" TEXT,
ADD COLUMN     "successionReasonOther" TEXT;

-- AlterTable
ALTER TABLE "Payroll" ALTER COLUMN "status" SET DEFAULT 'with_finance';

-- AlterTable
ALTER TABLE "SalaryReview" ADD COLUMN     "newJobGroup" TEXT,
ADD COLUMN     "previousJobGroup" TEXT;

-- CreateTable
CREATE TABLE "JobAdvert" (
    "id" TEXT NOT NULL,
    "advertNumber" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "department" "Department" NOT NULL,
    "jobGroup" TEXT,
    "employmentType" TEXT NOT NULL DEFAULT 'permanent',
    "posts" INTEGER NOT NULL DEFAULT 1,
    "advertDate" TIMESTAMP(3) NOT NULL,
    "closingDate" TIMESTAMP(3),
    "requirements" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobAdvert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobApplicant" (
    "id" TEXT NOT NULL,
    "advertId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "nationalId" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "qualifications" TEXT,
    "appliedOn" TIMESTAMP(3) NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'applied',
    "interviewDate" TIMESTAMP(3),
    "interviewPanel" TEXT,
    "interviewScore" DECIMAL(5,2),
    "interviewNotes" TEXT,
    "rejectionReason" TEXT,
    "employeeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobApplicant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobAdvert_advertNumber_key" ON "JobAdvert"("advertNumber");

-- CreateIndex
CREATE INDEX "JobAdvert_status_advertDate_idx" ON "JobAdvert"("status", "advertDate");

-- CreateIndex
CREATE UNIQUE INDEX "JobApplicant_employeeId_key" ON "JobApplicant"("employeeId");

-- CreateIndex
CREATE INDEX "JobApplicant_advertId_stage_idx" ON "JobApplicant"("advertId", "stage");

-- AddForeignKey
ALTER TABLE "JobApplicant" ADD CONSTRAINT "JobApplicant_advertId_fkey" FOREIGN KEY ("advertId") REFERENCES "JobAdvert"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplicant" ADD CONSTRAINT "JobApplicant_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Payroll goes to Accounts as soon as it is generated, so nothing waits for approval any more.
UPDATE "Payroll" SET "status" = 'with_finance' WHERE "status" IN ('draft', 'approved');

-- Successions recorded before reasons were kept: a deceased predecessor means death.
UPDATE "Member" AS successor
SET "successionReason" = 'death'
FROM "Member" AS predecessor
WHERE successor."predecessorId" = predecessor."id" AND predecessor."status" = 'deceased';
