/*
  Warnings:

  - The values [INJECAO,TESTE_RAPIDO,AFERICAO_PA,AFERICAO_GLICEMIA,AFERICAO_SATURACAO,OUTRO] on the enum `TipoServico` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "TipoServico_new" AS ENUM ('AFERICAO_PRESSAO_ARTERIAL', 'AFERICAO_TEMPERATURA', 'GLICEMIA_CAPILAR', 'TESTE_RAPIDO_COVID19', 'TESTE_RAPIDO_DENGUE', 'TESTE_RAPIDO_INFLUENZA', 'TESTE_RAPIDO_BETA_HCG', 'TESTE_RAPIDO_PERFIL_LIPIDICO', 'ADMINISTRACAO_INJETAVEIS', 'INALACAO_NEBULIZACAO', 'PERFURACAO_LOBULO');
ALTER TABLE "DSF" ALTER COLUMN "tipoServico" TYPE "TipoServico_new" USING ("tipoServico"::text::"TipoServico_new");
ALTER TYPE "TipoServico" RENAME TO "TipoServico_old";
ALTER TYPE "TipoServico_new" RENAME TO "TipoServico";
DROP TYPE "public"."TipoServico_old";
COMMIT;
