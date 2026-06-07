import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env'), override: true })

import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { neonConfig } from '@neondatabase/serverless'
import ws from 'ws'
neonConfig.webSocketConstructor = ws

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

// IDs dos tenants duplicados criados pelo seed em 05/06
const IDS_PARA_DELETAR = [
  '810eda6c-36b9-4faf-9dc2-c314c8c041ab', // SaaS Core duplicado
  'b2757f9a-52b3-4149-91ad-4a69d136fb83', // Drogaria Rio seed
]

async function main() {
  for (const tenantId of IDS_PARA_DELETAR) {
    // Deletar dependências na ordem correta (NeonHttp: sem cascade automático)
    await prisma.auditLog.deleteMany({ where: { tenantId } })
    await prisma.procedimentoConfig.deleteMany({ where: { tenantId } })
    await prisma.assinatura.deleteMany({ where: { tenantId } })
    await prisma.driveCredential.deleteMany({ where: { tenantId } })

    // Usuários do tenant
    const users = await prisma.user.findMany({ where: { tenantId }, select: { id: true } })
    for (const u of users) {
      await prisma.auditLog.deleteMany({ where: { userId: u.id } })
    }
    await prisma.user.deleteMany({ where: { tenantId } })

    // Clientes e DSFs
    const dsfs = await prisma.dSF.findMany({ where: { tenantId }, select: { id: true } })
    for (const d of dsfs) {
      await prisma.insumoDSF.deleteMany({ where: { dsfId: d.id } })
    }
    await prisma.dSF.deleteMany({ where: { tenantId } })
    await prisma.cliente.deleteMany({ where: { tenantId } })

    await prisma.tenant.delete({ where: { id: tenantId } })
    console.log(`✔ Tenant ${tenantId} deletado`)
  }

  console.log('\n✅ Limpeza concluída')
  await prisma.$disconnect()
}
main().catch(console.error)
