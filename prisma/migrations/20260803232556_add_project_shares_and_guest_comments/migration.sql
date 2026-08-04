-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "guestEmail" TEXT,
ADD COLUMN     "guestName" TEXT,
ALTER COLUMN "authorId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ProjectShare" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "view" TEXT NOT NULL DEFAULT 'gantt',
    "allowComments" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectShare_token_key" ON "ProjectShare"("token");

-- CreateIndex
CREATE INDEX "ProjectShare_projectId_idx" ON "ProjectShare"("projectId");

-- AddForeignKey
ALTER TABLE "ProjectShare" ADD CONSTRAINT "ProjectShare_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectShare" ADD CONSTRAINT "ProjectShare_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
