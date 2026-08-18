-- CreateEnum
CREATE TYPE "CobrancaTipo" AS ENUM ('PARCELADO', 'MENSAL', 'AVULSO');

-- CreateEnum
CREATE TYPE "ParcelaStatus" AS ENUM ('PENDENTE', 'PAGO', 'CANCELADO');

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "contato" TEXT,
    "documento" TEXT,
    "observacao" TEXT,
    "arquivado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cobranca" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "tipo" "CobrancaTipo" NOT NULL,
    "projectId" TEXT NOT NULL,
    "valorCentavos" INTEGER NOT NULL,
    "parcelasTotal" INTEGER,
    "primeiroVencimento" TIMESTAMP(3) NOT NULL,
    "diaVencimento" INTEGER,
    "encerradaEm" TIMESTAMP(3),
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cobranca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parcela" (
    "id" TEXT NOT NULL,
    "cobrancaId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "vencimento" TIMESTAMP(3) NOT NULL,
    "valorCentavos" INTEGER NOT NULL,
    "status" "ParcelaStatus" NOT NULL DEFAULT 'PENDENTE',
    "pagoEm" TIMESTAMP(3),
    "valorPagoCentavos" INTEGER,
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Parcela_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Cliente_ownerId_arquivado_idx" ON "Cliente"("ownerId", "arquivado");

-- CreateIndex
CREATE INDEX "Cobranca_ownerId_idx" ON "Cobranca"("ownerId");

-- CreateIndex
CREATE INDEX "Cobranca_projectId_idx" ON "Cobranca"("projectId");

-- CreateIndex
CREATE INDEX "Cobranca_clienteId_idx" ON "Cobranca"("clienteId");

-- CreateIndex
CREATE INDEX "Parcela_status_vencimento_idx" ON "Parcela"("status", "vencimento");

-- CreateIndex
CREATE UNIQUE INDEX "Parcela_cobrancaId_numero_key" ON "Parcela"("cobrancaId", "numero");

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cobranca" ADD CONSTRAINT "Cobranca_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cobranca" ADD CONSTRAINT "Cobranca_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cobranca" ADD CONSTRAINT "Cobranca_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcela" ADD CONSTRAINT "Parcela_cobrancaId_fkey" FOREIGN KEY ("cobrancaId") REFERENCES "Cobranca"("id") ON DELETE CASCADE ON UPDATE CASCADE;

