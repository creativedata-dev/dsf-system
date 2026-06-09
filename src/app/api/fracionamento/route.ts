import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasModulo } from '@/lib/modulos'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { tenantId } = session.user

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { modulosHabilitados: true },
  })
  if (!hasModulo(tenant?.modulosHabilitados ?? [], 'FRACIONAMENTO')) {
    return NextResponse.json({ error: 'Módulo não habilitado' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const loteId = searchParams.get('loteId')

  const fracionamentos = await prisma.fracionamentoLote.findMany({
    where: {
      tenantId,
      ...(loteId ? { loteId } : {}),
    },
    include: {
      lote: {
        include: { produto: { select: { nome: true } } },
      },
      fracoes: { orderBy: { numero: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const result = fracionamentos.map(f => ({
    id: f.id,
    loteId: f.loteId,
    nomeProduto: f.lote.produto.nome,
    fabricante: f.lote.fabricante,
    lote: f.lote.lote,
    validade: f.lote.validade,
    quantidadeFracionada: Number(f.quantidadeFracionada),
    unidadeOrigem: f.unidadeOrigem,
    totalFracoes: f.totalFracoes,
    obs: f.obs,
    dataFracionamento: f.dataFracionamento,
    createdAt: f.createdAt,
    fracoes: f.fracoes.map(fr => ({
      id: fr.id,
      numero: fr.numero,
      quantidade: Number(fr.quantidade),
      unidade: fr.unidade,
      destinacao: fr.destinacao,
      etiquetaImpressaEm: fr.etiquetaImpressaEm,
    })),
  }))

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { tenantId, id: userId, permissions } = session.user

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { modulosHabilitados: true },
  })
  if (!hasModulo(tenant?.modulosHabilitados ?? [], 'FRACIONAMENTO')) {
    return NextResponse.json({ error: 'Módulo não habilitado' }, { status: 403 })
  }

  if (!permissions.includes('FRACIONAMENTO_GERENCIAR') && !permissions.includes('SUPER_ADMIN_GLOBAIS')) {
    return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 })
  }

  const body = await req.json()
  const { loteId, quantidadeFracionada, fracoes, obs } = body

  if (!loteId || quantidadeFracionada == null || !Array.isArray(fracoes) || fracoes.length === 0) {
    return NextResponse.json(
      { error: 'Campos obrigatórios: loteId, quantidadeFracionada, fracoes (array)' },
      { status: 400 },
    )
  }

  for (const fr of fracoes) {
    if (fr.quantidade == null || !fr.unidade) {
      return NextResponse.json(
        { error: 'Cada fração precisa de quantidade e unidade' },
        { status: 400 },
      )
    }
  }

  const lote = await prisma.loteProduto.findUnique({
    where: { id: loteId },
    select: { tenantId: true, unidade: true, status: true },
  })
  if (!lote || lote.tenantId !== tenantId) {
    return NextResponse.json({ error: 'Lote não encontrado' }, { status: 404 })
  }
  if (lote.status !== 'ATIVO') {
    return NextResponse.json({ error: 'Apenas lotes ATIVOS podem ser fracionados' }, { status: 422 })
  }

  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  const userAgent = req.headers.get('user-agent') ?? 'unknown'

  const fracionamento = await prisma.fracionamentoLote.create({
    data: {
      tenantId,
      loteId,
      usuarioId: userId,
      quantidadeFracionada,
      unidadeOrigem: lote.unidade,
      totalFracoes: fracoes.length,
      obs: obs || null,
      fracoes: {
        create: fracoes.map((fr: { quantidade: number; unidade: string; destinacao?: string }, idx: number) => ({
          tenantId,
          numero: idx + 1,
          quantidade: fr.quantidade,
          unidade: fr.unidade,
          destinacao: fr.destinacao || null,
        })),
      },
    },
    include: { fracoes: { orderBy: { numero: 'asc' } } },
  })

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      acao: 'FRACAO_CRIADA',
      recursoTipo: 'FracionamentoLote',
      recursoId: fracionamento.id,
      ip,
      userAgent,
    },
  })

  return NextResponse.json(fracionamento, { status: 201 })
}
