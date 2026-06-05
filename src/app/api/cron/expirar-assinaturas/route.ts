import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AuditAcao, StatusAssinatura } from '@/generated/prisma/client'

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const agora = new Date()

  // Busca assinaturas TRIAL ou ATIVA com expiraEm no passado
  const expiradas = await prisma.assinatura.findMany({
    where: {
      status: { in: [StatusAssinatura.TRIAL, StatusAssinatura.ATIVA] },
      expiraEm: { lte: agora, not: null },
    },
    select: { id: true, tenantId: true },
  })

  if (expiradas.length === 0) {
    return Response.json({ expiradas: 0 })
  }

  // NeonHttp: updates individuais em paralelo
  await Promise.all(
    expiradas.map((a) =>
      prisma.assinatura.update({
        where: { id: a.id },
        data: { status: StatusAssinatura.EXPIRADA },
      })
    )
  )

  await Promise.all(
    expiradas.map((a) =>
      prisma.auditLog.create({
        data: {
          tenantId: a.tenantId,
          userId: null,
          acao: AuditAcao.ASSINATURA_EXPIRADA,
          recursoTipo: 'Assinatura',
          recursoId: a.id,
          ip: 'cron',
          userAgent: 'cron/expirar-assinaturas',
        },
      })
    )
  )

  console.log(`[cron/expirar-assinaturas] ${expiradas.length} assinatura(s) expirada(s)`)
  return Response.json({ expiradas: expiradas.length })
}
