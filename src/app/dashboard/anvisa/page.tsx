import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AnvisaClient } from './anvisa-client'

export default async function AnvisaPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/login')

  const perms = session.user.permissions as string[]
  if (!perms.includes('ANVISA_RELATORIOS')) redirect('/dashboard')

  const canCancel = perms.includes('DSF_CANCELAR')
  const canUpload = perms.includes('DSF_EMITIR')

  return <AnvisaClient canCancel={canCancel} canUpload={canUpload} />
}
