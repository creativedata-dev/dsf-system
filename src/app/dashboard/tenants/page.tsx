import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { TenantsClient } from './tenants-client'

export default async function TenantsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/login')

  const perms = session.user.permissions as string[]
  if (!perms.includes('SUPER_ADMIN_GLOBAIS')) redirect('/dashboard')

  return <TenantsClient />
}
