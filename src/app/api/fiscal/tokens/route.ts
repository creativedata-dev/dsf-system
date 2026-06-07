import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasModulo } from '@/lib/modulos'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tokens = await prisma.tokenFiscal.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { logs: { orderBy: { createdAt: 'desc' }, take: 5 } },
  })

  const now = new Date()
  return NextResponse.json(tokens.map(t => ({
    id: t.id,
    token: t.token,
    secoes: t.secoes,
    dataInicio: t.dataInicio,
    dataFim: t.dataFim,
    expiraEm: t.expiraEm,
    usadoEm: t.usadoEm,
    createdAt: t.createdAt,
    expirado: now > t.expiraEm || t.usadoEm !== null,
    logs: t.logs,
  })))
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await prisma.tenant.findUnique({ where: { id: session.user.tenantId } })
  if (!tenant || !hasModulo(tenant.modulosHabilitados, 'PAINEL_FISCAL')) {
    return NextResponse.json({ error: 'Módulo não habilitado' }, { status: 403 })
  }

  const body = await req.json()
  const { secoes, dataInicio, dataFim } = body as {
    secoes: string[]; dataInicio: string; dataFim: string
  }

  if (!secoes?.length || !dataInicio || !dataFim) {
    return NextResponse.json({ error: 'Campos obrigatórios: secoes, dataInicio, dataFim' }, { status: 400 })
  }

  const VALID_SECOES = ['TEMPERATURA', 'EQUIPAMENTOS', 'POPS', 'VALIDADE']
  if (!secoes.every(s => VALID_SECOES.includes(s))) {
    return NextResponse.json({ error: 'Seção inválida' }, { status: 400 })
  }

  const now = new Date()
  const expiraEm = new Date(now.getTime() + 30 * 60 * 1000)
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  const userAgent = req.headers.get('user-agent') ?? ''

  const token = await prisma.tokenFiscal.create({
    data: {
      tenantId: session.user.tenantId,
      usuarioId: session.user.id,
      secoes,
      dataInicio: new Date(dataInicio + 'T00:00:00Z'),
      dataFim: new Date(dataFim + 'T00:00:00Z'),
      expiraEm,
    },
  })

  await prisma.tokenFiscalLog.create({
    data: { tokenId: token.id, evento: 'GERADO', ip, userAgent },
  })

  await prisma.auditLog.create({
    data: {
      tenantId: session.user.tenantId,
      userId: session.user.id,
      acao: 'TOKEN_FISCAL_GERADO',
      recursoTipo: 'TokenFiscal',
      recursoId: token.id,
      ip,
      userAgent,
    },
  })

  return NextResponse.json({ token: token.token, expiraEm })
}
