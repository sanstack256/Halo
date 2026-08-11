-- AlterEnum
ALTER TYPE "EventType" ADD VALUE 'TRACE';

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "durationMs" INTEGER,
ADD COLUMN     "operation" TEXT,
ADD COLUMN     "resource" TEXT,
ADD COLUMN     "service" TEXT,
ADD COLUMN     "sessionId" TEXT,
ADD COLUMN     "status" TEXT;

-- CreateTable
CREATE TABLE "TelemetrySession" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "userKey" TEXT,
    "release" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "crashedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelemetrySession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TelemetrySession_projectId_startedAt_idx" ON "TelemetrySession"("projectId", "startedAt");

-- CreateIndex
CREATE INDEX "TelemetrySession_projectId_release_idx" ON "TelemetrySession"("projectId", "release");

-- CreateIndex
CREATE INDEX "TelemetrySession_projectId_userKey_idx" ON "TelemetrySession"("projectId", "userKey");

-- CreateIndex
CREATE INDEX "Event_projectId_timestamp_idx" ON "Event"("projectId", "timestamp");

-- CreateIndex
CREATE INDEX "Event_projectId_type_timestamp_idx" ON "Event"("projectId", "type", "timestamp");

-- CreateIndex
CREATE INDEX "Event_projectId_release_idx" ON "Event"("projectId", "release");

-- CreateIndex
CREATE INDEX "Event_sessionId_idx" ON "Event"("sessionId");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TelemetrySession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelemetrySession" ADD CONSTRAINT "TelemetrySession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelemetrySession" ADD CONSTRAINT "TelemetrySession_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
