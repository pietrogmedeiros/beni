-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "noteId" TEXT,
ALTER COLUMN "taskId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Sem título',
    "icon" TEXT,
    "blocks" JSONB NOT NULL DEFAULT '[]',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteShare" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdById" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Note_projectId_idx" ON "Note"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "NoteShare_noteId_key" ON "NoteShare"("noteId");

-- CreateIndex
CREATE UNIQUE INDEX "NoteShare_token_key" ON "NoteShare"("token");

-- CreateIndex
CREATE INDEX "Attachment_noteId_idx" ON "Attachment"("noteId");

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteShare" ADD CONSTRAINT "NoteShare_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;
