import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  const userAgent = req.headers.get('user-agent') ?? ''

  const tk = await prisma.tokenFiscal.findUnique({ where: { token } })
  if (!tk) return NextResponse.json({ error: 'Token inválido' }, { status: 404 })

  const now = new Date()
  if (now > tk.expiraEm) return NextResponse.json({ error: 'Token expirado' }, { status: 410 })
  if (tk.usadoEm !== null) return NextResponse.json({ error: 'Token já utilizado' }, { status: 410 })

  // Marca como usado (single-use)
  await prisma.tokenFiscal.update({ where: { id: tk.id }, data: { usadoEm: now } })
  await prisma.tokenFiscalLog.create({ data: { tokenId: tk.id, evento: 'ABERTO', ip, userAgent } })
  await prisma.auditLog.create({
    data: {
      tenantId: tk.tenantId,
      userId: tk.usuarioId,
      acao: 'TOKEN_FISCAL_ABERTO',
      recursoTipo: 'TokenFiscal',
      recursoId: tk.id,
      ip,
      userAgent,
    },
  })

  const tenant = await prisma.tenant.findUnique({ where: { id: tk.tenantId } })
  if (!tenant) return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 })

  const inicio = tk.dataInicio
  const fim = new Date(tk.dataFim.getTime() + 24 * 60 * 60 * 1000)

  const result: Record<string, unknown> = {
    tenant: {
      nome: tenant.nomeFantasia,
      cnpj: tenant.cnpj,
      endereco: tenant.endereco,
      alvara: tenant.alvaraSanitario,
    },
    dataInicio: tk.dataInicio,
    dataFim: tk.dataFim,
    secoes: tk.secoes,
    geradoEm: now,
  }

  if (tk.secoes.includes('TEMPERATURA')) {
    const registros = await prisma.registroTermoHigrometria.findMany({
      where: { tenantId: tk.tenantId, dataLeitura: { gte: inicio, lt: fim } },
      orderBy: { dataLeitura: 'asc' },
      include: { usuario: { select: { nome: true } }, ambiente: { select: { nome: true } } },
    })
    result.temperatura = registros.map(r => ({
      dataLeitura: r.dataLeitura,
      periodo: r.periodo,
      ambienteNome: r.ambiente.nome,
      temperaturaGraus: r.temperaturaGraus,
      umidadePercent: r.umidadePercent,
      nomeUsuario: r.usuario.nome,
      alertaDisparado: r.alertaDisparado,
    }))
  }

  if (tk.secoes.includes('EQUIPAMENTOS')) {
    const equips = await prisma.equipamento.findMany({
      where: { tenantId: tk.tenantId, ativo: true },
      orderBy: { nome: 'asc' },
    })
    result.equipamentos = equips.map(e => ({
      nome: e.nome,
      marcaModelo: e.marcaModelo ?? '',
      numeroSerie: e.numeroSerie,
      status: e.status,
      dataUltimaCalibracao: e.dataUltimaCalibracao,
      dataProximaCalibracao: e.dataProximaCalibracao,
      numeroCertificado: e.numeroCertificado,
      laboratorio: e.laboratorio,
    }))
  }

  if (tk.secoes.includes('POPS')) {
    const assinaturas = await prisma.assinaturaPOP.findMany({
      where: { tenantId: tk.tenantId, createdAt: { gte: inicio, lt: fim } },
      include: {
        documento: { select: { codigo: true, titulo: true, versao: true } },
        usuario: { select: { nome: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    const totalUsuarios = await prisma.user.count({ where: { tenantId: tk.tenantId, ativo: true } })

    const grouped = new Map<string, { codigo: string; titulo: string; versao: string; assinaturas: unknown[] }>()
    for (const ass of assinaturas) {
      const key = ass.documentoId
      if (!grouped.has(key)) {
        grouped.set(key, {
          codigo: ass.documento.codigo,
          titulo: ass.documento.titulo,
          versao: ass.documento.versao,
          assinaturas: [],
        })
      }
      grouped.get(key)!.assinaturas.push({
        nomeUsuario: ass.usuario.nome,
        aprovado: ass.aprovado,
        acertos: ass.acertos,
        totalQuestoes: ass.totalQuestoes,
        createdAt: ass.createdAt,
      })
    }

    result.pops = Array.from(grouped.values()).map(p => ({ ...p, totalUsuarios }))
  }

  if (tk.secoes.includes('VALIDADE')) {
    const lotes = await prisma.loteProduto.findMany({
      where: { tenantId: tk.tenantId, ativo: true },
      orderBy: { validade: 'asc' },
      include: { produto: { select: { nome: true } }, descarte: true },
    })
    result.validade = lotes.map(l => ({
      nomeProduto: l.produto.nome,
      fabricante: l.fabricante,
      lote: l.lote,
      validade: l.validade,
      quantidade: Number(l.quantidade),
      unidade: l.unidade,
      status: l.status,
      descarte: l.descarte ? {
        numeroAuto: l.descarte.numeroAuto,
        motivo: l.descarte.motivo,
        dataDescarte: l.descarte.dataDescarte,
        responsavel: l.descarte.responsavel,
      } : null,
    }))
  }

  return NextResponse.json(result)
}
