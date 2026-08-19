import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TIPO_SERVICO_LABELS } from '@/lib/tipo-servico'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { tenantId } = session.user
  const { id } = await params

  const dsf = await prisma.dSF.findUnique({
    where: { id },
    include: {
      cliente: { select: { nome: true, cpf: true, dataNascimento: true, telefone: true, email: true } },
      insumos: { select: { nomeProduto: true, lote: true, fabricante: true, validade: true } },
      responsavelTecnico: { select: { nome: true, crf: true } },
      tenant: { select: { nomeFantasia: true, cnpj: true, telefone: true, logoUrl: true, tipoImpressao: true } },
    },
  })

  if (!dsf || dsf.tenantId !== tenantId) {
    return NextResponse.json({ error: 'DSF não encontrada' }, { status: 404 })
  }

  const config = await prisma.procedimentoConfig.findFirst({
    where: { tenantId, tipoServico: dsf.tipoServico },
    select: { textoOrientacao: true },
  })

  return NextResponse.json({
    id: dsf.id,
    numeroDsf: dsf.numeroDsf,
    dataEmissao: dsf.dataEmissao,
    status: dsf.status,
    tipoServico: dsf.tipoServico,
    tipoServicoLabel: TIPO_SERVICO_LABELS[dsf.tipoServico as string] ?? (dsf.tipoServico as string),
    textoOrientacao: config?.textoOrientacao ?? null,
    observacoes: dsf.observacoes,
    drogariaNome: dsf.tenant.nomeFantasia,
    drogariaCnpj: dsf.tenant.cnpj ?? undefined,
    drogariaTelefone: dsf.tenant.telefone ?? undefined,
    drogariaLogoUrl: dsf.tenant.logoUrl,
    tipoImpressao: dsf.tenant.tipoImpressao,
    rtNome: dsf.responsavelTecnico.nome,
    rtCrf: dsf.responsavelTecnico.crf,
    clienteNome: dsf.cliente.nome,
    clienteCpf: dsf.cliente.cpf,
    clienteDataNasc: dsf.cliente.dataNascimento,
    clienteTelefone: dsf.cliente.telefone,
    clienteEmail: dsf.cliente.email,
    insumos: dsf.insumos.map(i => ({
      nomeProduto: i.nomeProduto,
      lote: i.lote,
      fabricante: i.fabricante,
      validade: i.validade,
    })),
  })
}
