import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AuditAcao, DsfStatus } from '@/generated/prisma/client'
import { PDFDocument } from 'pdf-lib'
import { uploadPdfToDrive } from '@/lib/drive'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  let body: { dsfId: string; imageBase64: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Corpo inválido' }, { status: 400 })
  }

  const { dsfId, imageBase64 } = body
  if (!dsfId || !imageBase64) {
    return Response.json({ error: 'dsfId e imageBase64 são obrigatórios' }, { status: 400 })
  }

  const tenantId = session.user.tenantId

  const dsf = await prisma.dSF.findUnique({
    where: { id: dsfId },
    select: { id: true, tenantId: true, numeroDsf: true, status: true },
  })
  if (!dsf || dsf.tenantId !== tenantId) {
    return Response.json({ error: 'DSF não encontrada' }, { status: 404 })
  }
  if (dsf.status === DsfStatus.CONCLUIDA) {
    return Response.json({ error: 'DSF já concluída' }, { status: 409 })
  }

  // ── Converter imagem base64 para PDF ─────────────────────────────────────────
  let driveFileId: string | null = null
  let pdfWarning: string | null = null

  try {
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '')
    const imageBuffer = Buffer.from(base64Data, 'base64')

    const pdfDoc = await PDFDocument.create()

    // Tentar JPEG primeiro, fallback PNG
    let image
    const isPng = imageBase64.startsWith('data:image/png')
    try {
      image = isPng
        ? await pdfDoc.embedPng(imageBuffer)
        : await pdfDoc.embedJpg(imageBuffer)
    } catch {
      image = await pdfDoc.embedPng(imageBuffer)
    }

    const { width: imgW, height: imgH } = image
    // Normalizar: largura máxima 595pt (A4), manter aspect ratio
    const maxW = 595
    const scale = imgW > maxW ? maxW / imgW : 1
    const pageW = Math.round(imgW * scale)
    const pageH = Math.round(imgH * scale)

    const page = pdfDoc.addPage([pageW, pageH])
    page.drawImage(image, { x: 0, y: 0, width: pageW, height: pageH })

    const pdfBytes = await pdfDoc.save()

    driveFileId = await uploadPdfToDrive(tenantId, `${dsf.numeroDsf}-assinado.pdf`, pdfBytes)

    if (!driveFileId) {
      pdfWarning = 'Drive não configurado — DSF concluída sem upload.'
    }
  } catch (err) {
    console.error('[upload-signed] Erro ao gerar PDF:', err)
    pdfWarning = 'Falha ao gerar o PDF — DSF concluída sem upload.'
  }

  // ── Atualizar status da DSF ──────────────────────────────────────────────────
  await prisma.dSF.update({
    where: { id: dsfId },
    data: {
      status: DsfStatus.CONCLUIDA,
      ...(driveFileId ? { driveFileId } : {}),
    },
  })

  // ── Audit log ────────────────────────────────────────────────────────────────
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown'
  const ua = request.headers.get('user-agent') ?? 'unknown'

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: session.user.id,
      acao: AuditAcao.DSF_CONCLUIDA,
      recursoTipo: 'DSF',
      recursoId: dsfId,
      ip,
      userAgent: ua,
    },
  })

  return Response.json({
    status: 'CONCLUIDA',
    driveFileId,
    warning: pdfWarning,
  })
}
