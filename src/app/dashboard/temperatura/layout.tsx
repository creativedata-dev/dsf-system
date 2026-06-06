import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { hasModulo } from '@/lib/modulos'

export default async function TemperaturaLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/login')

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { modulosHabilitados: true },
  })

  if (!hasModulo(tenant?.modulosHabilitados ?? [], 'TEMPERATURA')) {
    redirect('/dashboard')
  }

  return <>{children}</>
}
