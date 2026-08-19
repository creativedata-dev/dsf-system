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
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  let body: { dsfId: string }
  try { body = await request.json() } catch {
    return Response.json({ error: 'Corpo inválido' }, { status: 400 })
  }

  if (!body.dsfId) return Response.json({ error: 'dsfId obrigatório' }, { status: 400 })

  const tenantId = session.user.tenantId

  const dsf = await prisma.dSF.findUnique({
    where: { id: body.dsfId },
    select: {
      id: true, tenantId: true, status: true, numeroDsf: true, observacoes: true,
      cliente: { select: { id: true, nome: true, email: true } },
      responsavelTecnico: { select: { nome: true, crf: true } },
    },
  })

  if (!dsf || dsf.tenantId !== tenantId) {
    return Response.json({ error: 'DSF não encontrada' }, { status: 404 })
  }
  if (dsf.status !== DsfStatus.CANCELADA) {
    return Response.json({ error: 'Apenas DSFs canceladas podem ser reabertas' }, { status: 409 })
  }

  // Remove a marcação de cancelamento das observações
  const obsLimpa = (dsf.observacoes ?? '')
    .replace(/^\[CANCELADA[^\]]*\]\s*/i, '')
    .trim() || null

  await prisma.dSF.update({
    where: { id: body.dsfId },
    data: { status: DsfStatus.EMITIDA, observacoes: obsLimpa },
  })

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  await prisma.auditLog.create({
    data: {
      tenantId, userId: session.user.id,
      acao: AuditAcao.DSF_CONCLUIDA,
      recursoTipo: 'DSF', recursoId: dsf.id,
      ip, userAgent: request.headers.get('user-agent') ?? 'unknown',
    },
  })

  return Response.json({
    ok: true,
    dsfId: dsf.id,
    numeroDsf: dsf.numeroDsf,
    clienteNome: dsf.cliente.nome,
    clienteEmail: dsf.cliente.email,
    rtNome: dsf.responsavelTecnico.nome,
    rtCrf: dsf.responsavelTecnico.crf,
  })
}
