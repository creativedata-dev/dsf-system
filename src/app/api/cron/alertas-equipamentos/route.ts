import { prisma } from '@/lib/prisma'
import { sendPush } from '@/lib/web-push'

export async function GET() {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  const trintaDias = new Date(hoje)
  trintaDias.setDate(trintaDias.getDate() + 30)

  const equipamentos = await prisma.equipamento.findMany({
    where: { ativo: true, status: { not: 'MANUTENCAO' } },
    select: { id: true, tenantId: true, dataProximaCalibracao: true, status: true },
  })

  const updates: Promise<unknown>[] = []

  const tenantsVencendo = new Set<string>()
  const tenantsVencidos = new Set<string>()

  for (const eq of equipamentos) {
    const proxima = new Date(eq.dataProximaCalibracao)
    proxima.setHours(0, 0, 0, 0)
    const diffMs = proxima.getTime() - hoje.getTime()
    const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    const novoStatus = diffDias < 0 ? 'VENCIDO' : diffDias <= 30 ? 'VENCENDO' : 'ATIVO'

    if (novoStatus !== eq.status) {
      updates.push(
        prisma.equipamento.update({ where: { id: eq.id }, data: { status: novoStatus } })
      )
    }

    if (novoStatus === 'VENCIDO') tenantsVencidos.add(eq.tenantId)
    else if (novoStatus === 'VENCENDO') tenantsVencendo.add(eq.tenantId)
  }

  await Promise.all(updates)

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

  // Push para tenants com equipamentos vencidos ou vencendo
  const tenantsAlerta = new Set([...tenantsVencidos, ...tenantsVencendo])

  if (tenantsAlerta.size > 0) {
    const configs = await prisma.configAlerta.findMany({
      where: { tenantId: { in: [...tenantsAlerta] }, alertaEquip: true },
      select: { tenantId: true },
    })

    const tenantsAtivos = new Set(configs.map(c => c.tenantId))
    // tenants sem config também recebem (padrão ativo)
    const tenantsFiltrados = [...tenantsAlerta].filter(
      tid => tenantsAtivos.has(tid) || !configs.find(c => c.tenantId === tid)
    )

    if (tenantsFiltrados.length > 0) {
      const subs = await prisma.pushSubscription.findMany({
        where: { tenantId: { in: tenantsFiltrados } },
      })

      const expiredEndpoints: string[] = []
      await Promise.all(
        subs.map(async sub => {
          const vencido = tenantsVencidos.has(sub.tenantId)
          const result = await sendPush(sub, {
            title: 'FarmaSign — Equipamentos',
            body: vencido
              ? 'Equipamento(s) com calibração vencida. Regularize para manter a conformidade ANVISA.'
              : 'Equipamento(s) com calibração vencendo em 30 dias. Agende a recalibração.',
            url: '/dashboard/equipamentos',
            tag: 'alerta-equipamentos',
          })
          if (result.expired) expiredEndpoints.push(sub.endpoint)
        })
      )

      if (expiredEndpoints.length > 0) {
        await Promise.all(
          expiredEndpoints.map(endpoint =>
            prisma.pushSubscription.deleteMany({ where: { endpoint } })
          )
        )
      }
    }
  }

  const vencidos = equipamentos.filter(e => new Date(e.dataProximaCalibracao) < hoje).length
  const vencendo = equipamentos.filter(e => {
    const d = new Date(e.dataProximaCalibracao)
    const diff = Math.floor((d.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
    return diff >= 0 && diff <= 30
  }).length

  return Response.json({ ok: true, atualizados: updates.length, vencidos, vencendo })
}
