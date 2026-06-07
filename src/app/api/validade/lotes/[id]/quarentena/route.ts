import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { tenantId, id: userId, permissions } = session.user
  if (!permissions.includes('VALIDADE_GERENCIAR') && !permissions.includes('SUPER_ADMIN_GLOBAIS')) {
    return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const { obs } = body

  const lote = await prisma.loteProduto.findFirst({ where: { id, tenantId, ativo: true } })
  if (!lote) return NextResponse.json({ error: 'Lote não encontrado' }, { status: 404 })
  if (lote.status === 'DESCARTADO') {
    return NextResponse.json({ error: 'Lote já descartado' }, { status: 400 })
  }

  await prisma.loteProduto.update({
    where: { id },
    data: { status: 'QUARENTENA', obs: obs ?? lote.obs },
  })

  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const userAgent = req.headers.get('user-agent') ?? 'unknown'
  await prisma.auditLog.create({
    data: { tenantId, userId, acao: 'LOTE_QUARENTENA', recursoTipo: 'LoteProduto', recursoId: id, ip, userAgent },
  })

  return NextResponse.json({ ok: true, status: 'QUARENTENA' })
}
