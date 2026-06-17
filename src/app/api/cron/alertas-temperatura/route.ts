import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AuditAcao } from '@/generated/prisma/client'
import { sendPush } from '@/lib/web-push'

export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const agora = new Date()
  const horaAtualMin = agora.getUTCHours() * 60 + agora.getUTCMinutes()

  const ontem = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate() - 1))

  const ambientes = await prisma.ambiente.findMany({
    where: { ativo: true },
    select: { id: true, tenantId: true, nome: true },
  })

  let omissoesTotal = 0

  const checks = ambientes.flatMap(a => [
    { ambienteId: a.id, tenantId: a.tenantId, nome: a.nome, periodo: 'MANHA' },
    { ambienteId: a.id, tenantId: a.tenantId, nome: a.nome, periodo: 'TARDE' },
  ])

  const auditLogsToCreate: Parameters<typeof prisma.auditLog.create>[0]['data'][] = []
  const tenantsComOmissao = new Set<string>()

  for (const c of checks) {
    const existe = await prisma.registroTermoHigrometria.findUnique({
      where: { ambienteId_dataLeitura_periodo: { ambienteId: c.ambienteId, dataLeitura: ontem, periodo: c.periodo } },
    })
    if (!existe) {
      omissoesTotal++
      tenantsComOmissao.add(c.tenantId)
      auditLogsToCreate.push({
        tenantId: c.tenantId,
        userId: null,
        acao: AuditAcao.CRON_ALERTAS_TEMPERATURA,
        recursoTipo: 'Ambiente',
        recursoId: c.ambienteId,
        ip: 'cron',
        userAgent: 'cron',
      })
    }
  }

  if (auditLogsToCreate.length > 0) {
    await Promise.all(auditLogsToCreate.map(data => prisma.auditLog.create({ data })))
  }

  // Push para tenants com omissão (respeitando hora limite configurada)
  if (tenantsComOmissao.size > 0) {
    const configs = await prisma.configAlerta.findMany({
      where: { tenantId: { in: [...tenantsComOmissao] }, alertaTemp: true },
      select: { tenantId: true, horaLimiteTemp: true },
    })

    const configMap = new Map(configs.map(c => [c.tenantId, c]))

    const tenantsFiltrados = [...tenantsComOmissao].filter(tid => {
      const cfg = configMap.get(tid)
      const horaLimite = cfg?.horaLimiteTemp ?? '18:00'
      const [h, m] = horaLimite.split(':').map(Number)
      return horaAtualMin >= h * 60 + m
    })

    if (tenantsFiltrados.length > 0) {
      const subs = await prisma.pushSubscription.findMany({
        where: { tenantId: { in: tenantsFiltrados } },
      })

      const expiredEndpoints: string[] = []
      await Promise.all(
        subs.map(async sub => {
          const result = await sendPush(sub, {
            title: 'FarmaSign — Temperatura',
            body: 'Leitura de temperatura não registrada ontem. Verifique os ambientes monitorados.',
            url: '/dashboard/temperatura',
            tag: 'alerta-temperatura',
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
    data: ontem.toISOString().slice(0, 10),
    ambientesVerificados: ambientes.length,
    omissoes: omissoesTotal,
  })
}
