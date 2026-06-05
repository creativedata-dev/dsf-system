import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AuditAcao, StatusAssinatura } from '@/generated/prisma/client'

// PATCH — atualiza assinatura existente (cancelar, suspender, reativar, trocar plano)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const perms = session.user.permissions as string[]
  if (!perms.includes('SUPER_ADMIN_GLOBAIS')) {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { id } = await params

  let body: {
    status?: string; planoId?: string; expiraEm?: string | null
    motivoCancelamento?: string | null; gateway?: string | null
    gatewayCustomerId?: string | null; gatewaySubscriptionId?: string | null
    obs?: string | null
  }
  try { body = await request.json() } catch {
    return Response.json({ error: 'Corpo inválido' }, { status: 400 })
  }

  const existing = await prisma.assinatura.findUnique({ where: { id } })
  if (!existing) return Response.json({ error: 'Assinatura não encontrada' }, { status: 404 })

  const data: Record<string, unknown> = {}
  if (body.status !== undefined) {
    if (!Object.values(StatusAssinatura).includes(body.status as StatusAssinatura)) {
      return Response.json({ error: 'status inválido' }, { status: 400 })
    }
    data.status = body.status
    if (body.status === 'CANCELADA') data.canceladaEm = new Date()
  }
  if (body.planoId !== undefined) data.planoId = body.planoId
  if (body.expiraEm !== undefined) data.expiraEm = body.expiraEm ? new Date(body.expiraEm) : null
  if (body.motivoCancelamento !== undefined) data.motivoCancelamento = body.motivoCancelamento
  if (body.gateway !== undefined) data.gateway = body.gateway
  if (body.gatewayCustomerId !== undefined) data.gatewayCustomerId = body.gatewayCustomerId
  if (body.gatewaySubscriptionId !== undefined) data.gatewaySubscriptionId = body.gatewaySubscriptionId
  if (body.obs !== undefined) data.obs = body.obs?.trim() || null

  const assinatura = await prisma.assinatura.update({
    where: { id },
    data,
    include: { plano: true, pagamentos: { orderBy: { createdAt: 'desc' }, take: 50 } },
  })

  const acao = body.status === 'CANCELADA' ? AuditAcao.ASSINATURA_CANCELADA : AuditAcao.ASSINATURA_ATUALIZADA
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  await prisma.auditLog.create({
    data: {
      tenantId: assinatura.tenantId, userId: session.user.id,
      acao, recursoTipo: 'Assinatura', recursoId: id,
      ip, userAgent: request.headers.get('user-agent') ?? 'unknown',
    },
  })

  return Response.json({ assinatura })
}
