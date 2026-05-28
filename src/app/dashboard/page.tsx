import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Permission } from '@/generated/prisma/client'
import { CpfSearch } from '@/components/cpf-search'

const ADMIN_PERMS: Permission[] = [
  Permission.SUPER_ADMIN_GLOBAIS,
  Permission.ANVISA_RELATORIOS,
  Permission.DSF_CANCELAR,
  Permission.DRIVE_CONFIGURAR,
]

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/login')

  const perms = session.user.permissions
  const isAdmin = perms.some((p) => ADMIN_PERMS.includes(p))

  if (!isAdmin) {
    return (
      <div className="p-4 sm:p-8">
        <div className="max-w-2xl">
          <h1 className="text-xl font-bold text-slate-900 mb-1">Balcão de Atendimento</h1>
          <p className="text-sm text-slate-500 mb-6">
            Busque um cliente pelo CPF para iniciar o atendimento
          </p>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6">
            <CpfSearch />
          </div>
        </div>
      </div>
    )
  }

  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Painel Administrativo</h1>
        <p className="text-sm text-slate-500 capitalize">{today}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <MetricCard
          title="DSFs Emitidas Hoje"
          value="0"
          sub="declarações"
          color="blue"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
        />
        <MetricCard
          title="Clientes Cadastrados"
          value="0"
          sub="no sistema"
          color="indigo"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />
        <MetricCard
          title="Google Drive"
          value="—"
          sub="Não configurado"
          color="amber"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
            </svg>
          }
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Atendimento Rápido</h2>
        <CpfSearch />
      </div>
    </div>
  )
}

function MetricCard({
  title,
  value,
  sub,
  color,
  icon,
}: {
  title: string
  value: string
  sub: string
  color: 'blue' | 'indigo' | 'amber'
  icon: React.ReactNode
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700',
    indigo: 'bg-indigo-50 text-indigo-700',
    amber: 'bg-amber-50 text-amber-700',
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm font-medium text-slate-600">{title}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors[color]}`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
    </div>
  )
}
