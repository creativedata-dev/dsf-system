import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { encrypt, decrypt } from '@/lib/crypto'

const GATEWAYS_DISPONIVEIS = [
  { gateway: 'stripe',       label: 'Stripe' },
  { gateway: 'asaas',        label: 'Asaas' },
  { gateway: 'mercadopago',  label: 'Mercado Pago' },
]

function maskKey(key: string | null) {
  if (!key) return null
  return key.slice(0, 7) + '••••••••••••••••' + key.slice(-4)
}

// GET — lista todos os gateways com status de configuração
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Não autorizado' }, { status: 401 })
  if (!(session.user.permissions as string[]).includes('SUPER_ADMIN_GLOBAIS')) {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const configs = await prisma.gatewayConfig.findMany()
  const configMap = Object.fromEntries(configs.map(c => [c.gateway, c]))

  const gateways = GATEWAYS_DISPONIVEIS.map(g => {
    const c = configMap[g.gateway]
    return {
      gateway: g.gateway,
      label: g.label,
      ativo: c?.ativo ?? false,
      modoTeste: c?.modoTeste ?? true,
      publicKey: c?.publicKey ?? null,
      secretKeyMasked: c?.secretKeyEncrypted ? maskKey((() => { try { return decrypt(c.secretKeyEncrypted!) } catch { return null } })()) : null,
      webhookConfigured: !!c?.webhookSecretEncrypted,
      createdAt: c?.createdAt?.toISOString() ?? null,
      updatedAt: c?.updatedAt?.toISOString() ?? null,
    }
  })

  return Response.json({ gateways })
}

// POST/PATCH — salva configuração de um gateway
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Não autorizado' }, { status: 401 })
  if (!(session.user.permissions as string[]).includes('SUPER_ADMIN_GLOBAIS')) {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  let body: {
    gateway: string
    secretKey?: string
    webhookSecret?: string
    publicKey?: string
    ativo?: boolean
    modoTeste?: boolean
  }
  try { body = await request.json() } catch {
    return Response.json({ error: 'Corpo inválido' }, { status: 400 })
  }

  const valid = GATEWAYS_DISPONIVEIS.map(g => g.gateway)
  if (!valid.includes(body.gateway)) {
    return Response.json({ error: 'Gateway inválido' }, { status: 400 })
  }

  const existing = await prisma.gatewayConfig.findUnique({ where: { gateway: body.gateway } })

  const data: Record<string, unknown> = {}
  if (body.secretKey !== undefined && body.secretKey !== '') {
    data.secretKeyEncrypted = encrypt(body.secretKey)
  }
  if (body.webhookSecret !== undefined && body.webhookSecret !== '') {
    data.webhookSecretEncrypted = encrypt(body.webhookSecret)
  }
  if (body.publicKey !== undefined) data.publicKey = body.publicKey || null
  if (body.ativo !== undefined) data.ativo = body.ativo
  if (body.modoTeste !== undefined) data.modoTeste = body.modoTeste

  const label = GATEWAYS_DISPONIVEIS.find(g => g.gateway === body.gateway)!.label

  const config = existing
    ? await prisma.gatewayConfig.update({ where: { gateway: body.gateway }, data })
    : await prisma.gatewayConfig.create({ data: { gateway: body.gateway, label, ...data } })

  return Response.json({
    gateway: config.gateway,
    ativo: config.ativo,
    modoTeste: config.modoTeste,
    updated: true,
  })
}
