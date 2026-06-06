import Stripe from 'stripe'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/crypto'

// Retorna instância Stripe configurada com a chave do banco
export async function getStripe(): Promise<Stripe> {
  const config = await prisma.gatewayConfig.findUnique({ where: { gateway: 'stripe' } })
  if (!config || !config.ativo || !config.secretKeyEncrypted) {
    throw new Error('Gateway Stripe não configurado ou inativo.')
  }
  const secretKey = decrypt(config.secretKeyEncrypted)
  return new Stripe(secretKey, { apiVersion: '2026-05-27.dahlia' })
}

// Retorna o webhook secret descriptografado
export async function getStripeWebhookSecret(): Promise<string> {
  const config = await prisma.gatewayConfig.findUnique({ where: { gateway: 'stripe' } })
  if (!config?.webhookSecretEncrypted) throw new Error('Stripe webhook secret não configurado.')
  return decrypt(config.webhookSecretEncrypted)
}

export type { Stripe }
