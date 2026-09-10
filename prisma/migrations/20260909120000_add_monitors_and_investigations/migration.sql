-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "MonitorType" AS ENUM ('ERROR', 'METRIC', 'CRON', 'UPTIME', 'MOBILE_BUILD');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "MonitorStatus" AS ENUM ('HEALTHY', 'FIRING', 'MUTED', 'DISABLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "MonitorSeverity" AS ENUM ('INFO', 'WARNING', 'ERROR', 'FATAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "MonitorAlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'WEBHOOK', 'IN_APP');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "NotificationOutcome" AS ENUM ('PENDING', 'DELIVERED', 'FAILED', 'SKIPPED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "InvestigationStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Monitor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "MonitorType" NOT NULL DEFAULT 'ERROR',
    "status" "MonitorStatus" NOT NULL DEFAULT 'HEALTHY',
    "severity" "MonitorSeverity" NOT NULL DEFAULT 'ERROR',
    "projectId" TEXT NOT NULL,
    "environmentId" TEXT,
    "creatorId" TEXT,
    "thresholdValue" DOUBLE PRECISION,
    "thresholdWindow" INTEGER,
    "query" TEXT,
    "cronSchedule" TEXT,
    "endpointUrl" TEXT,
    "lastTriggeredAt" TIMESTAMP(3),
    "lastEvaluatedAt" TIMESTAMP(3),
    "incidentCount" INTEGER NOT NULL DEFAULT 0,
    "alertConfig" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Monitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MonitorAlert" (
    "id" TEXT NOT NULL,
    "monitorId" TEXT NOT NULL,
    "status" "MonitorAlertStatus" NOT NULL DEFAULT 'OPEN',
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "conditionSummary" TEXT NOT NULL,
    "observedValue" DOUBLE PRECISION,
    "thresholdValue" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonitorAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MonitorAlertNotification" (
    "id" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'EMAIL',
    "destination" TEXT,
    "outcome" "NotificationOutcome" NOT NULL DEFAULT 'PENDING',
    "failReason" TEXT,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonitorAlertNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Investigation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "issueId" TEXT,
    "monitorId" TEXT,
    "alertId" TEXT,
    "status" "InvestigationStatus" NOT NULL DEFAULT 'COMPLETED',
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "rootCause" TEXT,
    "confidenceScore" DOUBLE PRECISION,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "evidenceCount" INTEGER NOT NULL DEFAULT 0,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Investigation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Monitor_projectId_type_idx" ON "Monitor"("projectId", "type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Monitor_projectId_status_idx" ON "Monitor"("projectId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Monitor_status_idx" ON "Monitor"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MonitorAlert_monitorId_idx" ON "MonitorAlert"("monitorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MonitorAlert_status_idx" ON "MonitorAlert"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MonitorAlert_triggeredAt_idx" ON "MonitorAlert"("triggeredAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MonitorAlertNotification_alertId_idx" ON "MonitorAlertNotification"("alertId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Investigation_alertId_key" ON "Investigation"("alertId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Investigation_projectId_createdAt_idx" ON "Investigation"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Investigation_monitorId_idx" ON "Investigation"("monitorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Investigation_issueId_idx" ON "Investigation"("issueId");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Monitor" ADD CONSTRAINT "Monitor_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Monitor" ADD CONSTRAINT "Monitor_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "MonitorAlert" ADD CONSTRAINT "MonitorAlert_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "Monitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "MonitorAlertNotification" ADD CONSTRAINT "MonitorAlertNotification_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "MonitorAlert"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Investigation" ADD CONSTRAINT "Investigation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Investigation" ADD CONSTRAINT "Investigation_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Investigation" ADD CONSTRAINT "Investigation_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "Monitor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Investigation" ADD CONSTRAINT "Investigation_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "MonitorAlert"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
