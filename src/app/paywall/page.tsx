import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PaywallClient } from './paywall-client'

export default async function AssinaturaExpiradaPage() {
  const session = await getServerSession(authOptions)

  const [assinatura, planos] = await Promise.all([
    session
      ? prisma.assinatura.findUnique({
          where: { tenantId: session.user.tenantId },
          select: { status: true },
        })
      : null,
    prisma.plano.findMany({
      where: { ativo: true, tipo: { not: 'TRIAL' } },
      orderBy: { precoMensal: 'asc' },
      select: {
        id: true, nome: true, tipo: true,
        precoMensal: true, precoAnual: true,
        limiteUsuarios: true, limiteDsfsMes: true,
      },
    }),
  ])

  return (
    <PaywallClient
      status={assinatura?.status ?? 'EXPIRADA'}
      planos={planos}
    />
  )
}
