import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const config = await prisma.configAlerta.findUnique({
    where: { tenantId: session.user.tenantId },
  })

  return NextResponse.json(config ?? {
    horaLimiteTemp: '18:00',
    diasAntecedEquip: 30,
    alertaTemp: true,
    alertaEquip: true,
    alertaValidade: true,
  })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json() as {
    horaLimiteTemp?: string
    diasAntecedEquip?: number
    alertaTemp?: boolean
    alertaEquip?: boolean
    alertaValidade?: boolean
  }

  const existing = await prisma.configAlerta.findUnique({
    where: { tenantId: session.user.tenantId },
  })

  const data = {
    horaLimiteTemp: body.horaLimiteTemp,
    diasAntecedEquip: body.diasAntecedEquip,
    alertaTemp: body.alertaTemp,
    alertaEquip: body.alertaEquip,
    alertaValidade: body.alertaValidade,
  }

  const cleaned = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  )

  if (existing) {
    await prisma.configAlerta.update({
      where: { tenantId: session.user.tenantId },
      data: cleaned,
    })
  } else {
    await prisma.configAlerta.create({
      data: { tenantId: session.user.tenantId, ...cleaned },
    })
  }

  return NextResponse.json({ ok: true })
}
