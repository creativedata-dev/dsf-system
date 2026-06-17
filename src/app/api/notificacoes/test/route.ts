import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendPush } from '@/lib/web-push'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { tipo = 'temperatura' } = await req.json().catch(() => ({})) as { tipo?: string }

  const subs = await prisma.pushSubscription.findMany({
    where: { userId: session.user.id },
  })

  if (subs.length === 0) {
    return NextResponse.json({ error: 'Nenhuma subscription encontrada para este usuário' }, { status: 404 })
  }

  const payloads: Record<string, { title: string; body: string; url: string; tag: string }> = {
    temperatura: {
      title: 'FarmaSign — Temperatura (teste)',
      body: 'Leitura de temperatura não registrada ontem. Verifique os ambientes monitorados.',
      url: '/dashboard/temperatura',
      tag: 'alerta-temperatura',
    },
    equipamentos: {
      title: 'FarmaSign — Equipamentos (teste)',
      body: 'Equipamento(s) com calibração vencendo em 30 dias. Agende a recalibração.',
      url: '/dashboard/equipamentos',
      tag: 'alerta-equipamentos',
    },
    validade: {
      title: 'FarmaSign — Validade de Lotes (teste)',
      body: '3 lotes vencendo em 30 dias. Verifique o estoque.',
      url: '/dashboard/validade',
      tag: 'alerta-validade',
    },
  }

  const payload = payloads[tipo] ?? payloads.temperatura

  const results = await Promise.all(subs.map(sub => sendPush(sub, payload)))
  const ok = results.filter(r => r.ok).length

  return NextResponse.json({ enviadas: ok, total: subs.length })
}
