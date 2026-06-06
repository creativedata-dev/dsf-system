import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Não autorizado' }, { status: 401 })
  if (!session.user.permissions.includes('EQUIPAMENTOS_GERENCIAR')) {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { id } = await params
  const tenantId = session.user.tenantId

  const equipamento = await prisma.equipamento.findFirst({ where: { id, tenantId } })
  if (!equipamento) return Response.json({ error: 'Não encontrado' }, { status: 404 })

  const body = await request.json()
  const { nome, marcaModelo, numeroSerie, dataUltimaCalibracao, dataProximaCalibracao, obs, status, ativo } = body

  const proxima = dataProximaCalibracao ? new Date(dataProximaCalibracao) : equipamento.dataProximaCalibracao
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  let novoStatus = status ?? equipamento.status
  // Recalcular status automático se não for MANUTENCAO e datas foram alteradas
  if (dataProximaCalibracao && status !== 'MANUTENCAO') {
    const diffMs = proxima.getTime() - hoje.getTime()
    const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    novoStatus = diffDias < 0 ? 'VENCIDO' : diffDias <= 30 ? 'VENCENDO' : 'ATIVO'
  }

  const updated = await prisma.equipamento.update({
    where: { id },
    data: {
      ...(nome && { nome }),
      ...(marcaModelo && { marcaModelo }),
      ...(numeroSerie !== undefined && { numeroSerie: numeroSerie || null }),
      ...(dataUltimaCalibracao && { dataUltimaCalibracao: new Date(dataUltimaCalibracao) }),
      ...(dataProximaCalibracao && { dataProximaCalibracao: proxima }),
      ...(obs !== undefined && { obs: obs || null }),
      ...(ativo !== undefined && { ativo }),
      status: novoStatus,
    },
  })

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: session.user.id,
      acao: 'EQUIPAMENTO_ATUALIZADO',
      recursoTipo: 'Equipamento',
      recursoId: id,
      ip: request.headers.get('x-forwarded-for') ?? 'unknown',
      userAgent: request.headers.get('user-agent') ?? '',
    },
  })

  return Response.json(updated)
}
