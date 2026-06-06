import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { StatusAssinatura, StatusPagamento } from '@/generated/prisma/client'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const perms = session.user.permissions as string[]
  if (!perms.includes('SUPER_ADMIN_GLOBAIS')) {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const agora = new Date()
  const inicioMesAtual = new Date(agora.getFullYear(), agora.getMonth(), 1)
  const inicioMesAnterior = new Date(agora.getFullYear(), agora.getMonth() - 1, 1)
  const fimMesAnterior = new Date(agora.getFullYear(), agora.getMonth(), 0)

  // ── Queries paralelas ────────────────────────────────────────────────────────
  const [
    assinaturasPorStatus,
    receitaMesAtual,
    receitaMesAnterior,
    novosMesAtual,
    novosMesAnterior,
    totalTenants,
    distribuicaoPlanos,
    ultimasPagamentos,
    historico6Meses,
  ] = await Promise.all([
    // Contagem por status
    prisma.assinatura.groupBy({
      by: ['status'],
      _count: { id: true },
    }),

    // Receita aprovada mês atual
    prisma.pagamentoLog.aggregate({
      where: { status: StatusPagamento.APROVADO, createdAt: { gte: inicioMesAtual } },
      _sum: { valor: true },
    }),

    // Receita aprovada mês anterior
    prisma.pagamentoLog.aggregate({
      where: { status: StatusPagamento.APROVADO, createdAt: { gte: inicioMesAnterior, lte: fimMesAnterior } },
      _sum: { valor: true },
    }),

    // Novas assinaturas mês atual
    prisma.assinatura.count({ where: { createdAt: { gte: inicioMesAtual } } }),

    // Novas assinaturas mês anterior
    prisma.assinatura.count({ where: { createdAt: { gte: inicioMesAnterior, lte: fimMesAnterior } } }),

    // Total de tenants ativos (sem internos)
    prisma.tenant.count({
      where: {
        ativo: true,
        NOT: { users: { some: { permissions: { has: 'SUPER_ADMIN_GLOBAIS' } } } },
      },
    }),

    // Distribuição por plano
    prisma.assinatura.groupBy({
      by: ['planoId'],
      _count: { id: true },
      where: { status: { in: [StatusAssinatura.ATIVA, StatusAssinatura.TRIAL] } },
    }),

    // Últimos 5 pagamentos
    prisma.pagamentoLog.findMany({
      where: { status: StatusPagamento.APROVADO },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true, valor: true, gateway: true, createdAt: true,
        assinatura: { select: { tenant: { select: { nomeFantasia: true } } } },
      },
    }),

    // Novas assinaturas por mês (últimos 6 meses) — raw groupBy por mês
    prisma.$queryRaw<{ mes: string; total: bigint }[]>`
      SELECT TO_CHAR(DATE_TRUNC('month', "createdAt"), 'YYYY-MM') AS mes,
             COUNT(*)::bigint AS total
      FROM   "Assinatura"
      WHERE  "createdAt" >= NOW() - INTERVAL '6 months'
      GROUP  BY mes
      ORDER  BY mes ASC
    `,
  ])

  // Resolve nomes dos planos para distribuição
  const planoIds = distribuicaoPlanos.map(d => d.planoId)
  const planosNomes = planoIds.length
    ? await prisma.plano.findMany({ where: { id: { in: planoIds } }, select: { id: true, nome: true, tipo: true } })
    : []
  const planosMap = Object.fromEntries(planosNomes.map(p => [p.id, p]))

  const statusMap: Record<string, number> = {}
  for (const s of assinaturasPorStatus) statusMap[s.status] = s._count.id

  return Response.json({
    assinaturas: {
      ativas:    statusMap[StatusAssinatura.ATIVA]     ?? 0,
      trial:     statusMap[StatusAssinatura.TRIAL]     ?? 0,
      suspensas: statusMap[StatusAssinatura.SUSPENSA]  ?? 0,
      canceladas:statusMap[StatusAssinatura.CANCELADA] ?? 0,
      expiradas: statusMap[StatusAssinatura.EXPIRADA]  ?? 0,
      total:     Object.values(statusMap).reduce((a, b) => a + b, 0),
    },
    receita: {
      mesAtual:    Number(receitaMesAtual._sum.valor ?? 0),
      mesAnterior: Number(receitaMesAnterior._sum.valor ?? 0),
    },
    novos: {
      mesAtual:    novosMesAtual,
      mesAnterior: novosMesAnterior,
    },
    totalTenants,
    distribuicaoPlanos: distribuicaoPlanos.map(d => ({
      planoId: d.planoId,
      nome: planosMap[d.planoId]?.nome ?? '—',
      tipo: planosMap[d.planoId]?.tipo ?? '—',
      total: d._count.id,
    })),
    ultimasPagamentos: ultimasPagamentos.map(p => ({
      id: p.id,
      valor: Number(p.valor),
      gateway: p.gateway,
      tenant: p.assinatura.tenant.nomeFantasia,
      createdAt: p.createdAt.toISOString(),
    })),
    historico6Meses: historico6Meses.map(h => ({
      mes: h.mes,
      total: Number(h.total),
    })),
  })
}
