-- CreateTable
CREATE TABLE "ProcedimentoConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipoServico" "TipoServico" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "textoOrientacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcedimentoConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProcedimentoConfig_tenantId_idx" ON "ProcedimentoConfig"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcedimentoConfig_tenantId_tipoServico_key" ON "ProcedimentoConfig"("tenantId", "tipoServico");

-- AddForeignKey
ALTER TABLE "ProcedimentoConfig" ADD CONSTRAINT "ProcedimentoConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
