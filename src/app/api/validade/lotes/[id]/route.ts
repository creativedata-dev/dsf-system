import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
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

  const lote = await prisma.loteProduto.findFirst({ where: { id, tenantId } })
  if (!lote) return NextResponse.json({ error: 'Lote não encontrado' }, { status: 404 })

  const { fabricante, lote: numeroLote, validade, quantidade, unidade, localizacao, obs, ativo } = body
  const updateData: Record<string, unknown> = {}
  if (fabricante !== undefined) updateData.fabricante = fabricante
  if (numeroLote !== undefined) updateData.lote = numeroLote
  if (validade !== undefined) updateData.validade = new Date(validade)
  if (quantidade !== undefined) updateData.quantidade = quantidade
  if (unidade !== undefined) updateData.unidade = unidade
  if (localizacao !== undefined) updateData.localizacao = localizacao
  if (obs !== undefined) updateData.obs = obs
  if (ativo !== undefined) updateData.ativo = ativo

  await prisma.loteProduto.update({ where: { id }, data: updateData })

  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const userAgent = req.headers.get('user-agent') ?? 'unknown'
  await prisma.auditLog.create({
    data: { tenantId, userId, acao: 'LOTE_ATUALIZADO', recursoTipo: 'LoteProduto', recursoId: id, ip, userAgent },
  })

  return NextResponse.json({ ok: true })
}
