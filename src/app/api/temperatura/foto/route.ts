import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { uploadImageToDrive } from '@/lib/drive'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const tenantId = session.user.tenantId

  const formData = await request.formData()
  const registroId = formData.get('registroId') as string | null
  const file = formData.get('foto') as File | null

  if (!registroId) return Response.json({ error: 'registroId obrigatório' }, { status: 400 })
  if (!file) return Response.json({ error: 'Foto obrigatória' }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) {
    return Response.json({ error: 'Formato inválido. Use JPG, PNG ou WebP.' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return Response.json({ error: 'Foto muito grande. Máximo 10 MB.' }, { status: 400 })
  }

  const registro = await prisma.registroTermoHigrometria.findFirst({
    where: { id: registroId, tenantId },
    include: { ambiente: { select: { nome: true } } },
  })
  if (!registro) return Response.json({ error: 'Registro não encontrado' }, { status: 404 })

  const bytes = new Uint8Array(await file.arrayBuffer())
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const data = registro.dataLeitura.toISOString().slice(0, 10)
  const fileName = `temp_${registro.ambiente.nome.replace(/\s+/g, '_')}_${data}_${registro.periodo}.${ext}`

  const result = await uploadImageToDrive(tenantId, fileName, bytes, file.type)
  if (!result) {
    return Response.json({ error: 'Google Drive não configurado para este tenant' }, { status: 422 })
  }

  const updated = await prisma.registroTermoHigrometria.update({
    where: { id: registroId },
    data: { fotoFileId: result.fileId, fotoUrl: result.webViewLink },
  })

  return Response.json({ fotoUrl: updated.fotoUrl, fotoFileId: updated.fotoFileId })
}
