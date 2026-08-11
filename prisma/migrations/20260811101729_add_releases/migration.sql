-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "releaseId" TEXT;

-- CreateTable
CREATE TABLE "Release" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "traceCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Release_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Release_projectId_lastSeen_idx" ON "Release"("projectId", "lastSeen");

-- CreateIndex
CREATE INDEX "Release_projectId_version_idx" ON "Release"("projectId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Release_projectId_version_key" ON "Release"("projectId", "version");

-- CreateIndex
CREATE INDEX "Event_projectId_releaseId_idx" ON "Event"("projectId", "releaseId");

-- CreateIndex
CREATE INDEX "TelemetrySession_projectId_lastSeenAt_idx" ON "TelemetrySession"("projectId", "lastSeenAt");

-- CreateIndex
CREATE INDEX "TelemetrySession_projectId_crashedAt_idx" ON "TelemetrySession"("projectId", "crashedAt");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Release" ADD CONSTRAINT "Release_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
