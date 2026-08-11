-- CreateIndex
CREATE INDEX "Event_projectId_requestId_idx" ON "Event"("projectId", "requestId");

-- CreateIndex
CREATE INDEX "Event_projectId_traceId_idx" ON "Event"("projectId", "traceId");
