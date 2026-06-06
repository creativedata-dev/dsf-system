import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const tenantId = session.user.tenantId
  const { searchParams } = new URL(request.url)
  const ambienteId = searchParams.get('ambienteId')
  const dataInicio = searchParams.get('dataInicio')
  const dataFim = searchParams.get('dataFim')

  const registros = await prisma.registroTermoHigrometria.findMany({
    where: {
      tenantId,
      ...(ambienteId && { ambienteId }),
      ...(dataInicio && dataFim && {
        dataLeitura: {
          gte: new Date(dataInicio),
          lte: new Date(dataFim),
        },
      }),
    },
    include: {
      ambiente: { select: { nome: true, tipo: true, tempMin: true, tempMax: true, umidadeMin: true, umidadeMax: true } },
    },
    // fotoUrl and fotoFileId are included automatically (no select restriction)
    orderBy: [{ dataLeitura: 'desc' }, { periodo: 'asc' }],
    take: 500,
  })

  // Enrich with user name
  const userIds = [...new Set(registros.map(r => r.usuarioId))]
  const usuarios = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, nome: true },
  })
  const userMap = Object.fromEntries(usuarios.map(u => [u.id, u.nome]))

  return Response.json(
    registros.map(r => ({ ...r, nomeUsuario: userMap[r.usuarioId] ?? 'Desconhecido' }))
  )
}
