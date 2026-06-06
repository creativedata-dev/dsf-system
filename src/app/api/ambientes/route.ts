import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AuditAcao } from '@/generated/prisma/client'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const tenantId = session.user.tenantId

  const ambientes = await prisma.ambiente.findMany({
    where: { tenantId, ativo: true },
    orderBy: { nome: 'asc' },
  })

  return Response.json(ambientes)
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const perms = session.user.permissions as string[]
  if (!perms.includes('TEMPERATURA_GERENCIAR') && !perms.includes('SUPER_ADMIN_GLOBAIS')) {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const tenantId = session.user.tenantId
  const body = await request.json()
  const { nome, tipo, tempMin, tempMax, umidadeMin, umidadeMax } = body

  if (!nome?.trim()) return Response.json({ error: 'Nome obrigatório' }, { status: 400 })
  if (!tipo || !['GELADEIRA', 'AMBIENTE', 'SALA_ESPECIAL'].includes(tipo)) {
    return Response.json({ error: 'Tipo inválido' }, { status: 400 })
  }
  if (tempMin == null || tempMax == null) {
    return Response.json({ error: 'Limites de temperatura obrigatórios' }, { status: 400 })
  }
  if (tempMin >= tempMax) {
    return Response.json({ error: 'Temperatura mínima deve ser menor que a máxima' }, { status: 400 })
  }

  const ambiente = await prisma.ambiente.create({
    data: {
      tenantId,
      nome: nome.trim(),
      tipo,
      tempMin: parseFloat(tempMin),
      tempMax: parseFloat(tempMax),
      umidadeMin: umidadeMin != null ? parseFloat(umidadeMin) : null,
      umidadeMax: umidadeMax != null ? parseFloat(umidadeMax) : null,
    },
  })

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: session.user.id,
      acao: AuditAcao.AMBIENTE_CRIADO,
      recursoTipo: 'Ambiente',
      recursoId: ambiente.id,
      ip: request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown',
      userAgent: request.headers.get('user-agent') ?? 'unknown',
    },
  })

  return Response.json(ambiente, { status: 201 })
}
