-- Livestock: each animal belongs to a dairy (Dairy A milks morning and
-- evening, Dairy C also at midday); milk is weighed in kilograms; calvings
-- may be twins; vaccines and diseases come from lists; animals carry the
-- dates they joined and left the herd, for the herd report.

-- Animals: dairy, date bought or received, date they left the herd.
ALTER TABLE "Animal" ADD COLUMN     "acquiredDate" DATE,
ADD COLUMN     "dairy" TEXT NOT NULL DEFAULT 'dairy_a',
ADD COLUMN     "exitDate" DATE;

CREATE INDEX "Animal_dairy_status_idx" ON "Animal"("dairy", "status");

-- Only Dairy C milks at midday, so a cow milked at midday is at Dairy C.
UPDATE "Animal" SET "dairy" = 'dairy_c'
WHERE "id" IN (SELECT DISTINCT "animalId" FROM "MilkRecord" WHERE "session" = 'midday');

-- Animals already sold, dead or culled left the herd when last changed.
UPDATE "Animal" SET "exitDate" = "updatedAt"::date WHERE "status" <> 'active' AND "exitDate" IS NULL;

-- Milk records: kilograms (the figures stay as entered), and the dairy milked at.
ALTER TABLE "MilkRecord" RENAME COLUMN "litres" TO "kg";
ALTER TABLE "MilkRecord" ADD COLUMN     "dairy" TEXT NOT NULL DEFAULT 'dairy_a';
UPDATE "MilkRecord" m SET "dairy" = a."dairy" FROM "Animal" a WHERE m."animalId" = a."id";

-- Milk sent to MVA: kilograms too.
ALTER TABLE "MilkTransfer" RENAME COLUMN "litres" TO "kg";
ALTER TABLE "MilkTransfer" RENAME COLUMN "receivedLitres" TO "receivedKg";

-- Calvings: the calf (and a twin) link to the herd register.
ALTER TABLE "Lactation" ADD COLUMN     "twinCalfId" TEXT;
UPDATE "Lactation" SET "calfId" = NULL WHERE "calfId" IS NOT NULL AND "calfId" NOT IN (SELECT "id" FROM "Animal");
ALTER TABLE "Lactation" ADD CONSTRAINT "Lactation_calfId_fkey" FOREIGN KEY ("calfId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Lactation" ADD CONSTRAINT "Lactation_twinCalfId_fkey" FOREIGN KEY ("twinCalfId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Vaccines: FMD, LSD, Blanthax. Anything else typed before stays as typed.
UPDATE "Vaccination" SET "vaccine" = 'fmd' WHERE lower("vaccine") LIKE '%fmd%' OR lower("vaccine") LIKE '%foot%mouth%';
UPDATE "Vaccination" SET "vaccine" = 'lsd' WHERE lower("vaccine") LIKE '%lsd%' OR lower("vaccine") LIKE '%lumpy%';
UPDATE "Vaccination" SET "vaccine" = 'blanthax' WHERE lower("vaccine") LIKE '%blanthax%' OR lower("vaccine") LIKE '%anthrax%' OR lower("vaccine") LIKE '%black%quarter%';

-- Health: the disease from the list; what was typed stays as the details.
ALTER TABLE "HealthRecord" ADD COLUMN     "disease" TEXT,
ALTER COLUMN "condition" DROP NOT NULL;

CREATE INDEX "HealthRecord_disease_idx" ON "HealthRecord"("disease");

UPDATE "HealthRecord" h SET "disease" = m."disease"
FROM (VALUES
  ('ecf', '%ecf%'), ('ecf', '%east coast%'),
  ('trypanosomiasis', '%trypan%'),
  ('mastitis', '%mastitis%'),
  ('anaplasmosis', '%anaplas%'),
  ('pneumonia', '%pneumonia%'),
  ('ephemeral_fever', '%ephemeral%'),
  ('foot_rot', '%foot rot%'), ('foot_rot', '%footrot%'),
  ('injuries', '%injur%'),
  ('retained_afterbirth', '%afterbirth%'), ('retained_afterbirth', '%after birth%'),
  ('abortions', '%abort%'),
  ('pink_eye', '%pink eye%'), ('pink_eye', '%pinkeye%'),
  ('abscess', '%abscess%'), ('abscess', '%absecess%'),
  ('prolapse', '%prolapse%')
) AS m("disease", "pattern")
WHERE h."recordType" IN ('disease', 'treatment') AND h."disease" IS NULL AND lower(h."condition") LIKE m."pattern";

-- A disease case not on the list is "Other", its name kept in the details.
UPDATE "HealthRecord" SET "disease" = 'other' WHERE "recordType" = 'disease' AND "disease" IS NULL;
