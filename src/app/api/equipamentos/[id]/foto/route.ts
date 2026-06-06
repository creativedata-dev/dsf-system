import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { uploadImageToDrive } from '@/lib/drive'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']
const MAX_SIZE = 10 * 1024 * 1024

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
  const file = formData.get('foto') as File | null
  if (!file) return Response.json({ error: 'Arquivo obrigatório' }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) {
    return Response.json({ error: 'Formato inválido. Use JPG, PNG ou WebP.' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return Response.json({ error: 'Imagem muito grande. Máximo 10 MB.' }, { status: 400 })
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const data = equipamento.dataUltimaCalibracao.toISOString().slice(0, 10)
  const fileName = `equip_${equipamento.nome.replace(/\s+/g, '_')}_${data}.${ext}`

  const result = await uploadImageToDrive(tenantId, fileName, bytes, file.type)
  if (!result) {
    return Response.json({ error: 'Google Drive não configurado para este tenant' }, { status: 422 })
  }

  const updated = await prisma.equipamento.update({
    where: { id },
    data: { fotoFileId: result.fileId, fotoUrl: result.webViewLink },
  })

  return Response.json({ fotoUrl: updated.fotoUrl })
}
