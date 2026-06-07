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
  const tenants = await prisma.tenant.findMany({
    select: { id: true, nomeFantasia: true, cnpj: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })
  console.table(tenants.map(t => ({ ...t, createdAt: t.createdAt.toISOString().slice(0, 19) })))
  await prisma.$disconnect()
}
main().catch(console.error)
