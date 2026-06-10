import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { uploadPdfToDrive } from '@/lib/drive'

function toDateStr(val: Date | string): string {
  if (typeof val === 'string') return val.slice(0, 10)
  return val.toISOString().slice(0, 10)
}

function parseDate(s: string): Date {
  return new Date(`${s}T12:00:00.000Z`)
}

// GET /api/equipamentos/[id]/historico
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { tenantId } = session.user
  const { id } = await params

  const equip = await prisma.equipamento.findFirst({ where: { id, tenantId } })
  if (!equip) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const registros = await prisma.historicoCalibracao.findMany({
    where: { equipamentoId: id, tenantId },
    include: { usuario: { select: { nome: true } } },
    orderBy: { dataCalib: 'desc' },
  })

  return NextResponse.json(registros.map(r => ({
    id: r.id,
    dataCalib:         toDateStr(r.dataCalib as Date | string),
    dataProxima:       toDateStr(r.dataProxima as Date | string),
    numeroCertificado: r.numeroCertificado,
    laboratorio:       r.laboratorio,
    laudoUrl:          r.laudoUrl,
    obs:               r.obs,
    nomeUsuario:       r.usuario.nome,
    createdAt:         r.createdAt,
  })))
}

// POST /api/equipamentos/[id]/historico  (multipart/form-data ou JSON)
// Campos: dataCalib, dataProxima, numeroCertificado?, laboratorio?, obs?, laudo? (File)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { tenantId, id: usuarioId } = session.user
  const { id: equipamentoId } = await params

  const equip = await prisma.equipamento.findFirst({ where: { id: equipamentoId, tenantId } })
  if (!equip) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const contentType = req.headers.get('content-type') ?? ''
  let dataCalib = '', dataProxima = '', numeroCertificado = '', laboratorio = '', obs = ''
  let laudoFile: File | null = null

  if (contentType.includes('multipart/form-data')) {
    const fd = await req.formData()
    dataCalib         = fd.get('dataCalib') as string ?? ''
    dataProxima       = fd.get('dataProxima') as string ?? ''
    numeroCertificado = fd.get('numeroCertificado') as string ?? ''
    laboratorio       = fd.get('laboratorio') as string ?? ''
    obs               = fd.get('obs') as string ?? ''
    laudoFile         = fd.get('laudo') as File | null
  } else {
    const body = await req.json()
    dataCalib         = body.dataCalib ?? ''
    dataProxima       = body.dataProxima ?? ''
    numeroCertificado = body.numeroCertificado ?? ''
    laboratorio       = body.laboratorio ?? ''
    obs               = body.obs ?? ''
  }

  if (!dataCalib || !dataProxima) {
    return NextResponse.json({ error: 'dataCalib e dataProxima são obrigatórios' }, { status: 400 })
  }

  let laudoUrl: string | null = null
  let laudoFileId: string | null = null

  if (laudoFile && laudoFile.size > 0) {
    if (laudoFile.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Apenas PDF é aceito' }, { status: 400 })
    }
    const bytes = new Uint8Array(await laudoFile.arrayBuffer())
    const fileName = `laudo_${equip.nome.replace(/\s+/g, '_')}_${dataCalib}.pdf`
    const fileId = await uploadPdfToDrive(tenantId, fileName, bytes)
    if (fileId) {
      laudoFileId = fileId
      laudoUrl = `https://drive.google.com/file/d/${fileId}/view`
    }
  }

  // Cria registro histórico
  const historico = await prisma.historicoCalibracao.create({
    data: {
      tenantId,
      equipamentoId,
      usuarioId,
      dataCalib:         parseDate(dataCalib),
      dataProxima:       parseDate(dataProxima),
      numeroCertificado: numeroCertificado || null,
      laboratorio:       laboratorio || null,
      laudoFileId,
      laudoUrl,
      obs:               obs || null,
    },
  })

  // Atualiza datas e laudo no equipamento se for calibração mais recente
  const equipDataCalib = toDateStr(equip.dataUltimaCalibracao as Date | string)
  if (dataCalib >= equipDataCalib) {
    await prisma.equipamento.update({
      where: { id: equipamentoId },
      data: {
        dataUltimaCalibracao:  parseDate(dataCalib),
        dataProximaCalibracao: parseDate(dataProxima),
        numeroCertificado:     numeroCertificado || equip.numeroCertificado,
        laboratorio:           laboratorio || equip.laboratorio,
        ...(laudoUrl ? { laudoUrl, laudoDriveFileId: laudoFileId } : {}),
        status: calcStatus(dataProxima),
      },
    })
  }

  return NextResponse.json({
    ...historico,
    dataCalib:   toDateStr(historico.dataCalib as Date | string),
    dataProxima: toDateStr(historico.dataProxima as Date | string),
    laudoUrl,
  }, { status: 201 })

  } catch (e) {
    console.error('POST /historico error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

function calcStatus(dataProxima: string): string {
  const proxima = parseDate(dataProxima)
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const diff = Math.floor((proxima.getTime() - hoje.getTime()) / 86400000)
  return diff < 0 ? 'VENCIDO' : diff <= 30 ? 'VENCENDO' : 'ATIVO'
}
