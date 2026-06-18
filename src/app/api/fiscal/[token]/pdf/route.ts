import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateFiscalPdf } from '@/lib/pdf-fiscal'

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const tk = await prisma.tokenFiscal.findUnique({ where: { token } })
  if (!tk) return NextResponse.json({ error: 'Token inválido' }, { status: 404 })

  // PDF pode ser baixado mesmo após uso único (já foi validado na abertura)
  // mas exige que o token exista (não expirado por tempo se nunca usado, ou já usado)
  const now = new Date()
  if (!tk.usadoEm && now > tk.expiraEm) {
    return NextResponse.json({ error: 'Token expirado' }, { status: 410 })
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tk.tenantId } })
  if (!tenant) return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 })

  const inicio = tk.dataInicio
  const fim = new Date(tk.dataFim.getTime() + 24 * 60 * 60 * 1000)
  const tokenUrl = `${req.nextUrl.origin}/fiscal/${token}`

  const input: Parameters<typeof generateFiscalPdf>[0] = {
    tenantNome: tenant.nomeFantasia,
    tenantCnpj: tenant.cnpj ?? undefined,
    tenantEndereco: tenant.endereco ?? undefined,
    tenantAlvara: tenant.alvaraSanitario ?? undefined,
    dataInicio: tk.dataInicio.toISOString().slice(0, 10),
    dataFim: tk.dataFim.toISOString().slice(0, 10),
    geradoEm: now,
    tokenUrl,
    secoes: tk.secoes,
  }

  if (tk.secoes.includes('TEMPERATURA')) {
    const registros = await prisma.registroTermoHigrometria.findMany({
      where: { tenantId: tk.tenantId, dataLeitura: { gte: inicio, lt: fim } },
      orderBy: { dataLeitura: 'asc' },
      include: { usuario: { select: { nome: true } }, ambiente: { select: { nome: true } } },
    })
    input.temperatura = registros.map(r => ({
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
    input.equipamentos = equips.map(e => ({
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
    })
    const totalUsuarios = await prisma.user.count({ where: { tenantId: tk.tenantId, ativo: true } })
    type PopItem = { codigo: string; titulo: string; versao: string; totalUsuarios: number; assinaturas: { nomeUsuario: string; aprovado: boolean; acertos: number; totalQuestoes: number; createdAt: Date }[] }
    const grouped = new Map<string, PopItem>()
    for (const ass of assinaturas) {
      const key = ass.documentoId
      if (!grouped.has(key)) {
        grouped.set(key, {
          codigo: ass.documento.codigo,
          titulo: ass.documento.titulo,
          versao: ass.documento.versao,
          totalUsuarios,
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
    input.pops = Array.from(grouped.values())
  }

  if (tk.secoes.includes('VALIDADE')) {
    const lotes = await prisma.loteProduto.findMany({
      where: { tenantId: tk.tenantId, ativo: true },
      orderBy: { validade: 'asc' },
      include: { produto: { select: { nome: true } }, descarte: true },
    })
    input.validade = lotes.map(l => ({
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

  const bytes = await generateFiscalPdf(input)
  const buffer = Buffer.from(bytes)
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="conformidade-${tenant.cnpj}-${input.dataInicio}.pdf"`,
    },
  })
}
