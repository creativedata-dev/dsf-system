import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasModulo } from '@/lib/modulos'

export default async function EquipamentosLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { modulosHabilitados: true },
  })

  if (!tenant || !hasModulo(tenant.modulosHabilitados, 'EQUIPAMENTOS')) {
    redirect('/dashboard')
  }

  return <>{children}</>
}
