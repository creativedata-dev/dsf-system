import { NextRequest } from 'next/server'
import { redirect } from 'next/navigation'
import { getStripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('session_id')

  if (!sessionId) redirect('/dashboard')

  try {
    const stripe = await getStripe()
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    if (session.payment_status === 'paid' || session.status === 'complete') {
      const tenantId = session.metadata?.tenantId
      const planoId = session.metadata?.planoId

      if (tenantId && planoId) {
        const plano = await prisma.plano.findUnique({ where: { id: planoId }, select: { tipo: true } })
        const isAnual = session.metadata?.cadencia === 'anual'
        const agora = new Date()
        const expiraEm = new Date(agora)
        if (isAnual) {
          expiraEm.setFullYear(expiraEm.getFullYear() + 1)
        } else {
          expiraEm.setMonth(expiraEm.getMonth() + 1)
        }

        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null

        await prisma.assinatura.update({
          where: { tenantId },
          data: {
            status: 'ATIVA',
            planoId,
            expiraEm,
            gateway: 'stripe',
            ...(customerId ? { gatewayCustomerId: customerId } : {}),
          },
        })
      }
    }
  } catch (e) {
    console.error('[checkout-success]', e)
  }

  redirect('/dashboard')
}
