import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AuditAcao } from '@/generated/prisma/client'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const perms = session.user.permissions as string[]
  if (!perms.includes('DRIVE_CONFIGURAR')) {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const tenantId = session.user.tenantId
  const existing = await prisma.driveCredential.findUnique({ where: { tenantId } })
  if (!existing) {
    return Response.json({ error: 'Drive não conectado' }, { status: 404 })
  }

  await prisma.driveCredential.delete({ where: { tenantId } })

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  const ua = request.headers.get('user-agent') ?? 'unknown'

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: session.user.id,
      acao: AuditAcao.DRIVE_REVOGADO,
      recursoTipo: 'DriveCredential',
      recursoId: existing.id,
      ip,
      userAgent: ua,
    },
  })

  return Response.json({ ok: true })
}
