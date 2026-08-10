import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AuditAcao, TipoPlano } from '@/generated/prisma/client'

// GET — lista todos os planos (super admin)
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const perms = session.user.permissions as string[]
  if (!perms.includes('SUPER_ADMIN_GLOBAIS')) {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const planos = await prisma.plano.findMany({
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { assinaturas: true } } },
  })

  return Response.json({ planos })
}

// POST — cria novo plano (super admin)
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const perms = session.user.permissions as string[]
  if (!perms.includes('SUPER_ADMIN_GLOBAIS')) {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  let body: {
    nome: string; descricao?: string; tipo: string
    precoMensal?: number | null; precoAnual?: number | null
    limiteUsuarios?: number | null; limiteDsfsMes?: number | null
    trialDias?: number | null; ativo?: boolean
    modulosHabilitados?: string[]
  }
  try { body = await request.json() } catch {
    return Response.json({ error: 'Corpo inválido' }, { status: 400 })
  }

  if (!body.nome?.trim() || !Object.values(TipoPlano).includes(body.tipo as TipoPlano)) {
    return Response.json({ error: 'nome e tipo válido são obrigatórios' }, { status: 400 })
  }

  const plano = await prisma.plano.create({
    data: {
      nome: body.nome.trim(),
      descricao: body.descricao?.trim() || null,
      tipo: body.tipo as TipoPlano,
      precoMensal: body.precoMensal ?? null,
      precoAnual: body.precoAnual ?? null,
      limiteUsuarios: body.limiteUsuarios ?? null,
      limiteDsfsMes: body.limiteDsfsMes ?? null,
      trialDias: body.trialDias ?? null,
      modulosHabilitados: body.modulosHabilitados ?? [],
      ativo: body.ativo ?? true,
    },
  })

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  await prisma.auditLog.create({
    data: {
      tenantId: null, userId: session.user.id,
      acao: AuditAcao.PLANO_CRIADO, recursoTipo: 'Plano', recursoId: plano.id,
      ip, userAgent: request.headers.get('user-agent') ?? 'unknown',
    },
  })

  return Response.json({ plano }, { status: 201 })
}

// PATCH — atualiza plano (super admin)
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const perms = session.user.permissions as string[]
  if (!perms.includes('SUPER_ADMIN_GLOBAIS')) {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  let body: { id: string; nome?: string; descricao?: string; precoMensal?: number | null; precoAnual?: number | null; limiteUsuarios?: number | null; limiteDsfsMes?: number | null; trialDias?: number | null; ativo?: boolean; modulosHabilitados?: string[] }
  try { body = await request.json() } catch {
    return Response.json({ error: 'Corpo inválido' }, { status: 400 })
  }

  if (!body.id) return Response.json({ error: 'id obrigatório' }, { status: 400 })

  const data: Record<string, unknown> = {}
  if (body.nome !== undefined) data.nome = body.nome.trim()
  if (body.descricao !== undefined) data.descricao = body.descricao?.trim() || null
  if (body.precoMensal !== undefined) data.precoMensal = body.precoMensal
  if (body.precoAnual !== undefined) data.precoAnual = body.precoAnual
  if (body.limiteUsuarios !== undefined) data.limiteUsuarios = body.limiteUsuarios
  if (body.limiteDsfsMes !== undefined) data.limiteDsfsMes = body.limiteDsfsMes
  if (body.trialDias !== undefined) data.trialDias = body.trialDias
  if (body.modulosHabilitados !== undefined) data.modulosHabilitados = body.modulosHabilitados
  if (body.ativo !== undefined) data.ativo = body.ativo

  const plano = await prisma.plano.update({ where: { id: body.id }, data })

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  await prisma.auditLog.create({
    data: {
      tenantId: null, userId: session.user.id,
      acao: AuditAcao.PLANO_ATUALIZADO, recursoTipo: 'Plano', recursoId: plano.id,
      ip, userAgent: request.headers.get('user-agent') ?? 'unknown',
    },
  })

  return Response.json({ plano })
}
