import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AuditAcao } from '@/generated/prisma/client'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const perms = session.user.permissions as string[]
  if (!perms.includes('TEMPERATURA_GERENCIAR') && !perms.includes('SUPER_ADMIN_GLOBAIS')) {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const tenantId = session.user.tenantId
  const { id } = await params
  const body = await request.json()
  const { nome, tipo, tempMin, tempMax, umidadeMin, umidadeMax, ativo } = body

  const existing = await prisma.ambiente.findFirst({ where: { id, tenantId } })
  if (!existing) return Response.json({ error: 'Ambiente não encontrado' }, { status: 404 })

  const updated = await prisma.ambiente.update({
    where: { id },
    data: {
      ...(nome != null && { nome: nome.trim() }),
      ...(tipo != null && { tipo }),
      ...(tempMin != null && { tempMin: parseFloat(tempMin) }),
      ...(tempMax != null && { tempMax: parseFloat(tempMax) }),
      ...(umidadeMin !== undefined && { umidadeMin: umidadeMin != null ? parseFloat(umidadeMin) : null }),
      ...(umidadeMax !== undefined && { umidadeMax: umidadeMax != null ? parseFloat(umidadeMax) : null }),
      ...(ativo != null && { ativo }),
    },
  })

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: session.user.id,
      acao: AuditAcao.AMBIENTE_ATUALIZADO,
      recursoTipo: 'Ambiente',
      recursoId: id,
      ip: request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown',
      userAgent: request.headers.get('user-agent') ?? 'unknown',
    },
  })

  return Response.json(updated)
}
