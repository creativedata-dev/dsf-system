/*
  Warnings:

  - You are about to drop the column `role` on the `User` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "Permission" AS ENUM ('CLIENTE_BUSCAR', 'CLIENTE_CADASTRAR', 'DSF_EMITIR', 'DSF_CANCELAR', 'ANVISA_RELATORIOS', 'DRIVE_CONFIGURAR', 'SUPER_ADMIN_GLOBAIS');

-- AlterTable
ALTER TABLE "User" DROP COLUMN "role",
ADD COLUMN     "permissions" "Permission"[] DEFAULT ARRAY['CLIENTE_BUSCAR', 'DSF_EMITIR']::"Permission"[];

-- DropEnum
DROP TYPE "Role";
