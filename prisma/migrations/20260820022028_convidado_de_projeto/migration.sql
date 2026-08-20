-- CreateTable
CREATE TABLE "ProjectAccess" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "concedidoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectInvite" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "criadoPorId" TEXT,
    "aceitoEm" TIMESTAMP(3),
    "expiraEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectAccess_userId_idx" ON "ProjectAccess"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectAccess_projectId_userId_key" ON "ProjectAccess"("projectId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectInvite_token_key" ON "ProjectInvite"("token");

-- CreateIndex
CREATE INDEX "ProjectInvite_token_idx" ON "ProjectInvite"("token");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectInvite_projectId_email_key" ON "ProjectInvite"("projectId", "email");

-- AddForeignKey
ALTER TABLE "ProjectAccess" ADD CONSTRAINT "ProjectAccess_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAccess" ADD CONSTRAINT "ProjectAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAccess" ADD CONSTRAINT "ProjectAccess_concedidoPorId_fkey" FOREIGN KEY ("concedidoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectInvite" ADD CONSTRAINT "ProjectInvite_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectInvite" ADD CONSTRAINT "ProjectInvite_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

