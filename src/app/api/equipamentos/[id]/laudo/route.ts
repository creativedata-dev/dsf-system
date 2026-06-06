import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { uploadPdfToDrive } from '@/lib/drive'

const MAX_SIZE = 20 * 1024 * 1024 // 20 MB

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Não autorizado' }, { status: 401 })
  if (!session.user.permissions.includes('EQUIPAMENTOS_GERENCIAR')) {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { id } = await params
  const tenantId = session.user.tenantId

  const equipamento = await prisma.equipamento.findFirst({ where: { id, tenantId } })
  if (!equipamento) return Response.json({ error: 'Não encontrado' }, { status: 404 })

  const formData = await request.formData()
  const file = formData.get('laudo') as File | null
  if (!file) return Response.json({ error: 'Arquivo obrigatório' }, { status: 400 })
  if (file.type !== 'application/pdf') {
    return Response.json({ error: 'Apenas PDF é aceito' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return Response.json({ error: 'Arquivo muito grande. Máximo 20 MB.' }, { status: 400 })
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const data = equipamento.dataUltimaCalibracao.toISOString().slice(0, 10)
  const fileName = `laudo_${equipamento.nome.replace(/\s+/g, '_')}_${data}.pdf`

  const fileId = await uploadPdfToDrive(tenantId, fileName, bytes)
  if (!fileId) {
    return Response.json({ error: 'Google Drive não configurado para este tenant' }, { status: 422 })
  }

  const laudoUrl = `https://drive.google.com/file/d/${fileId}/view`

  const updated = await prisma.equipamento.update({
    where: { id },
    data: { laudoDriveFileId: fileId, laudoUrl },
  })

  return Response.json({ laudoUrl: updated.laudoUrl, laudoDriveFileId: updated.laudoDriveFileId })
}
