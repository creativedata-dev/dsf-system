-- Onboarding: campos não obrigatórios para cadastro via landing page
ALTER TABLE "Tenant" ALTER COLUMN "razaoSocial" DROP NOT NULL;
ALTER TABLE "Tenant" ALTER COLUMN "cnpj" DROP NOT NULL;
ALTER TABLE "Tenant" ALTER COLUMN "endereco" DROP NOT NULL;
ALTER TABLE "Tenant" ALTER COLUMN "telefone" DROP NOT NULL;
ALTER TABLE "Tenant" ALTER COLUMN "alvaraSanitario" DROP NOT NULL;
