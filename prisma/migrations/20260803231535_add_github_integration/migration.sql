-- CreateEnum
CREATE TYPE "GithubLinkType" AS ENUM ('ISSUE', 'PULL_REQUEST');

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "githubToken" TEXT;

-- CreateTable
CREATE TABLE "GithubRepo" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "htmlUrl" TEXT NOT NULL,
    "description" TEXT,
    "defaultBranch" TEXT NOT NULL DEFAULT 'main',
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GithubRepo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskGithubLink" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "repoId" TEXT NOT NULL,
    "type" "GithubLinkType" NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "htmlUrl" TEXT NOT NULL,
    "author" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskGithubLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GithubRepo_projectId_owner_name_key" ON "GithubRepo"("projectId", "owner", "name");

-- CreateIndex
CREATE INDEX "TaskGithubLink_taskId_idx" ON "TaskGithubLink"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskGithubLink_taskId_repoId_number_key" ON "TaskGithubLink"("taskId", "repoId", "number");

-- AddForeignKey
ALTER TABLE "GithubRepo" ADD CONSTRAINT "GithubRepo_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskGithubLink" ADD CONSTRAINT "TaskGithubLink_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskGithubLink" ADD CONSTRAINT "TaskGithubLink_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "GithubRepo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
