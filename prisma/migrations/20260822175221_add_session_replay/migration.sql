-- CreateEnum
CREATE TYPE "ReplayStatus" AS ENUM ('RECORDING', 'PROCESSING', 'AVAILABLE', 'EXPIRED', 'DISABLED', 'ERROR');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "replayConfig" JSONB;

-- CreateTable
CREATE TABLE "ReplaySession" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "issueId" TEXT,
    "traceId" TEXT,
    "requestId" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "device" TEXT,
    "url" TEXT,
    "userAgent" TEXT,
    "viewportWidth" INTEGER,
    "viewportHeight" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "errorAt" TIMESTAMP(3),
    "status" "ReplayStatus" NOT NULL DEFAULT 'RECORDING',
    "totalDurationMs" INTEGER,
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReplaySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReplayChunk" (
    "id" TEXT NOT NULL,
    "replaySessionId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "events" JSONB NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "eventCount" INTEGER NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReplayChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReplaySession_sessionId_key" ON "ReplaySession"("sessionId");

-- CreateIndex
CREATE INDEX "ReplaySession_projectId_startedAt_idx" ON "ReplaySession"("projectId", "startedAt");

-- CreateIndex
CREATE INDEX "ReplaySession_projectId_status_idx" ON "ReplaySession"("projectId", "status");

-- CreateIndex
CREATE INDEX "ReplaySession_issueId_idx" ON "ReplaySession"("issueId");

-- CreateIndex
CREATE INDEX "ReplaySession_sessionId_idx" ON "ReplaySession"("sessionId");

-- CreateIndex
CREATE INDEX "ReplaySession_expiresAt_idx" ON "ReplaySession"("expiresAt");

-- CreateIndex
CREATE INDEX "ReplayChunk_replaySessionId_sequence_idx" ON "ReplayChunk"("replaySessionId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "ReplayChunk_replaySessionId_sequence_key" ON "ReplayChunk"("replaySessionId", "sequence");

-- AddForeignKey
ALTER TABLE "ReplaySession" ADD CONSTRAINT "ReplaySession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplaySession" ADD CONSTRAINT "ReplaySession_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplayChunk" ADD CONSTRAINT "ReplayChunk_replaySessionId_fkey" FOREIGN KEY ("replaySessionId") REFERENCES "ReplaySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
