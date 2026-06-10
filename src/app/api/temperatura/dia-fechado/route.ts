import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Neon HTTP adapter pode retornar @db.Date como string ou Date — normaliza para YYYY-MM-DD
function toDateStr(val: Date | string): string {
  if (typeof val === 'string') return val.slice(0, 10)
  return val.toISOString().slice(0, 10)
}

// Armazena sempre ao meio-dia UTC para evitar off-by-one de timezone
function parseDate(yyyyMmDd: string): Date {
  return new Date(`${yyyyMmDd}T12:00:00.000Z`)
}

// GET /api/temperatura/dia-fechado?dataInicio=YYYY-MM-DD&dataFim=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { tenantId } = session.user

  const { searchParams } = new URL(req.url)
  const dataInicio = searchParams.get('dataInicio')
  const dataFim = searchParams.get('dataFim')

  const dias = await prisma.diaFechado.findMany({
    where: {
      tenantId,
      ...(dataInicio && dataFim ? {
        data: { gte: parseDate(dataInicio), lte: parseDate(dataFim) },
      } : {}),
    },
    select: { id: true, data: true, motivo: true, usuarioId: true },
    orderBy: { data: 'asc' },
  })

  return NextResponse.json(dias.map(d => ({
    ...d,
    data: toDateStr(d.data as Date | string),
  })))
}

// POST /api/temperatura/dia-fechado  { data: "YYYY-MM-DD", motivo?: string }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { tenantId, id: usuarioId } = session.user

  const body = await req.json()
  const { data, motivo } = body as { data: string; motivo?: string }
  if (!data) return NextResponse.json({ error: 'Data obrigatória' }, { status: 400 })

  const dataDate = parseDate(data)

  const existing = await prisma.diaFechado.findFirst({
    where: { tenantId, data: dataDate },
  })

  if (existing) {
    const updated = await prisma.diaFechado.update({
      where: { id: existing.id },
      data: { motivo: motivo ?? null, usuarioId },
    })
    return NextResponse.json({ ...updated, data: toDateStr(updated.data as Date | string) })
  }

  const criado = await prisma.diaFechado.create({
    data: { tenantId, data: dataDate, motivo: motivo ?? null, usuarioId },
  })
  return NextResponse.json(
    { ...criado, data: toDateStr(criado.data as Date | string) },
    { status: 201 },
  )
}

// DELETE /api/temperatura/dia-fechado?data=YYYY-MM-DD
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { tenantId } = session.user

  const { searchParams } = new URL(req.url)
  const data = searchParams.get('data')
  if (!data) return NextResponse.json({ error: 'Data obrigatória' }, { status: 400 })

  await prisma.diaFechado.deleteMany({
    where: { tenantId, data: parseDate(data) },
  })

  return new NextResponse(null, { status: 204 })
}
