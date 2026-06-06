import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AuditAcao } from '@/generated/prisma/client'

export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Ontem (data no fuso UTC — mesma convenção usada nos registros)
  const hoje = new Date()
  const ontem = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate() - 1))

  // Todos os ambientes ativos
  const ambientes = await prisma.ambiente.findMany({
    where: { ativo: true },
    select: { id: true, tenantId: true, nome: true },
  })

  let omissoesTotal = 0

  // Verificar quais ambientes não tiveram leitura ontem por período
  const checks = ambientes.flatMap(a => [
    { ambienteId: a.id, tenantId: a.tenantId, nome: a.nome, periodo: 'MANHA' },
    { ambienteId: a.id, tenantId: a.tenantId, nome: a.nome, periodo: 'TARDE' },
  ])

  const auditLogsToCreate: Parameters<typeof prisma.auditLog.create>[0]['data'][] = []

  for (const c of checks) {
    const existe = await prisma.registroTermoHigrometria.findUnique({
      where: { ambienteId_dataLeitura_periodo: { ambienteId: c.ambienteId, dataLeitura: ontem, periodo: c.periodo } },
    })
    if (!existe) {
      omissoesTotal++
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

  return NextResponse.json({
    data: ontem.toISOString().slice(0, 10),
    ambientesVerificados: ambientes.length,
    omissoes: omissoesTotal,
  })
}
