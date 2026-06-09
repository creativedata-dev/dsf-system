import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasModulo } from '@/lib/modulos'

// PATCH /api/fracionamento/[id] — atualiza destinação de uma fração
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { tenantId, id: userId, permissions } = session.user
  const { id } = await params

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { modulosHabilitados: true },
  })
  if (!hasModulo(tenant?.modulosHabilitados ?? [], 'FRACIONAMENTO')) {
    return NextResponse.json({ error: 'Módulo não habilitado' }, { status: 403 })
  }
  if (!permissions.includes('FRACIONAMENTO_GERENCIAR') && !permissions.includes('SUPER_ADMIN_GLOBAIS')) {
    return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 })
  }

  const fracao = await prisma.fracaoItem.findUnique({ where: { id } })
  if (!fracao || fracao.tenantId !== tenantId) {
    return NextResponse.json({ error: 'Fração não encontrada' }, { status: 404 })
  }

  const body = await req.json()
  const updated = await prisma.fracaoItem.update({
    where: { id },
    data: { destinacao: body.destinacao ?? fracao.destinacao },
  })

  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  const userAgent = req.headers.get('user-agent') ?? 'unknown'
  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      acao: 'FRACAO_ATUALIZADA',
      recursoTipo: 'FracaoItem',
      recursoId: id,
      ip,
      userAgent,
    },
  })

  return NextResponse.json(updated)
}
