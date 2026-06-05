import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env'), override: true })

import { PrismaClient, Permission, TipoPlano, StatusAssinatura } from '../src/generated/prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { neonConfig } from '@neondatabase/serverless'
import ws from 'ws'
import bcrypt from 'bcryptjs'

neonConfig.webSocketConstructor = ws

async function main() {
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! })
  const prisma = new PrismaClient({ adapter })

  // ─── TENANT 1: SaaS Core (tenant administrativo do sistema) ──────────────────

  const tenantSaaS = await prisma.tenant.upsert({
    where: { cnpj: '00.000.000/0000-00' },
    update: {},
    create: {
      nomeFantasia: 'SaaS Core',
      razaoSocial: 'DSF System Tecnologia Ltda',
      cnpj: '00.000.000/0000-00',
      endereco: 'Av. Paulista, 1000 - Bela Vista, São Paulo/SP',
      telefone: '(11) 99000-0000',
      alvaraSanitario: 'N/A',
    },
  })

  const superAdminHash = await bcrypt.hash('Super@123', 12)
  const superAdmin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenantSaaS.id, email: 'super@dsfsystem.com' } },
    update: { nome: 'Super Admin do SaaS', senhaHash: superAdminHash, permissions: [Permission.SUPER_ADMIN_GLOBAIS] },
    create: {
      tenantId: tenantSaaS.id,
      nome: 'Super Admin do SaaS',
      email: 'super@dsfsystem.com',
      senhaHash: superAdminHash,
      permissions: [Permission.SUPER_ADMIN_GLOBAIS],
    },
  })

  // ─── TENANT 2: Drogaria Rio (primeiro cliente piloto) ────────────────────────

  const tenantDrogaria = await prisma.tenant.upsert({
    where: { cnpj: '00.000.000/0001-00' },
    update: {},
    create: {
      nomeFantasia: 'Drogaria Rio',
      razaoSocial: 'Drogaria Rio Ltda',
      cnpj: '00.000.000/0001-00',
      endereco: 'Rua das Flores, 123 - Centro, Rio de Janeiro/RJ',
      telefone: '(21) 99999-0000',
      alvaraSanitario: 'ALVARA-2024-RJ-00001',
    },
  })

  // Dono/Gestor — acumula função administrativa e farmacêutica
  const carlosHash = await bcrypt.hash('Admin@123', 12)
  const carlosPerms = [
    Permission.CLIENTE_BUSCAR,
    Permission.CLIENTE_CADASTRAR,
    Permission.DSF_EMITIR,
    Permission.DSF_CANCELAR,
    Permission.ANVISA_RELATORIOS,
    Permission.DRIVE_CONFIGURAR,
  ]
  const carlos = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenantDrogaria.id, email: 'admin@drogariario.com' } },
    update: { nome: 'Carlos Dono e Gestor', senhaHash: carlosHash, permissions: carlosPerms, crf: 'CRF-SP-11111' },
    create: {
      tenantId: tenantDrogaria.id,
      nome: 'Carlos Dono e Gestor',
      email: 'admin@drogariario.com',
      senhaHash: carlosHash,
      permissions: carlosPerms,
      crf: 'CRF-SP-11111',
    },
  })

  // Farmacêutico Pleno
  const robertoHash = await bcrypt.hash('Farma@123', 12)
  const robertoPerms = [Permission.CLIENTE_BUSCAR, Permission.DSF_EMITIR, Permission.ANVISA_RELATORIOS]
  const roberto = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenantDrogaria.id, email: 'farmaceutico@drogariario.com' } },
    update: { nome: 'Dr. Roberto Farmacêutico Pleno', senhaHash: robertoHash, permissions: robertoPerms, crf: 'CRF-SP-22222' },
    create: {
      tenantId: tenantDrogaria.id,
      nome: 'Dr. Roberto Farmacêutico Pleno',
      email: 'farmaceutico@drogariario.com',
      senhaHash: robertoHash,
      permissions: robertoPerms,
      crf: 'CRF-SP-22222',
    },
  })

  // Atendente de Balcão
  const julianaHash = await bcrypt.hash('Atend@123', 12)
  const julianaPerms = [Permission.CLIENTE_BUSCAR, Permission.CLIENTE_CADASTRAR, Permission.DSF_EMITIR]
  const juliana = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenantDrogaria.id, email: 'atendente@drogariario.com' } },
    update: { nome: 'Juliana Atendente Balcão', senhaHash: julianaHash, permissions: julianaPerms },
    create: {
      tenantId: tenantDrogaria.id,
      nome: 'Juliana Atendente Balcão',
      email: 'atendente@drogariario.com',
      senhaHash: julianaHash,
      permissions: julianaPerms,
    },
  })

  // ─── Planos padrão ────────────────────────────────────────────────────────────

  const planosData = [
    {
      nome: 'Trial',
      descricao: '14 dias gratuitos para conhecer o FarmaSign.',
      tipo: TipoPlano.TRIAL,
      precoMensal: null, precoAnual: null,
      limiteUsuarios: 2, limiteDsfsMes: 30, trialDias: 14,
    },
    {
      nome: 'Mensal',
      descricao: 'Acesso completo com cobrança mensal.',
      tipo: TipoPlano.MENSAL,
      precoMensal: 9900, precoAnual: null,
      limiteUsuarios: null, limiteDsfsMes: null, trialDias: null,
    },
    {
      nome: 'Anual',
      descricao: 'Acesso completo com desconto no pagamento anual.',
      tipo: TipoPlano.ANUAL,
      precoMensal: null, precoAnual: 99000,
      limiteUsuarios: null, limiteDsfsMes: null, trialDias: null,
    },
    {
      nome: 'Vitalício',
      descricao: 'Pagamento único, acesso para sempre.',
      tipo: TipoPlano.VITALICIO,
      precoMensal: null, precoAnual: null,
      limiteUsuarios: null, limiteDsfsMes: null, trialDias: null,
    },
  ]

  const planosMap: Record<string, string> = {}
  for (const p of planosData) {
    const existing = await prisma.plano.findFirst({ where: { tipo: p.tipo } })
    if (existing) {
      planosMap[p.tipo] = existing.id
    } else {
      const criado = await prisma.plano.create({ data: p })
      planosMap[p.tipo] = criado.id
    }
  }

  // ─── Assinatura trial para Drogaria Rio (se não existir) ──────────────────────

  const assinaturaExistente = await prisma.assinatura.findUnique({ where: { tenantId: tenantDrogaria.id } })
  if (!assinaturaExistente) {
    const trialExpiraEm = new Date()
    trialExpiraEm.setDate(trialExpiraEm.getDate() + 14)
    await prisma.assinatura.create({
      data: {
        tenantId: tenantDrogaria.id,
        planoId: planosMap[TipoPlano.TRIAL],
        status: StatusAssinatura.TRIAL,
        trialExpiraEm,
        expiraEm: trialExpiraEm,
      },
    })
  }

  await prisma.$disconnect()

  console.log('\n✅ Seed concluído\n')
  console.log('── TENANT 1: SaaS Core ─────────────────────────────────────────')
  console.log(`   ${superAdmin.nome.padEnd(30)} ${superAdmin.email}  →  Super@123`)
  console.log('── TENANT 2: Drogaria Rio ──────────────────────────────────────')
  console.log(`   ${carlos.nome.padEnd(30)} ${carlos.email}  →  Admin@123  (CRF: ${carlos.crf})`)
  console.log(`   ${roberto.nome.padEnd(30)} ${roberto.email}  →  Farma@123  (CRF: ${roberto.crf})`)
  console.log(`   ${juliana.nome.padEnd(30)} ${juliana.email}  →  Atend@123`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
