-- Males are not kept in a dairy: the dairy is where a female is kept and milked.
ALTER TABLE "Animal" ALTER COLUMN "dairy" DROP NOT NULL,
ALTER COLUMN "dairy" DROP DEFAULT;

UPDATE "Animal" SET "dairy" = NULL WHERE "sex" = 'male';
