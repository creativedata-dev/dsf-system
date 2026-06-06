import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const equipamentos = await prisma.equipamento.findMany({
    where: { tenantId: session.user.tenantId, ativo: true },
    orderBy: { dataProximaCalibracao: 'asc' },
  })

  return Response.json(equipamentos)
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Não autorizado' }, { status: 401 })
  if (!session.user.permissions.includes('EQUIPAMENTOS_GERENCIAR')) {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const body = await request.json()
  const { nome, marcaModelo, numeroSerie, dataUltimaCalibracao, dataProximaCalibracao, obs, numeroCertificado, laboratorio } = body

  if (!nome || !marcaModelo || !dataUltimaCalibracao || !dataProximaCalibracao) {
    return Response.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 })
  }

  const ultima = new Date(dataUltimaCalibracao)
  const proxima = new Date(dataProximaCalibracao)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  const diffMs = proxima.getTime() - hoje.getTime()
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const status = diffDias < 0 ? 'VENCIDO' : diffDias <= 30 ? 'VENCENDO' : 'ATIVO'

  const equipamento = await prisma.equipamento.create({
    data: {
      tenantId: session.user.tenantId,
      nome,
      marcaModelo,
      numeroSerie: numeroSerie || null,
      dataUltimaCalibracao: ultima,
      dataProximaCalibracao: proxima,
      obs: obs || null,
      numeroCertificado: numeroCertificado || null,
      laboratorio: laboratorio || null,
      status,
    },
  })

  await prisma.auditLog.create({
    data: {
      tenantId: session.user.tenantId,
      userId: session.user.id,
      acao: 'EQUIPAMENTO_CRIADO',
      recursoTipo: 'Equipamento',
      recursoId: equipamento.id,
      ip: request.headers.get('x-forwarded-for') ?? 'unknown',
      userAgent: request.headers.get('user-agent') ?? '',
    },
  })

  return Response.json(equipamento, { status: 201 })
}
