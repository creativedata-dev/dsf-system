import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { tenantId, id: userId } = session.user
  const { id: documentoId } = await params

  // Busca a tentativa aprovada mais recente ainda sem termo
  const assinatura = await prisma.assinaturaPOP.findFirst({
    where: { documentoId, usuarioId: userId, tenantId, aprovado: true, termoAceito: false },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  })

  if (!assinatura) {
    return NextResponse.json({ error: 'Nenhuma tentativa aprovada pendente de termo' }, { status: 404 })
  }

  const agora = new Date()
  await prisma.assinaturaPOP.update({
    where: { id: assinatura.id },
    data: { termoAceito: true, termoAceitoEm: agora },
  })

  const ip = _req.headers.get('x-forwarded-for') ?? _req.headers.get('x-real-ip') ?? 'unknown'
  const userAgent = _req.headers.get('user-agent') ?? 'unknown'

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      acao: 'POP_CONCLUIDO',
      recursoTipo: 'DocumentoPOP',
      recursoId: documentoId,
      ip,
      userAgent,
    },
  })

  return NextResponse.json({ ok: true, termoAceitoEm: agora.toISOString() })
}
