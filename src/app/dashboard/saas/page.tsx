import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { SaasDashboard } from './saas-client'

export default async function SaasPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/login')
  const perms = session.user.permissions as string[]
  if (!perms.includes('SUPER_ADMIN_GLOBAIS')) redirect('/dashboard')
  return <SaasDashboard />
}
