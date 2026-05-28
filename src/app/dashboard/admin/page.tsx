import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Permission } from '@/generated/prisma/client'

const ADMIN_PERMISSIONS: Permission[] = [
  Permission.SUPER_ADMIN_GLOBAIS,
  Permission.ANVISA_RELATORIOS,
  Permission.DSF_CANCELAR,
  Permission.DRIVE_CONFIGURAR,
]

export default async function AdminPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/login')

  const isAdmin = session.user.permissions.some((p) => ADMIN_PERMISSIONS.includes(p))
  if (!isAdmin) redirect('/dashboard/atendimento')

  return (
    <div className="p-8">
      <p className="text-slate-400 text-sm">Módulo administrativo em construção.</p>
    </div>
  )
}
