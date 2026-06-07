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

async function main() {
  const planos = await prisma.plano.findMany({ orderBy: { createdAt: 'asc' } })
  console.log('Planos:', planos.length)
  console.table(planos.map(p => ({ nome: p.nome, tipo: p.tipo, id: p.id.slice(0, 8) })))

  const assinaturas = await prisma.assinatura.findMany({ select: { tenantId: true, status: true, planoId: true } })
  console.log('\nAssinaturas:', assinaturas.length)
  console.table(assinaturas)
  await prisma.$disconnect()
}
main().catch(console.error)
