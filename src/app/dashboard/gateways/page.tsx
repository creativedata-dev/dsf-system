import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { GatewaysClient } from './gateways-client'

export default async function GatewaysPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/login')
  if (!(session.user.permissions as string[]).includes('SUPER_ADMIN_GLOBAIS')) redirect('/dashboard')
  return <GatewaysClient />
}
