-- AlterTable
ALTER TABLE "UsageEvent" ADD COLUMN     "origem" TEXT;

-- CreateIndex
CREATE INDEX "UsageEvent_origem_createdAt_idx" ON "UsageEvent"("origem", "createdAt");
