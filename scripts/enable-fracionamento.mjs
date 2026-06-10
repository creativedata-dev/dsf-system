import { PrismaClient } from '../src/generated/prisma/index.js'
const prisma = new PrismaClient()

const tenants = await prisma.tenant.findMany({
  select: { id: true, nomeFantasia: true, modulosHabilitados: true }
})
console.log('Tenants:', JSON.stringify(tenants, null, 2))

for (const t of tenants) {
  if (!t.modulosHabilitados.includes('FRACIONAMENTO')) {
    const updated = await prisma.tenant.update({
      where: { id: t.id },
      data: { modulosHabilitados: [...t.modulosHabilitados, 'FRACIONAMENTO'] },
      select: { nomeFantasia: true, modulosHabilitados: true }
    })
    console.log(`✓ FRACIONAMENTO adicionado a: ${updated.nomeFantasia}`)
    console.log('  Módulos:', updated.modulosHabilitados.join(', '))
  } else {
    console.log(`– ${t.nomeFantasia}: FRACIONAMENTO já habilitado`)
  }
}

await prisma.$disconnect()
