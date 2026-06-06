import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AuditAcao, StatusAssinatura, StatusPagamento } from '@/generated/prisma/client'

// ─── Verificação de autenticidade por gateway ─────────────────────────────────

async function verifyStripe(request: NextRequest, rawBody: string): Promise<boolean> {
  try {
    const sig = request.headers.get('stripe-signature')
    if (!sig) { console.warn('[webhook/stripe] stripe-signature header ausente'); return false }

    const { getStripe, getStripeWebhookSecret } = await import('@/lib/stripe')
    const webhookSecret = await getStripeWebhookSecret()
    const stripe = await getStripe()

    stripe.webhooks.constructEvent(rawBody, sig, webhookSecret, 600) // 10min tolerance
    return true
  } catch (e) {
    console.error('[webhook/stripe] verificacao falhou:', e instanceof Error ? e.message : e)
    return false
  }
}

async function verifyAsaas(request: NextRequest): Promise<boolean> {
  const config = await prisma.gatewayConfig.findUnique({ where: { gateway: 'asaas' }, select: { webhookSecretEncrypted: true } })
  if (!config?.webhookSecretEncrypted) return false
  const { decrypt } = await import('@/lib/crypto')
  const token = decrypt(config.webhookSecretEncrypted)
  return request.headers.get('asaas-access-token') === token
}

// ─── Normalização de payload ──────────────────────────────────────────────────

type NormalizedPayload = {
  gatewaySubscriptionId: string | null
  gatewayCustomerId: string | null
  gatewayPaymentId: string | null
  valor: number
  status: StatusPagamento
  evento: string
  novoStatusAssinatura: StatusAssinatura | null
  tenantId: string | null
  planoId: string | null
}

function normalizeStripe(body: Record<string, unknown>): NormalizedPayload | null {
  const tipo = body.type as string
  const obj = (body.data as Record<string, unknown>)?.object as Record<string, unknown>
  if (!obj) return null

  const meta = (obj.metadata ?? (obj.subscription_data as Record<string, unknown>)?.metadata ?? {}) as Record<string, string>

  const statusPagMap: Record<string, StatusPagamento> = {
    'checkout.session.completed': StatusPagamento.APROVADO,
    'invoice.payment_succeeded': StatusPagamento.APROVADO,
    'invoice.payment_failed': StatusPagamento.RECUSADO,
    'charge.refunded': StatusPagamento.REEMBOLSADO,
  }

  const statusAssMap: Record<string, StatusAssinatura> = {
    'checkout.session.completed': StatusAssinatura.ATIVA,
    'invoice.payment_succeeded': StatusAssinatura.ATIVA,
    'invoice.payment_failed': StatusAssinatura.SUSPENSA,
    'customer.subscription.deleted': StatusAssinatura.CANCELADA,
  }

  const subscriptionId =
    (obj.subscription as string) ??
    (obj.id as string && tipo === 'customer.subscription.deleted' ? obj.id as string : null)

  return {
    gatewaySubscriptionId: subscriptionId ?? null,
    gatewayCustomerId: (obj.customer as string) ?? null,
    gatewayPaymentId: (obj.payment_intent as string) ?? (obj.id as string) ?? null,
    valor: typeof obj.amount_total === 'number' ? obj.amount_total :
           typeof obj.amount_paid === 'number' ? obj.amount_paid as number : 0,
    status: statusPagMap[tipo] ?? StatusPagamento.PENDENTE,
    evento: tipo,
    novoStatusAssinatura: statusAssMap[tipo] ?? null,
    tenantId: meta.tenantId ?? null,
    planoId: meta.planoId ?? null,
  }
}

function normalizeAsaas(body: Record<string, unknown>): NormalizedPayload | null {
  const evento = body.event as string
  const payment = body.payment as Record<string, unknown>
  if (!payment) return null

  const statusPagMap: Record<string, StatusPagamento> = {
    PAYMENT_CONFIRMED: StatusPagamento.APROVADO,
    PAYMENT_RECEIVED: StatusPagamento.APROVADO,
    PAYMENT_OVERDUE: StatusPagamento.RECUSADO,
    PAYMENT_REFUNDED: StatusPagamento.REEMBOLSADO,
  }
  const statusAssMap: Record<string, StatusAssinatura> = {
    PAYMENT_CONFIRMED: StatusAssinatura.ATIVA,
    PAYMENT_RECEIVED: StatusAssinatura.ATIVA,
    PAYMENT_OVERDUE: StatusAssinatura.SUSPENSA,
  }

  return {
    gatewaySubscriptionId: (payment.subscription as string) ?? null,
    gatewayCustomerId: (payment.customer as string) ?? null,
    gatewayPaymentId: (payment.id as string) ?? null,
    valor: typeof payment.value === 'number' ? Math.round(payment.value * 100) : 0,
    status: statusPagMap[evento] ?? StatusPagamento.PENDENTE,
    evento,
    novoStatusAssinatura: statusAssMap[evento] ?? null,
    tenantId: null,
    planoId: null,
  }
}

