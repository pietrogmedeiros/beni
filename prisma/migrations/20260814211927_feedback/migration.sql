-- CreateEnum
CREATE TYPE "FeedbackKind" AS ENUM ('PROBLEMA', 'IDEIA', 'ELOGIO', 'DUVIDA');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('NOVO', 'TRIADO', 'PLANEJADO', 'FAZENDO', 'FEITO', 'RECUSADO');

-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "feedbackId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "feedbackPromptedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "kind" "FeedbackKind" NOT NULL,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'NOVO',
    "message" TEXT NOT NULL,
    "pageUrl" TEXT,
    "appBuild" TEXT,
    "userAgent" TEXT,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "workspaceId" TEXT,
    "taskId" TEXT,
    "adminNote" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Feedback_status_createdAt_idx" ON "Feedback"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Feedback_userId_idx" ON "Feedback"("userId");

-- CreateIndex
CREATE INDEX "Attachment_feedbackId_idx" ON "Attachment"("feedbackId");

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "Feedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
