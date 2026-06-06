import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateTemperaturaPdf } from '@/lib/pdf-temperatura'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const tenantId = session.user.tenantId
  const { searchParams } = new URL(request.url)
  const ambienteId = searchParams.get('ambienteId')
  const dataInicio = searchParams.get('dataInicio')
  const dataFim = searchParams.get('dataFim')

  if (!dataInicio || !dataFim) {
    return Response.json({ error: 'dataInicio e dataFim obrigatórios' }, { status: 400 })
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { nomeFantasia: true, cnpj: true },
  })
  if (!tenant) return Response.json({ error: 'Tenant não encontrado' }, { status: 404 })

  const registros = await prisma.registroTermoHigrometria.findMany({
    where: {
      tenantId,
      ...(ambienteId && { ambienteId }),
      dataLeitura: {
        gte: new Date(dataInicio),
        lte: new Date(dataFim),
      },
    },
    include: {
      ambiente: { select: { nome: true, tempMin: true, tempMax: true, umidadeMin: true, umidadeMax: true } },
    },
    orderBy: [{ dataLeitura: 'asc' }, { periodo: 'asc' }],
  })

  const userIds = [...new Set(registros.map(r => r.usuarioId))]
  const usuarios = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, nome: true },
  })
  const userMap = Object.fromEntries(usuarios.map(u => [u.id, u.nome]))

  const pdfBytes = await generateTemperaturaPdf({
    tenantNome: tenant.nomeFantasia,
    tenantCnpj: tenant.cnpj,
    dataInicio: new Date(dataInicio).toLocaleDateString('pt-BR', { timeZone: 'UTC' }),
    dataFim: new Date(dataFim).toLocaleDateString('pt-BR', { timeZone: 'UTC' }),
    registros: registros.map(r => ({
      dataLeitura: r.dataLeitura,
      periodo: r.periodo,
      ambienteNome: r.ambiente.nome,
      temperaturaGraus: r.temperaturaGraus,
      umidadePercent: r.umidadePercent,
      nomeUsuario: userMap[r.usuarioId] ?? 'Desconhecido',
      alertaDisparado: r.alertaDisparado,
      observacao: r.observacao,
      tempMin: r.ambiente.tempMin,
      tempMax: r.ambiente.tempMax,
    })),
  })

  const filename = `temperatura_${dataInicio}_${dataFim}.pdf`
  return new Response(pdfBytes.buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
