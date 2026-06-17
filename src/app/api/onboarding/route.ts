import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// Rate-limit simples em memória: 1 tentativa por IP/minuto
const rateMap = new Map<string, number>()

function getIp(req: NextRequest) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
}

function checkRate(ip: string): boolean {
  const now = Date.now()
  const last = rateMap.get(ip) ?? 0
  if (now - last < 60_000) return false
  rateMap.set(ip, now)
  return true
}

export async function POST(req: NextRequest) {
  const ip = getIp(req)
  if (!checkRate(ip)) {
    return NextResponse.json({ error: 'Muitas tentativas. Aguarde 1 minuto.' }, { status: 429 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const { nomeFantasia, responsavelNome, email, senha } = body as Record<string, string>

  // Validações básicas
  if (!nomeFantasia?.trim() || nomeFantasia.trim().length < 3) {
    return NextResponse.json({ error: 'Nome da farmácia deve ter ao menos 3 caracteres.' }, { status: 422 })
  }
  if (!responsavelNome?.trim() || responsavelNome.trim().length < 3) {
    return NextResponse.json({ error: 'Nome do responsável deve ter ao menos 3 caracteres.' }, { status: 422 })
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!email?.trim() || !emailRegex.test(email.trim())) {
    return NextResponse.json({ error: 'E-mail inválido.' }, { status: 422 })
  }
  if (!senha || senha.length < 8) {
    return NextResponse.json({ error: 'A senha deve ter ao menos 8 caracteres.' }, { status: 422 })
  }

  const emailNorm = email.trim().toLowerCase()

  // Verificar e-mail já cadastrado (email é único por tenant, mas verificamos globalmente)
  const emailExistente = await prisma.user.findFirst({ where: { email: emailNorm } })
  if (emailExistente) {
    return NextResponse.json({ error: 'Este e-mail já está cadastrado. Faça login ou use outro endereço.' }, { status: 409 })
  }

  // Buscar plano TRIAL ativo
  const plano = await prisma.plano.findFirst({
    where: { tipo: 'TRIAL', ativo: true },
    orderBy: { createdAt: 'asc' },
  })
  if (!plano) {
    return NextResponse.json({ error: 'Serviço temporariamente indisponível. Entre em contato com o suporte.' }, { status: 503 })
  }

  const trialDias = plano.trialDias ?? 14
  const trialExpiraEm = new Date(Date.now() + trialDias * 24 * 60 * 60 * 1000)

  const senhaHash = await bcrypt.hash(senha, 12)

  // Criar tenant — telefone/CNPJ/endereço preenchidos depois nas configurações
  const tenant = await prisma.tenant.create({
    data: {
      nomeFantasia: nomeFantasia.trim(),
      tipoImpressao: 'BOBINA_80MM',
      modulosHabilitados: [],
    },
  })

  // Criar usuário administrador (todas as permissões exceto SUPER_ADMIN_GLOBAIS)
  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      nome: responsavelNome.trim(),
      email: emailNorm,
      senhaHash,
      permissions: [
        'CLIENTE_BUSCAR',
        'CLIENTE_CADASTRAR',
        'DSF_EMITIR',
        'DSF_CANCELAR',
        'ANVISA_RELATORIOS',
        'DRIVE_CONFIGURAR',
        'TEMPERATURA_GERENCIAR',
        'EQUIPAMENTOS_GERENCIAR',
        'POPS_GERENCIAR',
        'VALIDADE_GERENCIAR',
        'PAINEL_FISCAL_GERENCIAR',
        'FRACIONAMENTO_GERENCIAR',
      ],
    },
  })

  // Criar assinatura trial
  await prisma.assinatura.create({
    data: {
      tenantId: tenant.id,
      planoId: plano.id,
      status: 'TRIAL',
      trialExpiraEm,
    },
  })

  // Audit log
  await prisma.auditLog.create({
    data: {
      tenantId: tenant.id,
      userId: user.id,
      acao: 'TENANT_CRIADO',
      recursoTipo: 'Tenant',
      recursoId: tenant.id,
      ip,
      userAgent: req.headers.get('user-agent') ?? '',
    },
  })

  return NextResponse.json({ ok: true, email: emailNorm })
}