// ─── Handler principal ────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gateway: string }> },
) {
  const { gateway } = await params
  const rawBody = await request.text()

  let body: Record<string, unknown>
  try { body = JSON.parse(rawBody) } catch {
    return Response.json({ error: 'Payload inválido' }, { status: 400 })
  }

  let valid = false
  if (gateway === 'stripe') valid = await verifyStripe(request, rawBody)
  else if (gateway === 'asaas') valid = await verifyAsaas(request)
  else return Response.json({ error: 'Gateway não suportado' }, { status: 400 })

  if (!valid) return Response.json({ error: 'Assinatura inválida' }, { status: 401 })

  let normalized: NormalizedPayload | null = null
  if (gateway === 'stripe') normalized = normalizeStripe(body)
  else if (gateway === 'asaas') normalized = normalizeAsaas(body)

  if (!normalized) return Response.json({ ok: true }) // evento não tratado

  // ── Buscar assinatura ─────────────────────────────────────────────────────────
  // 1. Pelo tenantId no metadata (checkout.session.completed tem isso)
  // 2. Pelo gatewaySubscriptionId
  // 3. Pelo gatewayCustomerId
  let assinatura = null

  if (normalized.tenantId) {
    assinatura = await prisma.assinatura.findUnique({ where: { tenantId: normalized.tenantId } })
  }
  if (!assinatura && normalized.gatewaySubscriptionId) {
    assinatura = await prisma.assinatura.findFirst({ where: { gatewaySubscriptionId: normalized.gatewaySubscriptionId } })
  }
  if (!assinatura && normalized.gatewayCustomerId) {
    assinatura = await prisma.assinatura.findFirst({ where: { gatewayCustomerId: normalized.gatewayCustomerId } })
  }

  if (!assinatura) {
    console.warn(`[webhook/${gateway}] assinatura não encontrada`, { normalized })
    return Response.json({ ok: true })
  }

  // ── Registrar pagamento ───────────────────────────────────────────────────────
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'webhook'

  const pagamento = await prisma.pagamentoLog.create({
    data: {
      assinaturaId: assinatura.id,
      tenantId: assinatura.tenantId,
      valor: normalized.valor,
      status: normalized.status,
      gateway,
      gatewayPaymentId: normalized.gatewayPaymentId,
      descricao: normalized.evento,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metadados: body as any,
    },
  })

  // ── Atualizar assinatura ──────────────────────────────────────────────────────
  const updateData: Record<string, unknown> = {}

  if (normalized.gatewaySubscriptionId && !assinatura.gatewaySubscriptionId) {
    updateData.gatewaySubscriptionId = normalized.gatewaySubscriptionId
  }
  if (normalized.gatewayCustomerId && !assinatura.gatewayCustomerId) {
    updateData.gatewayCustomerId = normalized.gatewayCustomerId
  }
  if (!assinatura.gateway) updateData.gateway = gateway

  if (normalized.novoStatusAssinatura && normalized.novoStatusAssinatura !== assinatura.status) {
    updateData.status = normalized.novoStatusAssinatura
    if (normalized.novoStatusAssinatura === StatusAssinatura.CANCELADA) {
      updateData.canceladaEm = new Date()
    }
  }

  if (Object.keys(updateData).length) {
    await prisma.assinatura.update({ where: { id: assinatura.id }, data: updateData })
  }

  const acaoMap: Record<StatusAssinatura, AuditAcao> = {
    ATIVA: AuditAcao.ASSINATURA_ATUALIZADA,
    TRIAL: AuditAcao.ASSINATURA_ATUALIZADA,
    SUSPENSA: AuditAcao.ASSINATURA_ATUALIZADA,
    CANCELADA: AuditAcao.ASSINATURA_CANCELADA,
    EXPIRADA: AuditAcao.ASSINATURA_EXPIRADA,
  }

  await Promise.all([
    prisma.auditLog.create({
      data: { tenantId: assinatura.tenantId, userId: null, acao: AuditAcao.PAGAMENTO_REGISTRADO, recursoTipo: 'PagamentoLog', recursoId: pagamento.id, ip, userAgent: gateway },
    }),
    ...(normalized.novoStatusAssinatura ? [
      prisma.auditLog.create({
        data: { tenantId: assinatura.tenantId, userId: null, acao: acaoMap[normalized.novoStatusAssinatura], recursoTipo: 'Assinatura', recursoId: assinatura.id, ip, userAgent: gateway },
      }),
    ] : []),
  ])

  return Response.json({ ok: true })
}
