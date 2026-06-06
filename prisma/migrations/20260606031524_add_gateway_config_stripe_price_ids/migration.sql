-- AlterTable
ALTER TABLE "Plano" ADD COLUMN     "stripeAnnualPriceId" TEXT,
ADD COLUMN     "stripeMonthlyPriceId" TEXT,
ADD COLUMN     "stripeOnetimePriceId" TEXT;

-- CreateTable
CREATE TABLE "GatewayConfig" (
    "id" TEXT NOT NULL,
    "gateway" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "secretKeyEncrypted" TEXT,
    "webhookSecretEncrypted" TEXT,
    "publicKey" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT false,
    "modoTeste" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GatewayConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GatewayConfig_gateway_key" ON "GatewayConfig"("gateway");
