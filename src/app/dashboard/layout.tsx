import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { DashboardShell } from '@/components/dashboard-shell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/login')

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { nomeFantasia: true, logoUrl: true },
  })

  return (
    <DashboardShell
      userName={session.user.name ?? ''}
      userEmail={session.user.email ?? ''}
      userCrf={session.user.crf}
      tenantName={tenant?.nomeFantasia ?? '—'}
      tenantLogoUrl={tenant?.logoUrl ?? null}
      permissions={session.user.permissions}
    >
      {children}
    </DashboardShell>
  )
}
