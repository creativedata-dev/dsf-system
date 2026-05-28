import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { PacientesClient } from './pacientes-client'

const ADMIN_PERMS = ['SUPER_ADMIN_GLOBAIS', 'ANVISA_RELATORIOS', 'DSF_CANCELAR', 'DRIVE_CONFIGURAR']

export default async function PacientesPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/login')

  const perms = session.user.permissions as string[]
  if (!perms.some((p) => ADMIN_PERMS.includes(p))) redirect('/dashboard')

  const isSuperAdmin = perms.includes('SUPER_ADMIN_GLOBAIS')

  return <PacientesClient isSuperAdmin={isSuperAdmin} />
}
