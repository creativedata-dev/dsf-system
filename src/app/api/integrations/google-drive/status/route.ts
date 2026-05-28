import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const cred = await prisma.driveCredential.findUnique({
    where: { tenantId: session.user.tenantId },
    select: { id: true, driveFolderId: true, createdAt: true, updatedAt: true },
  })

  return Response.json({
    connected: !!cred,
    connectedSince: cred?.createdAt ?? null,
    lastSync: cred?.updatedAt ?? null,
    folderId: cred?.driveFolderId ?? null,
  })
}
