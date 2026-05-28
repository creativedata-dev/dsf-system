-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR', 'ATENDENTE', 'RESPONSAVEL_TECNICO');

-- CreateEnum
CREATE TYPE "DsfStatus" AS ENUM ('EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoServico" AS ENUM ('INJECAO', 'TESTE_RAPIDO', 'AFERICAO_PA', 'AFERICAO_GLICEMIA', 'AFERICAO_TEMPERATURA', 'AFERICAO_SATURACAO', 'PERFURACAO_LOBULO', 'OUTRO');

-- CreateEnum
CREATE TYPE "AuditAcao" AS ENUM ('LOGIN', 'LOGOUT', 'CLIENTE_CRIADO', 'CLIENTE_ATUALIZADO', 'DSF_CRIADA', 'DSF_CONCLUIDA', 'DSF_CANCELADA', 'DSF_VISUALIZADA', 'DRIVE_AUTORIZADO', 'DRIVE_REVOGADO', 'USUARIO_CRIADO', 'USUARIO_ATUALIZADO', 'CRON_CLEANUP_DSF');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "nomeFantasia" TEXT NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "endereco" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "alvaraSanitario" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "crf" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "rg" TEXT,
    "dataNascimento" DATE NOT NULL,
    "sexo" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "email" TEXT,
    "endereco" TEXT NOT NULL,
    "consentimentoLgpdAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DSF" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "numeroDsf" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "responsavelTecnicoId" TEXT NOT NULL,
    "atendenteId" TEXT NOT NULL,
    "tipoServico" "TipoServico" NOT NULL,
    "dataEmissao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observacoes" TEXT,
    "status" "DsfStatus" NOT NULL DEFAULT 'EM_ANDAMENTO',
    "driveFileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DSF_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsumoDSF" (
    "id" TEXT NOT NULL,
    "dsfId" TEXT NOT NULL,
    "nomeProduto" TEXT NOT NULL,
    "lote" TEXT NOT NULL,
    "fabricante" TEXT NOT NULL,
    "validade" DATE NOT NULL,
    "quantidade" DECIMAL(10,3) NOT NULL,
    "unidade" TEXT NOT NULL,

    CONSTRAINT "InsumoDSF_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriveCredential" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiry" TIMESTAMP(3) NOT NULL,
    "driveFolderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriveCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "userId" TEXT,
    "acao" "AuditAcao" NOT NULL,
    "recursoTipo" TEXT NOT NULL,
    "recursoId" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_cnpj_key" ON "Tenant"("cnpj");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");

-- CreateIndex
CREATE INDEX "Cliente_tenantId_idx" ON "Cliente"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_tenantId_cpf_key" ON "Cliente"("tenantId", "cpf");

-- CreateIndex
CREATE INDEX "DSF_tenantId_idx" ON "DSF"("tenantId");

-- CreateIndex
CREATE INDEX "DSF_tenantId_dataEmissao_idx" ON "DSF"("tenantId", "dataEmissao" DESC);

-- CreateIndex
CREATE INDEX "DSF_clienteId_idx" ON "DSF"("clienteId");

-- CreateIndex
CREATE INDEX "DSF_status_updatedAt_idx" ON "DSF"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DSF_tenantId_numeroDsf_key" ON "DSF"("tenantId", "numeroDsf");

-- CreateIndex
CREATE INDEX "InsumoDSF_dsfId_idx" ON "InsumoDSF"("dsfId");

-- CreateIndex
CREATE UNIQUE INDEX "DriveCredential_tenantId_key" ON "DriveCredential"("tenantId");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_idx" ON "AuditLog"("tenantId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DSF" ADD CONSTRAINT "DSF_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DSF" ADD CONSTRAINT "DSF_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DSF" ADD CONSTRAINT "DSF_responsavelTecnicoId_fkey" FOREIGN KEY ("responsavelTecnicoId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DSF" ADD CONSTRAINT "DSF_atendenteId_fkey" FOREIGN KEY ("atendenteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsumoDSF" ADD CONSTRAINT "InsumoDSF_dsfId_fkey" FOREIGN KEY ("dsfId") REFERENCES "DSF"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriveCredential" ADD CONSTRAINT "DriveCredential_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
