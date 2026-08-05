/*
  Warnings:

  - You are about to drop the column `occurrenceCount` on the `Issue` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Event" ALTER COLUMN "severity" SET DEFAULT 'INFO';

-- AlterTable
ALTER TABLE "Issue" DROP COLUMN "occurrenceCount",
ADD COLUMN     "eventCount" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "severity" "EventSeverity" NOT NULL DEFAULT 'INFO';
