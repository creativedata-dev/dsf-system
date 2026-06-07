import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env'), override: true })

import { PrismaClient, Permission, StatusAssinatura } from '../src/generated/prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { neonConfig } from '@neondatabase/serverless'
import ws from 'ws'
import bcrypt from 'bcryptjs'
neonConfig.webSocketConstructor = ws

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  // ── Tenant 1: Farmácia São Lucas ─────────────────────────────────────────────
  const tenant1 = await prisma.tenant.upsert({
    where: { cnpj: '12345678000191' },
    update: {},
    create: {
      nomeFantasia: 'Farmácia São Lucas',
      razaoSocial: 'São Lucas Drogarias Ltda',
      cnpj: '12345678000191',
      endereco: 'Rua das Palmeiras, 456 - Jardim América, São Paulo/SP',
      telefone: '(11) 98765-4321',
      alvaraSanitario: 'ALVARA-2024-SP-00042',
      tipoImpressao: 'BOBINA_80MM',
    },
  })

  const senhaGestor1 = await bcrypt.hash('Farma@2024', 12)
  const senhaTec1   = await bcrypt.hash('Farma@2024', 12)
  const senhaAtend1 = await bcrypt.hash('Farma@2024', 12)

  const gestor1 = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant1.id, email: 'gestor@saolucas.com' } },
    update: {},
    create: {
      tenantId: tenant1.id,
      nome: 'Ana Paula Gestor',
      email: 'gestor@saolucas.com',
      senhaHash: senhaGestor1,
      permissions: [
        Permission.CLIENTE_BUSCAR, Permission.CLIENTE_CADASTRAR,
        Permission.DSF_EMITIR, Permission.DSF_CANCELAR,
        Permission.ANVISA_RELATORIOS, Permission.DRIVE_CONFIGURAR,
      ],
      crf: 'CRF-SP-33333',
    },
  })

  const tec1 = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant1.id, email: 'farmaceutico@saolucas.com' } },
    update: {},
    create: {
      tenantId: tenant1.id,
      nome: 'Dr. Paulo Farmacêutico',
      email: 'farmaceutico@saolucas.com',
      senhaHash: senhaTec1,
      permissions: [Permission.CLIENTE_BUSCAR, Permission.DSF_EMITIR, Permission.ANVISA_RELATORIOS],
      crf: 'CRF-SP-44444',
    },
  })

  const atend1 = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant1.id, email: 'atendente@saolucas.com' } },
    update: {},
    create: {
      tenantId: tenant1.id,
      nome: 'Lucas Atendente',
      email: 'atendente@saolucas.com',
      senhaHash: senhaAtend1,
      permissions: [Permission.CLIENTE_BUSCAR, Permission.CLIENTE_CADASTRAR, Permission.DSF_EMITIR],
    },
  })

  // ── Tenant 2: Drogaria Central ───────────────────────────────────────────────
  const tenant2 = await prisma.tenant.upsert({
    where: { cnpj: '98765432000155' },
    update: {},
    create: {
      nomeFantasia: 'Drogaria Central',
      razaoSocial: 'Central Farmacias Eireli',
      cnpj: '98765432000155',
      endereco: 'Av. Brasil, 1200 - Centro, Belo Horizonte/MG',
      telefone: '(31) 97654-3210',
      alvaraSanitario: 'ALVARA-2024-MG-00078',
      tipoImpressao: 'FOLHA_A4',
    },
  })

  const senhaGestor2 = await bcrypt.hash('Farma@2024', 12)
  const senhaAtend2  = await bcrypt.hash('Farma@2024', 12)

  const gestor2 = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant2.id, email: 'gestor@drogcentral.com' } },
    update: {},
    create: {
      tenantId: tenant2.id,
      nome: 'Maria Gestora',
      email: 'gestor@drogcentral.com',
      senhaHash: senhaGestor2,
      permissions: [
        Permission.CLIENTE_BUSCAR, Permission.CLIENTE_CADASTRAR,
        Permission.DSF_EMITIR, Permission.DSF_CANCELAR,
        Permission.ANVISA_RELATORIOS, Permission.DRIVE_CONFIGURAR,
      ],
      crf: 'CRF-MG-55555',
    },
  })

  const atend2 = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant2.id, email: 'atendente@drogcentral.com' } },
    update: {},
    create: {
      tenantId: tenant2.id,
      nome: 'João Atendente',
      email: 'atendente@drogcentral.com',
      senhaHash: senhaAtend2,
      permissions: [Permission.CLIENTE_BUSCAR, Permission.CLIENTE_CADASTRAR, Permission.DSF_EMITIR],
    },
  })

  // ── Assinaturas Trial para os dois tenants ────────────────────────────────────
  const planoTrial = await prisma.plano.findFirst({ where: { tipo: 'TRIAL' } })

  if (planoTrial) {
    for (const tenantId of [tenant1.id, tenant2.id]) {
      const existente = await prisma.assinatura.findUnique({ where: { tenantId } })
      if (!existente) {
        const trialExpiraEm = new Date()
        trialExpiraEm.setDate(trialExpiraEm.getDate() + 14)
        await prisma.assinatura.create({
          data: {
            tenantId,
            planoId: planoTrial.id,
            status: StatusAssinatura.TRIAL,
            trialExpiraEm,
            expiraEm: trialExpiraEm,
          },
        })
      }
    }
  }

  await prisma.$disconnect()

  console.log('\n✅ Tenants e usuários criados\n')
  console.log('── Farmácia São Lucas ──────────────────────────────────────────')
  console.log(`   ${gestor1.nome.padEnd(28)} ${gestor1.email.padEnd(35)} → Farma@2024  (CRF: ${gestor1.crf})`)
  console.log(`   ${tec1.nome.padEnd(28)} ${tec1.email.padEnd(35)} → Farma@2024  (CRF: ${tec1.crf})`)
  console.log(`   ${atend1.nome.padEnd(28)} ${atend1.email.padEnd(35)} → Farma@2024`)
  console.log('── Drogaria Central ────────────────────────────────────────────')
  console.log(`   ${gestor2.nome.padEnd(28)} ${gestor2.email.padEnd(35)} → Farma@2024  (CRF: ${gestor2.crf})`)
  console.log(`   ${atend2.nome.padEnd(28)} ${atend2.email.padEnd(35)} → Farma@2024`)
}

main().catch((e) => { console.error(e); process.exit(1) })
