import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getStripe } from '@/lib/stripe'

// POST — gera Stripe Checkout Session para um tenant assinar um plano
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Não autorizado' }, { status: 401 })
  if (!(session.user.permissions as string[]).includes('SUPER_ADMIN_GLOBAIS')) {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  let body: { tenantId: string; planoId: string; cadencia?: 'mensal' | 'anual' | 'unico' }
  try { body = await request.json() } catch {
    return Response.json({ error: 'Corpo inválido' }, { status: 400 })
  }

  const [tenant, plano, assinatura] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: body.tenantId }, select: { nomeFantasia: true, cnpj: true } }),
    prisma.plano.findUnique({ where: { id: body.planoId } }),
    prisma.assinatura.findUnique({ where: { tenantId: body.tenantId }, select: { id: true, gatewayCustomerId: true } }),
  ])

  if (!tenant) return Response.json({ error: 'Tenant não encontrado' }, { status: 404 })
  if (!plano) return Response.json({ error: 'Plano não encontrado' }, { status: 404 })

  const stripe = await getStripe()
  const cadencia = body.cadencia ?? (plano.tipo === 'ANUAL' ? 'anual' : plano.tipo === 'VITALICIO' ? 'unico' : 'mensal')

  // ── Determinar Price ID ───────────────────────────────────────────────────────
  let priceId: string | null = null
  if (cadencia === 'mensal' && plano.stripeMonthlyPriceId) priceId = plano.stripeMonthlyPriceId
  else if (cadencia === 'anual' && plano.stripeAnnualPriceId) priceId = plano.stripeAnnualPriceId
  else if (cadencia === 'unico' && plano.stripeOnetimePriceId) priceId = plano.stripeOnetimePriceId

  // Se não tem Price ID salvo, cria dinamicamente no Stripe
  if (!priceId) {
    const valor = cadencia === 'anual' ? plano.precoAnual : plano.precoMensal
    if (!valor || valor <= 0) {
      return Response.json({ error: `Plano não tem preço configurado para cadência "${cadencia}"` }, { status: 422 })
    }

    const isRecorrente = cadencia !== 'unico'
    const price = await stripe.prices.create({
      currency: 'brl',
      unit_amount: valor,
      ...(isRecorrente
        ? { recurring: { interval: cadencia === 'anual' ? 'year' : 'month' } }
        : {}),
      product_data: {
        name: `FarmaSign — ${plano.nome}`,
        metadata: { planoId: plano.id, cadencia },
      },
    })
    priceId = price.id

    // Salva para reusar nas próximas cobranças
    const update: Record<string, string> = {}
    if (cadencia === 'mensal') update.stripeMonthlyPriceId = priceId
    else if (cadencia === 'anual') update.stripeAnnualPriceId = priceId
    else update.stripeOnetimePriceId = priceId
    await prisma.plano.update({ where: { id: plano.id }, data: update })
  }

  // ── Customer Stripe ───────────────────────────────────────────────────────────
  let customerId = assinatura?.gatewayCustomerId ?? null
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: tenant.nomeFantasia,
      metadata: { tenantId: body.tenantId, cnpj: tenant.cnpj },
    })
    customerId = customer.id

    // Salva customer ID na assinatura
    if (assinatura) {
      await prisma.assinatura.update({ where: { tenantId: body.tenantId }, data: { gatewayCustomerId: customerId, gateway: 'stripe' } })
    }
  }

  // ── Checkout Session ──────────────────────────────────────────────────────────
  const baseUrl = process.env.NEXTAUTH_URL ?? 'https://app.farmasign.com.br'
  const isRecorrente = cadencia !== 'unico'

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: isRecorrente ? 'subscription' : 'payment',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/dashboard/tenants?checkout=success&tenantId=${body.tenantId}`,
    cancel_url: `${baseUrl}/dashboard/tenants?checkout=cancel&tenantId=${body.tenantId}`,
    metadata: {
      tenantId: body.tenantId,
      planoId: body.planoId,
      cadencia,
    },
    ...(isRecorrente ? {
      subscription_data: {
        metadata: { tenantId: body.tenantId, planoId: body.planoId },
        trial_period_days: plano.tipo === 'TRIAL' ? (plano.trialDias ?? 14) : undefined,
      },
    } : {}),
    locale: 'pt-BR',
    payment_method_types: ['card'],
  })

  return Response.json({ url: checkoutSession.url, sessionId: checkoutSession.id })
}
