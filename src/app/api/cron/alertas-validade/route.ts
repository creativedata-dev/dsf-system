import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendPush } from '@/lib/web-push'

export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  const d90 = new Date(hoje)
  d90.setDate(d90.getDate() + 90)

  const lotes = await prisma.loteProduto.findMany({
    where: { ativo: true, status: 'ATIVO', validade: { lte: d90 } },
    include: { produto: { select: { nome: true } } },
  })

  let alertasRegistrados = 0

  const porTenant = new Map<string, { vencidos: number; d30: number; d90: number }>()
  for (const l of lotes) {
    const diffMs = l.validade.getTime() - hoje.getTime()
    const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const entry = porTenant.get(l.tenantId) ?? { vencidos: 0, d30: 0, d90: 0 }
    if (diffDias < 0) entry.vencidos++
    else if (diffDias <= 30) entry.d30++
    else entry.d90++
    porTenant.set(l.tenantId, entry)
  }

  await Promise.all(
    Array.from(porTenant.entries()).map(([tenantId, counts]) =>
      prisma.auditLog.create({
        data: {
          tenantId,
          userId: null,
          acao: 'CRON_ALERTAS_VALIDADE',
          recursoTipo: 'LoteProduto',
          recursoId: tenantId,
          ip: 'cron',
          userAgent: `vencidos:${counts.vencidos} 30d:${counts.d30} 90d:${counts.d90}`,
        },
      })
    )
  )

  alertasRegistrados = porTenant.size

  // Push para tenants com lotes vencendo/vencidos
  if (porTenant.size > 0) {
    const configs = await prisma.configAlerta.findMany({
      where: { tenantId: { in: [...porTenant.keys()] }, alertaValidade: true },
      select: { tenantId: true },
    })

    const tenantsAtivos = new Set(configs.map(c => c.tenantId))
    const tenantsFiltrados = [...porTenant.keys()].filter(
      tid => tenantsAtivos.has(tid) || !configs.find(c => c.tenantId === tid)
    )

    if (tenantsFiltrados.length > 0) {
      const subs = await prisma.pushSubscription.findMany({
        where: { tenantId: { in: tenantsFiltrados } },
      })

      const expiredEndpoints: string[] = []
      await Promise.all(
        subs.map(async sub => {
          const counts = porTenant.get(sub.tenantId)!
          const body = counts.vencidos > 0
            ? `${counts.vencidos} lote(s) vencido(s) e ${counts.d30} vencendo em 30 dias.`
            : `${counts.d30} lote(s) vencendo em 30 dias. Verifique o estoque.`
          const result = await sendPush(sub, {
            title: 'FarmaSign — Validade de Lotes',
            body,
            url: '/dashboard/validade',
            tag: 'alerta-validade',
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

  return NextResponse.json({
    ok: true,
    tenantsComAlerta: alertasRegistrados,
    totalLotesNaJanela: lotes.length,
  })
}
