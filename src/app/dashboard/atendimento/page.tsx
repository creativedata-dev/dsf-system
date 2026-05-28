import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { CpfSearch } from '@/components/cpf-search'

export default async function AtendimentoPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/login')

  return (
    <div className="p-4 sm:p-8">
      <div className="max-w-2xl">
        <h1 className="text-xl font-bold text-slate-900 mb-1">Emissão DSF</h1>
        <p className="text-sm text-slate-500 mb-6">
          Busque o cliente pelo CPF para iniciar o atendimento
        </p>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6">
          <CpfSearch />
        </div>
      </div>
    </div>
  )
}
