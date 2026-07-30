import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function PaywallLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/login')
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="h-14 bg-white border-b border-slate-200 flex items-center px-6">
        <span className="font-bold text-slate-800 text-lg">FarmaSign</span>
      </div>
      <main>{children}</main>
    </div>
  )
}
