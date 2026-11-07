-- Crop register details used by the monthly, quarterly, half-year and
-- annual crop reports. All columns are optional, so existing farms and
-- harvests are unchanged.

-- AlterTable
ALTER TABLE "CropFarm" ADD COLUMN     "cycleStartDate" DATE,
ADD COLUMN     "dailyTarget" DECIMAL(12,2),
ADD COLUMN     "expectedTch" DECIMAL(8,2),
ADD COLUMN     "hectares" DECIMAL(10,2),
ADD COLUMN     "longFarmNumber" TEXT,
ADD COLUMN     "variety" TEXT;

-- AlterTable
ALTER TABLE "CropHarvest" ADD COLUMN     "target" DECIMAL(12,2);

-- Farms registered before status history was kept get one entry with their
-- current status, so period reports have a starting point.
INSERT INTO "CropStatusLog" ("id", "farmId", "date", "status", "note", "createdAt")
SELECT gen_random_uuid()::text, f."id", COALESCE(f."plantingDate"::date, f."createdAt"::date), f."status",
       f."statusNote", CURRENT_TIMESTAMP
FROM "CropFarm" f
WHERE NOT EXISTS (SELECT 1 FROM "CropStatusLog" l WHERE l."farmId" = f."id");
