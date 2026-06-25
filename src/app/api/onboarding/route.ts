import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

// Rate-limit por email: máx 5 tentativas por hora
const rateMap = new Map<string, { count: number; windowStart: number }>()

function checkRate(key: string): boolean {
  const now = Date.now()
  const entry = rateMap.get(key)
  if (!entry || now - entry.windowStart > 3_600_000) {
    rateMap.set(key, { count: 1, windowStart: now })
    return true
  }
  if (entry.count >= 5) return false
  entry.count++
  return true
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS_HEADERS })
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  let body: unknown
  try { body = await req.json() } catch {
    return json({ error: 'JSON inválido.' }, 400)
  }

  const { nomeFantasia, responsavelNome, email, senha } = body as Record<string, string>

  if (!checkRate(email?.trim()?.toLowerCase() ?? 'unknown')) {
    return json({ error: 'Muitas tentativas para este e-mail. Tente novamente em 1 hora.' }, 429)
  }

  // Validações básicas
  if (!nomeFantasia?.trim() || nomeFantasia.trim().length < 3) {
    return json({ error: 'Nome da farmácia deve ter ao menos 3 caracteres.' }, 422)
  }
  if (!responsavelNome?.trim() || responsavelNome.trim().length < 3) {
    return json({ error: 'Nome do responsável deve ter ao menos 3 caracteres.' }, 422)
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!email?.trim() || !emailRegex.test(email.trim())) {
    return json({ error: 'E-mail inválido.' }, 422)
  }
  if (!senha || senha.length < 8) {
    return json({ error: 'A senha deve ter ao menos 8 caracteres.' }, 422)
  }

  const emailNorm = email.trim().toLowerCase()

  // Verificar e-mail já cadastrado (email é único por tenant, mas verificamos globalmente)
  const emailExistente = await prisma.user.findFirst({ where: { email: emailNorm } })
  if (emailExistente) {
    return json({ error: 'Este e-mail já está cadastrado. Faça login ou use outro endereço.' }, 409)
  }

  // Buscar plano TRIAL ativo
  const plano = await prisma.plano.findFirst({
    where: { tipo: 'TRIAL', ativo: true },
    orderBy: { createdAt: 'asc' },
  })
  if (!plano) {
    return json({ error: 'Serviço temporariamente indisponível. Entre em contato com o suporte.' }, 503)
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

  return json({ ok: true, email: emailNorm })
}
