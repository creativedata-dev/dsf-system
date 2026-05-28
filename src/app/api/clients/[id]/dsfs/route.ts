import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TIPO_SERVICO_LABELS } from '@/lib/tipo-servico'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const tenantId = session.user.tenantId

  // Verifica isolamento de tenant
  const cliente = await prisma.cliente.findUnique({
    where: { id },
    select: { tenantId: true },
  })
  if (!cliente || cliente.tenantId !== tenantId) {
    return Response.json({ error: 'Cliente não encontrado' }, { status: 404 })
  }

  const dsfs = await prisma.dSF.findMany({
    where: { clienteId: id },
    select: {
      id: true,
      numeroDsf: true,
      tipoServico: true,
      dataEmissao: true,
      status: true,
      driveFileId: true,
      observacoes: true,
      responsavelTecnico: { select: { nome: true, crf: true } },
    },
    orderBy: { dataEmissao: 'desc' },
    take: 20,
  })

  return Response.json({
    dsfs: dsfs.map((d) => ({
      id: d.id,
      numeroDsf: d.numeroDsf,
      tipoServico: d.tipoServico,
      tipoServicoLabel: TIPO_SERVICO_LABELS[d.tipoServico] ?? d.tipoServico,
      dataEmissao: d.dataEmissao.toISOString(),
      status: d.status,
      driveFileId: d.driveFileId,
      observacoes: d.observacoes,
      rtNome: d.responsavelTecnico.nome,
      rtCrf: d.responsavelTecnico.crf,
    })),
  })
}
