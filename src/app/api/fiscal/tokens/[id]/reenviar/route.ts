import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  const userAgent = req.headers.get('user-agent') ?? ''

  const original = await prisma.tokenFiscal.findUnique({ where: { id } })
  if (!original || original.tenantId !== session.user.tenantId) {
    return NextResponse.json({ error: 'Token não encontrado' }, { status: 404 })
  }

  // Log REENVIADO no token original
  await prisma.tokenFiscalLog.create({
    data: { tokenId: original.id, evento: 'REENVIADO', ip, userAgent },
  })

  // Novo token com mesmas configurações, nova expiração
  const expiraEm = new Date(Date.now() + 30 * 60 * 1000)
  const novoToken = await prisma.tokenFiscal.create({
    data: {
      tenantId: original.tenantId,
      usuarioId: session.user.id,
      secoes: original.secoes,
      dataInicio: original.dataInicio,
      dataFim: original.dataFim,
      expiraEm,
    },
  })

  await prisma.tokenFiscalLog.create({
    data: { tokenId: novoToken.id, evento: 'GERADO', ip, userAgent },
  })

  await prisma.auditLog.create({
    data: {
      tenantId: session.user.tenantId,
      userId: session.user.id,
      acao: 'TOKEN_FISCAL_REENVIADO',
      recursoTipo: 'TokenFiscal',
      recursoId: novoToken.id,
      ip,
      userAgent,
    },
  })

  return NextResponse.json({ token: novoToken.token, expiraEm })
}
