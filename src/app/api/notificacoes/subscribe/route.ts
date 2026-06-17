import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { endpoint, keys } = await req.json() as {
    endpoint: string
    keys: { p256dh: string; auth: string }
  }

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  const existing = await prisma.pushSubscription.findUnique({ where: { endpoint } })

  if (existing) {
    await prisma.pushSubscription.update({
      where: { endpoint },
      data: { p256dh: keys.p256dh, auth: keys.auth, userId: session.user.id, tenantId: session.user.tenantId },
    })
  } else {
    await prisma.pushSubscription.create({
      data: {
        userId: session.user.id,
        tenantId: session.user.tenantId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
    })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { endpoint } = await req.json() as { endpoint: string }
  if (!endpoint) return NextResponse.json({ error: 'Endpoint obrigatório' }, { status: 400 })

  await prisma.pushSubscription.deleteMany({
    where: { endpoint, userId: session.user.id },
  })

  return NextResponse.json({ ok: true })
}
