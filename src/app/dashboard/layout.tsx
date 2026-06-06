import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { DashboardShell } from '@/components/dashboard-shell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/login')

  const perms = session.user.permissions as string[]
  const isSuperAdmin = perms.includes('SUPER_ADMIN_GLOBAIS')

  const [tenant, assinatura] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: { nomeFantasia: true, logoUrl: true, modulosHabilitados: true },
    }),
    isSuperAdmin
      ? null
      : prisma.assinatura.findUnique({
          where: { tenantId: session.user.tenantId },
          select: { status: true, expiraEm: true, trialExpiraEm: true },
        }),
  ])

  // Bloqueia acesso se assinatura expirada ou cancelada
  if (!isSuperAdmin && (assinatura?.status === 'EXPIRADA' || assinatura?.status === 'CANCELADA')) {
    redirect('/dashboard/assinatura-expirada')
  }

  return (
    <DashboardShell
      userName={session.user.name ?? ''}
      userEmail={session.user.email ?? ''}
      userCrf={session.user.crf}
      tenantName={tenant?.nomeFantasia ?? '—'}
      tenantLogoUrl={tenant?.logoUrl ?? null}
      permissions={session.user.permissions}
      modulosHabilitados={tenant?.modulosHabilitados ?? []}
      assinaturaStatus={assinatura?.status ?? null}
      assinaturaExpiraEm={assinatura?.expiraEm?.toISOString() ?? null}
      trialExpiraEm={assinatura?.trialExpiraEm?.toISOString() ?? null}
    >
      {children}
    </DashboardShell>
  )
}
