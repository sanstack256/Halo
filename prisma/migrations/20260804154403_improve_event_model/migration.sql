/*
  Warnings:

  - Added the required column `severity` to the `Event` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "EventSeverity" AS ENUM ('INFO', 'WARNING', 'ERROR', 'FATAL');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "release" TEXT,
ADD COLUMN     "sdkName" TEXT,
ADD COLUMN     "sdkVersion" TEXT,
ADD COLUMN     "severity" "EventSeverity" NOT NULL;
