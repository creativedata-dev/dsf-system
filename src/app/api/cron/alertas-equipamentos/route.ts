import { prisma } from '@/lib/prisma'

export async function GET() {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  const trintaDias = new Date(hoje)
  trintaDias.setDate(trintaDias.getDate() + 30)

  // Buscar todos os equipamentos ativos
  const equipamentos = await prisma.equipamento.findMany({
    where: { ativo: true, status: { not: 'MANUTENCAO' } },
    select: { id: true, tenantId: true, dataProximaCalibracao: true, status: true },
  })

  const updates: Promise<unknown>[] = []

  for (const eq of equipamentos) {
    const proxima = new Date(eq.dataProximaCalibracao)
    proxima.setHours(0, 0, 0, 0)
    const diffMs = proxima.getTime() - hoje.getTime()
    const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    const novoStatus = diffDias < 0 ? 'VENCIDO' : diffDias <= 30 ? 'VENCENDO' : 'ATIVO'

    if (novoStatus !== eq.status) {
      updates.push(
        prisma.equipamento.update({
          where: { id: eq.id },
          data: { status: novoStatus },
        })
      )
    }
  }

  await Promise.all(updates)

  // Registrar execução do cron
  await prisma.auditLog.create({
    data: {
      tenantId: null,
      userId: null,
      acao: 'CRON_ALERTAS_EQUIPAMENTOS',
      recursoTipo: 'cron',
      recursoId: 'alertas-equipamentos',
      ip: 'cron',
      userAgent: 'vercel-cron',
    },
  })

  const vencidos = equipamentos.filter(e => {
    const d = new Date(e.dataProximaCalibracao)
    return d < hoje
  }).length
  const vencendo = equipamentos.filter(e => {
    const d = new Date(e.dataProximaCalibracao)
    const diff = Math.floor((d.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
    return diff >= 0 && diff <= 30
  }).length

  return Response.json({
    ok: true,
    atualizados: updates.length,
    vencidos,
    vencendo,
  })
}
