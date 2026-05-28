import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AuditAcao, DsfStatus } from '@/generated/prisma/client'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const perms = session.user.permissions as string[]
  if (!perms.includes('DSF_CANCELAR')) {
    return Response.json({ error: 'Sem permissão para cancelar DSF' }, { status: 403 })
  }

  let body: { dsfId: string; motivo?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Corpo inválido' }, { status: 400 })
  }

  const { dsfId, motivo } = body
  if (!dsfId) return Response.json({ error: 'dsfId é obrigatório' }, { status: 400 })

  const tenantId = session.user.tenantId

  const dsf = await prisma.dSF.findUnique({
    where: { id: dsfId },
    select: { id: true, tenantId: true, status: true, numeroDsf: true },
  })

  if (!dsf || dsf.tenantId !== tenantId) {
    return Response.json({ error: 'DSF não encontrada' }, { status: 404 })
  }

  if (dsf.status === DsfStatus.CANCELADA) {
    return Response.json({ error: 'DSF já está cancelada' }, { status: 409 })
  }

  const observacoesUpdate = motivo ? `[CANCELADA: ${motivo.trim()}]` : '[CANCELADA]'

  await prisma.dSF.update({
    where: { id: dsfId },
    data: {
      status: DsfStatus.CANCELADA,
      observacoes: observacoesUpdate,
    },
  })

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown'
  const ua = request.headers.get('user-agent') ?? 'unknown'

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: session.user.id,
      acao: AuditAcao.DSF_CANCELADA,
      recursoTipo: 'DSF',
      recursoId: dsfId,
      ip,
      userAgent: ua,
    },
  })

  return Response.json({ ok: true, numeroDsf: dsf.numeroDsf })
}
