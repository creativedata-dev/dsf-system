import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasModulo } from '@/lib/modulos'
import { redirect } from 'next/navigation'

export default async function PopsLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId) redirect('/auth/login')

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { modulosHabilitados: true },
  })

  if (!hasModulo(tenant?.modulosHabilitados ?? [], 'POPS')) {
    redirect('/dashboard')
  }

  return <>{children}</>
}
