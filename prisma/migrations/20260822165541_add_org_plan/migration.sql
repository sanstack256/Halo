-- CreateEnum
CREATE TYPE "OrganizationPlan" AS ENUM ('FREE', 'DEVELOPER', 'TEAM');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "plan" "OrganizationPlan" NOT NULL DEFAULT 'FREE';
