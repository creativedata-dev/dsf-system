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
  if (!hasModulo(tenant?.modulosHabilitados ?? [], 'VALIDADE')) {
    return NextResponse.json({ error: 'Módulo não habilitado' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') // "ATIVO"|"QUARENTENA"|"DESCARTADO"
  const horizonte = searchParams.get('horizonte') // "VENCENDO_90"|"VENCENDO_30"|"VENCIDO"

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  let validadeFilter: object | undefined
  if (horizonte === 'VENCIDO') {
    validadeFilter = { lt: hoje }
  } else if (horizonte === 'VENCENDO_30') {
    const limite = new Date(hoje)
    limite.setDate(limite.getDate() + 30)
    validadeFilter = { gte: hoje, lte: limite }
  } else if (horizonte === 'VENCENDO_90') {
    const limite = new Date(hoje)
    limite.setDate(limite.getDate() + 90)
    validadeFilter = { gte: hoje, lte: limite }
  }

  const lotes = await prisma.loteProduto.findMany({
    where: {
      tenantId,
      ativo: true,
      ...(status ? { status } : {}),
      ...(validadeFilter ? { validade: validadeFilter } : {}),
    },
    include: {
      produto: { select: { id: true, nome: true } },
      descarte: { select: { id: true, numeroAuto: true, motivo: true, dataDescarte: true, responsavel: true } },
    },
    orderBy: { validade: 'asc' },
  })

  const agora = new Date()
  agora.setHours(0, 0, 0, 0)

  const result = lotes.map(l => {
    const diffMs = l.validade.getTime() - agora.getTime()
    const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    let alerta: string | null = null
    if (diffDias < 0) alerta = 'VENCIDO'
    else if (diffDias <= 30) alerta = 'VENCENDO_30'
    else if (diffDias <= 90) alerta = 'VENCENDO_90'

    return {
      id: l.id,
      nomeProduto: l.produto.nome,
      produtoCatalogoId: l.produtoCatalogoId,
      fabricante: l.fabricante,
      lote: l.lote,
      validade: l.validade,
      diffDias,
      quantidade: Number(l.quantidade),
      unidade: l.unidade,
      status: l.status,
      alerta,
      localizacao: l.localizacao,
      obs: l.obs,
      descarte: l.descarte,
      createdAt: l.createdAt,
    }
  })

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { tenantId, id: userId } = session.user

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { modulosHabilitados: true },
  })
  if (!hasModulo(tenant?.modulosHabilitados ?? [], 'VALIDADE')) {
    return NextResponse.json({ error: 'Módulo não habilitado' }, { status: 403 })
  }

  const body = await req.json()
  const { nomeProduto, fabricante, lote, validade, quantidade, unidade, localizacao, obs } = body

  if (!nomeProduto || !fabricante || !lote || !validade || quantidade == null || !unidade) {
    return NextResponse.json({ error: 'Campos obrigatórios: nomeProduto, fabricante, lote, validade, quantidade, unidade' }, { status: 400 })
  }

  // Catálogo: busca ou cria produto pelo nome
  let produtoCatalogo = await prisma.produtoCatalogo.findUnique({
    where: { tenantId_nome: { tenantId, nome: nomeProduto } },
  })
  if (!produtoCatalogo) {
    produtoCatalogo = await prisma.produtoCatalogo.create({
      data: { tenantId, nome: nomeProduto, fabricante, unidadePadrao: unidade },
    })
  }

  const loteProduto = await prisma.loteProduto.create({
    data: {
      tenantId,
      produtoCatalogoId: produtoCatalogo.id,
      fabricante,
      lote,
      validade: new Date(validade),
      quantidade,
      unidade,
      localizacao: localizacao || null,
      obs: obs || null,
    },
  })

  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  const userAgent = req.headers.get('user-agent') ?? 'unknown'
  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      acao: 'LOTE_CRIADO',
      recursoTipo: 'LoteProduto',
      recursoId: loteProduto.id,
      ip,
      userAgent,
    },
  })

  return NextResponse.json({ ...loteProduto, nomeProduto }, { status: 201 })
}
