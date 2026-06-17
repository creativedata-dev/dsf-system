import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Permission } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/crypto'
import { google } from 'googleapis'
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

  const tenantId = session.user.tenantId
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [dsfHoje, totalClientes, drive, tenant] = await Promise.all([
    prisma.dSF.count({ where: { tenantId, createdAt: { gte: todayStart } } }),
    prisma.cliente.count({ where: { tenantId } }),
    prisma.driveCredential.findUnique({
      where: { tenantId },
      select: { id: true, driveEmail: true, accessToken: true, refreshToken: true },
    }),
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { cnpj: true, endereco: true, razaoSocial: true, alvaraSanitario: true, telefone: true },
    }),
  ])

  const driveConectado = drive !== null
  let driveEmail = drive?.driveEmail ?? null

  // Backfill lazy: credencial existia antes do campo driveEmail ser adicionado
  if (drive && !driveEmail) {
    try {
      const oauth2 = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
      )
      oauth2.setCredentials({
        access_token: decrypt(drive.accessToken),
        refresh_token: decrypt(drive.refreshToken),
      })
      const { token } = await oauth2.getAccessToken() // renova se expirado
      const tokenInfo = await oauth2.getTokenInfo(token!)
      driveEmail = tokenInfo.email ?? null
      if (driveEmail) {
        await prisma.driveCredential.update({ where: { tenantId }, data: { driveEmail } })
      }
    } catch {
      // token sem escopo email — email aparece após reconexão
    }
  }

  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  // Checklist de onboarding para tenants recém-criados via landing page
  const passosConcluidos = {
    dados: !!(tenant?.cnpj && tenant?.endereco && tenant?.razaoSocial && tenant?.alvaraSanitario),
    drive: driveConectado,
    primeiroCliente: totalClientes > 0,
    primeiroDsf: dsfHoje > 0 || totalClientes > 0, // aproximação — se já tem clientes, já usou o sistema
  }
  const totalPassos = Object.keys(passosConcluidos).length
  const passosFeitos = Object.values(passosConcluidos).filter(Boolean).length
  const mostrarOnboarding = passosFeitos < totalPassos

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Início</h1>
        <p className="text-sm text-slate-500 capitalize">{today} — visão geral da sua conformidade</p>
      </div>

      {/* Welcome banner — aparece até completar todas as configurações */}
      {mostrarOnboarding && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-2xl p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-5 h-5 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-blue-900">Configure seu FarmaSign</h2>
              <p className="text-xs text-blue-700 mt-0.5">
                {passosFeitos} de {totalPassos} passos concluídos — siga o checklist para começar a usar todos os recursos.
              </p>
            </div>
            <div className="ml-auto flex-shrink-0">
              <div className="text-xs font-bold text-blue-700 bg-blue-100 rounded-lg px-2.5 py-1">
                {Math.round((passosFeitos / totalPassos) * 100)}%
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            <OnboardingStep
              done={passosConcluidos.dados}
              href="/dashboard/geral"
              label="Complete os dados da farmácia"
              desc="Informe CNPJ, razão social, endereço e alvará sanitário para estar em conformidade com a ANVISA."
            />
            <OnboardingStep
              done={passosConcluidos.drive}
              href="/dashboard/configuracoes"
              label="Conecte o Google Drive"
              desc="As DSFs emitidas serão salvas automaticamente em nuvem. Necessário para backup e auditoria."
            />
            <OnboardingStep
              done={passosConcluidos.primeiroCliente}
              href="/dashboard/clientes"
              label="Cadastre seu primeiro cliente"
              desc="Registre um paciente para emitir a primeira Declaração de Serviço Farmacêutico."
            />
            <OnboardingStep
              done={passosConcluidos.primeiroDsf}
              href="/dashboard/clientes"
              label="Emita sua primeira DSF"
              desc="Registre um atendimento farmacêutico e mantenha conformidade com a RDC 44/2009."
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <MetricCard
          title="DSFs Emitidas Hoje"
          value={String(dsfHoje)}
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
          value={String(totalClientes)}
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
          value={driveConectado ? '✓' : '—'}
          sub={driveConectado ? (driveEmail ?? 'Conectado') : 'Não configurado'}
          color={driveConectado ? 'green' : 'amber'}
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

function OnboardingStep({ done, href, label, desc }: { done: boolean; href: string; label: string; desc: string }) {
  return (
    <a
      href={done ? '#' : href}
      className={`flex items-start gap-3 p-3 rounded-xl transition-colors ${done ? 'opacity-60 cursor-default' : 'bg-white hover:bg-blue-50 border border-blue-100'}`}
    >
      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${done ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
        {done ? (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <div className="w-2 h-2 rounded-full bg-slate-300" />
        )}
      </div>
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${done ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{label}</p>
        {!done && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{desc}</p>}
      </div>
      {!done && (
        <svg className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      )}
    </a>
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
  color: 'blue' | 'indigo' | 'amber' | 'green'
  icon: React.ReactNode
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700',
    indigo: 'bg-indigo-50 text-indigo-700',
    amber: 'bg-amber-50 text-amber-700',
    green: 'bg-green-50 text-green-700',
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
