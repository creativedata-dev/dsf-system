import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { DashboardShell } from '@/components/dashboard-shell'

const TOLERANCIA_DIAS = 3

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

  // Calcula bloqueio com tolerância de 3 dias após expiraEm
  let diasEmTolerancia: number | null = null

  if (!isSuperAdmin && assinatura) {
    const { status, expiraEm } = assinatura
    const agora = new Date()

    if (status === 'EXPIRADA' || status === 'CANCELADA') {
      if (expiraEm) {
        const msDiff = agora.getTime() - expiraEm.getTime()
        const diasVencido = Math.floor(msDiff / (1000 * 60 * 60 * 24))
        const diasRestantes = TOLERANCIA_DIAS - diasVencido

        if (diasRestantes <= 0) {
          redirect('/assinatura-expirada')
        }
        // Dentro da tolerância: deixa acessar mas mostra banner
        diasEmTolerancia = diasRestantes
      } else {
        // Sem expiraEm e já expirada/cancelada → bloqueia
        redirect('/assinatura-expirada')
      }
    }
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
      diasEmTolerancia={diasEmTolerancia}
    >
      {children}
    </DashboardShell>
  )
}
