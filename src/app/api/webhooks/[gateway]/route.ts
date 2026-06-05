import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AuditAcao, StatusAssinatura, StatusPagamento } from '@/generated/prisma/client'

// ─── Utilitários de verificação de assinatura por gateway ────────────────────
// Adicione a lógica de verificação HMAC/assinatura específica de cada gateway aqui.

async function verifyStripe(request: NextRequest, rawBody: string): Promise<boolean> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) return false
  // TODO: usar stripe.webhooks.constructEvent(rawBody, sig, secret)
  const sig = request.headers.get('stripe-signature')
  return !!sig // placeholder — implementar verificação real
}

async function verifyAsaas(request: NextRequest): Promise<boolean> {
  const token = request.headers.get('asaas-access-token')
  return token === process.env.ASAAS_WEBHOOK_TOKEN
}

async function verifyMercadoPago(request: NextRequest): Promise<boolean> {
  // MercadoPago usa x-signature header
  const sig = request.headers.get('x-signature')
  return !!sig // placeholder — implementar verificação real
}

// ─── Normalização de payload por gateway ─────────────────────────────────────
// Retorna { gatewaySubscriptionId, gatewayPaymentId, valor, status, evento }

type NormalizedPayload = {
  gatewaySubscriptionId: string | null
  gatewayPaymentId: string | null
  valor: number           // em centavos
  status: StatusPagamento
  evento: string
  novoStatusAssinatura: StatusAssinatura | null
}

function normalizeStripe(body: Record<string, unknown>): NormalizedPayload | null {
  const tipo = body.type as string
  const obj = (body.data as Record<string, unknown>)?.object as Record<string, unknown>
  if (!obj) return null

  const statusMap: Record<string, StatusPagamento> = {
    succeeded: StatusPagamento.APROVADO,
    payment_failed: StatusPagamento.RECUSADO,
    refunded: StatusPagamento.REEMBOLSADO,
  }

  const assinaturaMap: Record<string, StatusAssinatura> = {
    'customer.subscription.created': StatusAssinatura.ATIVA,
    'customer.subscription.updated': StatusAssinatura.ATIVA,
    'customer.subscription.deleted': StatusAssinatura.CANCELADA,
    'invoice.payment_failed': StatusAssinatura.SUSPENSA,
  }

  return {
    gatewaySubscriptionId: (obj.subscription as string) ?? (obj.id as string) ?? null,
    gatewayPaymentId: (obj.id as string) ?? null,
    valor: typeof obj.amount === 'number' ? obj.amount : typeof obj.amount_paid === 'number' ? obj.amount_paid as number : 0,
    status: statusMap[tipo] ?? StatusPagamento.PENDENTE,
    evento: tipo,
    novoStatusAssinatura: assinaturaMap[tipo] ?? null,
  }
}

function normalizeAsaas(body: Record<string, unknown>): NormalizedPayload | null {
  const evento = body.event as string
  const payment = body.payment as Record<string, unknown>
  if (!payment) return null

  const statusMap: Record<string, StatusPagamento> = {
    PAYMENT_CONFIRMED: StatusPagamento.APROVADO,
    PAYMENT_RECEIVED: StatusPagamento.APROVADO,
    PAYMENT_OVERDUE: StatusPagamento.RECUSADO,
    PAYMENT_DELETED: StatusPagamento.RECUSADO,
    PAYMENT_REFUNDED: StatusPagamento.REEMBOLSADO,
  }

  const assinaturaMap: Record<string, StatusAssinatura> = {
    PAYMENT_CONFIRMED: StatusAssinatura.ATIVA,
    PAYMENT_RECEIVED: StatusAssinatura.ATIVA,
    PAYMENT_OVERDUE: StatusAssinatura.SUSPENSA,
  }

  return {
    gatewaySubscriptionId: (payment.subscription as string) ?? null,
    gatewayPaymentId: (payment.id as string) ?? null,
    valor: typeof payment.value === 'number' ? Math.round(payment.value * 100) : 0,
    status: statusMap[evento] ?? StatusPagamento.PENDENTE,
    evento,
    novoStatusAssinatura: assinaturaMap[evento] ?? null,
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

  // Verificar autenticidade do webhook por gateway
  let valid = false
  if (gateway === 'stripe') valid = await verifyStripe(request, rawBody)
  else if (gateway === 'asaas') valid = await verifyAsaas(request)
  else if (gateway === 'mercadopago') valid = await verifyMercadoPago(request)
  else return Response.json({ error: 'Gateway não suportado' }, { status: 400 })

  if (!valid) return Response.json({ error: 'Assinatura inválida' }, { status: 401 })

  // Normalizar payload
  let normalized: NormalizedPayload | null = null
  if (gateway === 'stripe') normalized = normalizeStripe(body)
  else if (gateway === 'asaas') normalized = normalizeAsaas(body)

  if (!normalized) {
    // Evento desconhecido — registrar e ignorar
    console.log(`[webhook/${gateway}] evento ignorado:`, body)
    return Response.json({ ok: true })
  }

  // Buscar assinatura pelo gatewaySubscriptionId
  let assinatura = normalized.gatewaySubscriptionId
    ? await prisma.assinatura.findFirst({
        where: { gatewaySubscriptionId: normalized.gatewaySubscriptionId },
      })
    : null

  if (!assinatura) {
    console.warn(`[webhook/${gateway}] assinatura não encontrada para subscriptionId=${normalized.gatewaySubscriptionId}`)
    return Response.json({ ok: true })
  }

  // Registrar pagamento
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

  // Atualizar status da assinatura se necessário
  if (normalized.novoStatusAssinatura && normalized.novoStatusAssinatura !== assinatura.status) {
    const updateData: Record<string, unknown> = { status: normalized.novoStatusAssinatura }
    if (normalized.novoStatusAssinatura === StatusAssinatura.CANCELADA) {
      updateData.canceladaEm = new Date()
    }
    assinatura = await prisma.assinatura.update({
      where: { id: assinatura.id },
      data: updateData,
    })

    const acaoMap: Record<StatusAssinatura, AuditAcao> = {
      ATIVA: AuditAcao.ASSINATURA_ATUALIZADA,
      TRIAL: AuditAcao.ASSINATURA_ATUALIZADA,
      SUSPENSA: AuditAcao.ASSINATURA_ATUALIZADA,
      CANCELADA: AuditAcao.ASSINATURA_CANCELADA,
      EXPIRADA: AuditAcao.ASSINATURA_EXPIRADA,
    }

    await prisma.auditLog.create({
      data: {
        tenantId: assinatura.tenantId,
        userId: null,
        acao: acaoMap[normalized.novoStatusAssinatura],
        recursoTipo: 'Assinatura',
        recursoId: assinatura.id,
        ip: request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'webhook',
        userAgent: gateway,
      },
    })
  }

  await prisma.auditLog.create({
    data: {
      tenantId: assinatura.tenantId,
      userId: null,
      acao: AuditAcao.PAGAMENTO_REGISTRADO,
      recursoTipo: 'PagamentoLog',
      recursoId: pagamento.id,
      ip: request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'webhook',
      userAgent: gateway,
    },
  })

  return Response.json({ ok: true })
}
