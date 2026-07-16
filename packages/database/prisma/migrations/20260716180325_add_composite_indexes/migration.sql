-- CreateIndex
CREATE INDEX "Clip_projectId_finalScore_idx" ON "Clip"("projectId", "finalScore");

-- CreateIndex
CREATE INDEX "Project_userId_createdAt_idx" ON "Project"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Project_status_updatedAt_idx" ON "Project"("status", "updatedAt");
