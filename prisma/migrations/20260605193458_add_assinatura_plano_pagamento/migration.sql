-- CreateEnum
CREATE TYPE "TipoPlano" AS ENUM ('TRIAL', 'MENSAL', 'ANUAL', 'VITALICIO');

-- CreateEnum
CREATE TYPE "StatusAssinatura" AS ENUM ('TRIAL', 'ATIVA', 'SUSPENSA', 'CANCELADA', 'EXPIRADA');

-- CreateEnum
CREATE TYPE "StatusPagamento" AS ENUM ('PENDENTE', 'APROVADO', 'RECUSADO', 'REEMBOLSADO', 'ESTORNADO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAcao" ADD VALUE 'ASSINATURA_CRIADA';
ALTER TYPE "AuditAcao" ADD VALUE 'ASSINATURA_ATUALIZADA';
ALTER TYPE "AuditAcao" ADD VALUE 'ASSINATURA_CANCELADA';
ALTER TYPE "AuditAcao" ADD VALUE 'ASSINATURA_EXPIRADA';
ALTER TYPE "AuditAcao" ADD VALUE 'PAGAMENTO_REGISTRADO';
ALTER TYPE "AuditAcao" ADD VALUE 'PLANO_CRIADO';
ALTER TYPE "AuditAcao" ADD VALUE 'PLANO_ATUALIZADO';

-- CreateTable
CREATE TABLE "Plano" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" "TipoPlano" NOT NULL,
    "precoMensal" INTEGER,
    "precoAnual" INTEGER,
    "limiteUsuarios" INTEGER,
    "limiteDsfsMes" INTEGER,
    "trialDias" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plano_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assinatura" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planoId" TEXT NOT NULL,
    "status" "StatusAssinatura" NOT NULL DEFAULT 'TRIAL',
    "inicioEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEm" TIMESTAMP(3),
    "trialExpiraEm" TIMESTAMP(3),
    "canceladaEm" TIMESTAMP(3),
    "motivoCancelamento" TEXT,
    "gateway" TEXT,
    "gatewayCustomerId" TEXT,
    "gatewaySubscriptionId" TEXT,
    "obs" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assinatura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PagamentoLog" (
    "id" TEXT NOT NULL,
    "assinaturaId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "valor" INTEGER NOT NULL,
    "moeda" TEXT NOT NULL DEFAULT 'BRL',
    "status" "StatusPagamento" NOT NULL,
    "gateway" TEXT NOT NULL,
    "gatewayPaymentId" TEXT,
    "descricao" TEXT,
    "metadados" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PagamentoLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Assinatura_tenantId_key" ON "Assinatura"("tenantId");

-- CreateIndex
CREATE INDEX "Assinatura_status_expiraEm_idx" ON "Assinatura"("status", "expiraEm");

-- CreateIndex
CREATE INDEX "PagamentoLog_assinaturaId_idx" ON "PagamentoLog"("assinaturaId");

-- CreateIndex
CREATE INDEX "PagamentoLog_tenantId_createdAt_idx" ON "PagamentoLog"("tenantId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "Assinatura" ADD CONSTRAINT "Assinatura_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assinatura" ADD CONSTRAINT "Assinatura_planoId_fkey" FOREIGN KEY ("planoId") REFERENCES "Plano"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagamentoLog" ADD CONSTRAINT "PagamentoLog_assinaturaId_fkey" FOREIGN KEY ("assinaturaId") REFERENCES "Assinatura"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
