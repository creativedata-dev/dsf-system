import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const STALE_HOURS = 12

export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000)

  const stale = await prisma.dSF.findMany({
    where: {
      status: 'EMITIDA',
      updatedAt: { lt: cutoff },
    },
    select: { id: true },
  })

  if (stale.length === 0) {
    return NextResponse.json({ cancelled: 0 })
  }

  const ids = stale.map((d) => d.id)

  // $transaction e updateMany são incompatíveis com NeonHttp — executar sequencialmente
  await Promise.all(
    ids.map((id) => prisma.dSF.update({ where: { id }, data: { status: 'CANCELADA' } }))
  )

  await prisma.auditLog.create({
    data: {
      tenantId: null,
      userId: null,
      acao: 'CRON_CLEANUP_DSF',
      recursoTipo: 'DSF',
      recursoId: JSON.stringify(ids),
      ip: 'vercel-cron',
      userAgent: 'vercel-cron',
    },
  })

  return NextResponse.json({
    cancelled: ids.length,
    cutoff: cutoff.toISOString(),
  })
}
