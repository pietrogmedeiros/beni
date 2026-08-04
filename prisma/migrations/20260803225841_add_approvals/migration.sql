-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "requestedById" TEXT,
    "message" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approverName" TEXT,
    "approverEmail" TEXT,
    "approverComment" TEXT,
    "decidedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Approval_token_key" ON "Approval"("token");

-- CreateIndex
CREATE INDEX "Approval_taskId_idx" ON "Approval"("taskId");

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
