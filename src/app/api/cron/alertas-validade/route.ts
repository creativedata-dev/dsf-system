import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  const d30 = new Date(hoje)
  d30.setDate(d30.getDate() + 30)

  const d90 = new Date(hoje)
  d90.setDate(d90.getDate() + 90)

  // Busca todos os lotes ATIVOS com validade até 90 dias (inclui vencidos)
  const lotes = await prisma.loteProduto.findMany({
    where: {
      ativo: true,
      status: 'ATIVO',
      validade: { lte: d90 },
    },
    include: { produto: { select: { nome: true } } },
  })

  let alertasRegistrados = 0

  // Agrupa por tenant para gerar um único AuditLog por tenant com resumo
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

  return NextResponse.json({
    ok: true,
    tenantsComAlerta: alertasRegistrados,
    totalLotesNaJanela: lotes.length,
  })
}
