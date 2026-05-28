-- CreateEnum
CREATE TYPE "TipoImpressao" AS ENUM ('BOBINA_80MM', 'FOLHA_A4');

-- AlterTable: adicionar logoUrl e tipoImpressao ao Tenant
ALTER TABLE "Tenant" ADD COLUMN "logoUrl" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "tipoImpressao" "TipoImpressao" NOT NULL DEFAULT 'BOBINA_80MM';
