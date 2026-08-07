-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "breadcrumbs" JSONB,
ADD COLUMN     "fingerprint" TEXT,
ADD COLUMN     "stack" TEXT,
ADD COLUMN     "tags" JSONB;

-- AlterTable
ALTER TABLE "Issue" ADD COLUMN     "lastEventId" TEXT;
