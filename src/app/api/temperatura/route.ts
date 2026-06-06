import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AuditAcao } from '@/generated/prisma/client'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const tenantId = session.user.tenantId
  const body = await request.json()
  const { ambienteId, dataLeitura, periodo, temperaturaGraus, umidadePercent, observacao } = body

  if (!ambienteId) return Response.json({ error: 'Ambiente obrigatório' }, { status: 400 })
  if (!dataLeitura) return Response.json({ error: 'Data obrigatória' }, { status: 400 })
  if (!periodo || !['MANHA', 'TARDE'].includes(periodo)) {
    return Response.json({ error: 'Período inválido' }, { status: 400 })
  }
  if (temperaturaGraus == null) return Response.json({ error: 'Temperatura obrigatória' }, { status: 400 })

  const ambiente = await prisma.ambiente.findFirst({ where: { id: ambienteId, tenantId, ativo: true } })
  if (!ambiente) return Response.json({ error: 'Ambiente não encontrado' }, { status: 404 })

  const temp = parseFloat(temperaturaGraus)
  const umid = umidadePercent != null ? parseFloat(umidadePercent) : null

  const alertaTemp = temp < ambiente.tempMin || temp > ambiente.tempMax
  const alertaUmid =
    umid != null &&
    ambiente.umidadeMin != null &&
    ambiente.umidadeMax != null &&
    (umid < ambiente.umidadeMin || umid > ambiente.umidadeMax)
  const alertaDisparado = alertaTemp || alertaUmid

  try {
    const registro = await prisma.registroTermoHigrometria.create({
      data: {
        ambienteId,
        tenantId,
        dataLeitura: new Date(dataLeitura),
        periodo,
        temperaturaGraus: temp,
        umidadePercent: umid,
        usuarioId: session.user.id,
        alertaDisparado,
        observacao: observacao?.trim() || null,
      },
    })

    await prisma.auditLog.create({
      data: {
        tenantId,
        userId: session.user.id,
        acao: AuditAcao.TEMPERATURA_REGISTRADA,
        recursoTipo: 'RegistroTermoHigrometria',
        recursoId: registro.id,
        ip: request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown',
        userAgent: request.headers.get('user-agent') ?? 'unknown',
      },
    })

    return Response.json({ ...registro, alertaDisparado }, { status: 201 })
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'P2002') {
      return Response.json({ error: 'Leitura já registrada para este período' }, { status: 409 })
    }
    throw e
  }
}
