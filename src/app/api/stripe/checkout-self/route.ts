import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getStripe } from '@/lib/stripe'

// Checkout iniciado pelo próprio tenant (paywall) — sem exigir SUPER_ADMIN_GLOBAIS
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return Response.json({ error: 'Não autorizado' }, { status: 401 })

    let body: { planoId: string; cadencia: 'mensal' | 'anual' | 'unico' }
    try { body = await request.json() } catch {
      return Response.json({ error: 'Corpo inválido' }, { status: 400 })
    }

    const tenantId = session.user.tenantId

    const [tenant, plano, assinatura] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenantId }, select: { nomeFantasia: true, cnpj: true } }),
      prisma.plano.findUnique({ where: { id: body.planoId } }),
      prisma.assinatura.findUnique({ where: { tenantId }, select: { id: true, gatewayCustomerId: true } }),
    ])

    if (!tenant) return Response.json({ error: 'Tenant não encontrado' }, { status: 404 })
    if (!plano || !plano.ativo) return Response.json({ error: 'Plano não encontrado' }, { status: 404 })

    const stripe = await getStripe()
    const { cadencia } = body

    let priceId: string | null = null
    if (cadencia === 'mensal' && plano.stripeMonthlyPriceId) priceId = plano.stripeMonthlyPriceId
    else if (cadencia === 'anual' && plano.stripeAnnualPriceId) priceId = plano.stripeAnnualPriceId
    else if (cadencia === 'unico' && plano.stripeOnetimePriceId) priceId = plano.stripeOnetimePriceId

    if (!priceId) {
      const valor = cadencia === 'anual' ? plano.precoAnual : plano.precoMensal
      if (!valor || valor <= 0) {
        return Response.json({ error: 'Plano sem preço configurado para esta cadência.' }, { status: 422 })
      }
      const isRecorrente = cadencia !== 'unico'
      const price = await stripe.prices.create({
        currency: 'brl',
        unit_amount: valor,
        ...(isRecorrente ? { recurring: { interval: cadencia === 'anual' ? 'year' : 'month' } } : {}),
        product_data: { name: `FarmaSign — ${plano.nome}`, metadata: { planoId: plano.id, cadencia } },
      })
      priceId = price.id
      const update: Record<string, string> = {}
      if (cadencia === 'mensal') update.stripeMonthlyPriceId = priceId
      else if (cadencia === 'anual') update.stripeAnnualPriceId = priceId
      else update.stripeOnetimePriceId = priceId
      await prisma.plano.update({ where: { id: plano.id }, data: update })
    }

    let customerId = assinatura?.gatewayCustomerId ?? null
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: tenant.nomeFantasia,
        metadata: { tenantId, cnpj: tenant.cnpj ?? '' },
      })
      customerId = customer.id
      if (assinatura) {
        await prisma.assinatura.update({
          where: { tenantId },
          data: { gatewayCustomerId: customerId, gateway: 'stripe' },
        })
      }
    }

    const baseUrl = process.env.NEXTAUTH_URL ?? 'https://app.farmasign.com.br'
    const isRecorrente = cadencia !== 'unico'

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId ?? undefined,
      customer_email: !customerId ? session.user.email ?? undefined : undefined,
      mode: isRecorrente ? 'subscription' : 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/dashboard?checkout=success`,
      cancel_url: `${baseUrl}/paywall?checkout=cancel`,
      metadata: { tenantId, planoId: plano.id, cadencia },
      ...(isRecorrente ? {
        subscription_data: { metadata: { tenantId, planoId: plano.id } },
      } : {}),
      allow_promotion_codes: true,
      locale: 'pt-BR',
      payment_method_types: ['card'],
      payment_method_options: { link: { display: 'hide' } },
    })

    return Response.json({ url: checkoutSession.url })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[stripe/checkout-self]', msg)
    return Response.json({ error: msg }, { status: 500 })
  }
}
