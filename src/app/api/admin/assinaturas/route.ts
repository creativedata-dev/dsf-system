import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AuditAcao, StatusAssinatura } from '@/generated/prisma/client'

// GET — assinatura de um tenant (?tenantId=)
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const perms = session.user.permissions as string[]
  if (!perms.includes('SUPER_ADMIN_GLOBAIS')) {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const tenantId = searchParams.get('tenantId')
  if (!tenantId) return Response.json({ error: 'tenantId obrigatório' }, { status: 400 })

  const assinatura = await prisma.assinatura.findUnique({
    where: { tenantId },
    include: {
      plano: true,
      pagamentos: { orderBy: { createdAt: 'desc' }, take: 50 },
    },
  })

  return Response.json({ assinatura })
}

// POST — cria ou substitui assinatura de um tenant
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const perms = session.user.permissions as string[]
  if (!perms.includes('SUPER_ADMIN_GLOBAIS')) {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  let body: {
    tenantId: string; planoId: string; status: string
    expiraEm?: string | null; trialExpiraEm?: string | null
    gateway?: string | null; gatewayCustomerId?: string | null
    gatewaySubscriptionId?: string | null; obs?: string | null
  }
  try { body = await request.json() } catch {
    return Response.json({ error: 'Corpo inválido' }, { status: 400 })
  }

  if (!body.tenantId || !body.planoId || !Object.values(StatusAssinatura).includes(body.status as StatusAssinatura)) {
    return Response.json({ error: 'tenantId, planoId e status válido são obrigatórios' }, { status: 400 })
  }

  const plano = await prisma.plano.findUnique({ where: { id: body.planoId } })
  if (!plano) return Response.json({ error: 'Plano não encontrado' }, { status: 404 })

  // Calcular expiraEm automaticamente se não informado
  let expiraEm: Date | null = body.expiraEm ? new Date(body.expiraEm) : null
  let trialExpiraEm: Date | null = body.trialExpiraEm ? new Date(body.trialExpiraEm) : null

  if (!expiraEm) {
    const hoje = new Date()
    if (plano.tipo === 'TRIAL' && plano.trialDias) {
      expiraEm = new Date(hoje)
      expiraEm.setDate(expiraEm.getDate() + plano.trialDias)
      trialExpiraEm = expiraEm
    } else if (plano.tipo === 'MENSAL') {
      expiraEm = new Date(hoje)
      expiraEm.setMonth(expiraEm.getMonth() + 1)
    } else if (plano.tipo === 'ANUAL') {
      expiraEm = new Date(hoje)
      expiraEm.setFullYear(expiraEm.getFullYear() + 1)
    }
    // VITALICIO: expiraEm permanece null
  }

  const data = {
    planoId: body.planoId,
    status: body.status as StatusAssinatura,
    inicioEm: new Date(),
    expiraEm,
    trialExpiraEm,
    canceladaEm: null,
    motivoCancelamento: null,
    gateway: body.gateway ?? null,
    gatewayCustomerId: body.gatewayCustomerId ?? null,
    gatewaySubscriptionId: body.gatewaySubscriptionId ?? null,
    obs: body.obs?.trim() ?? null,
  }

  const assinatura = await prisma.assinatura.upsert({
    where: { tenantId: body.tenantId },
    create: { tenantId: body.tenantId, ...data },
    update: data,
    include: { plano: true },
  })

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  await prisma.auditLog.create({
    data: {
      tenantId: body.tenantId, userId: session.user.id,
      acao: AuditAcao.ASSINATURA_CRIADA, recursoTipo: 'Assinatura', recursoId: assinatura.id,
      ip, userAgent: request.headers.get('user-agent') ?? 'unknown',
    },
  })

  return Response.json({ assinatura })
}
