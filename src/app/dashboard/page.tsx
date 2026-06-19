import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Permission } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/crypto'
import { google } from 'googleapis'
import { CpfSearch } from '@/components/cpf-search'
import Link from 'next/link'

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
          <p className="text-sm text-slate-500 mb-6">Busque o cliente pelo CPF para iniciar o atendimento</p>
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
  const weekStart = new Date(todayStart)
  weekStart.setDate(weekStart.getDate() - 7)
  const in7days = new Date(todayStart)
  in7days.setDate(in7days.getDate() + 7)

  const [
    dsfHoje,
    dsfPendentes,
    ultimasDsfs,
    totalClientes,
    clientesSemana,
    ultimaTemp,
    equipamentosVencendo,
    popsHoje,
    drive,
    tenant,
  ] = await Promise.all([
    prisma.dSF.count({ where: { tenantId, createdAt: { gte: todayStart } } }),
    prisma.dSF.count({ where: { tenantId, status: 'EMITIDA', createdAt: { gte: todayStart } } }),
    prisma.dSF.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true, numeroDsf: true, status: true, createdAt: true,
        cliente: { select: { nome: true } },
      },
    }),
    prisma.cliente.count({ where: { tenantId } }),
    prisma.cliente.count({ where: { tenantId, createdAt: { gte: weekStart } } }),
    prisma.registroTermoHigrometria.findFirst({
      where: { tenantId },
      orderBy: { dataLeitura: 'desc' },
      select: {
        temperaturaGraus: true, dataLeitura: true,
        ambiente: { select: { nome: true, tempMin: true, tempMax: true } },
      },
    }),
    prisma.equipamento.findMany({
      where: { tenantId, ativo: true, dataProximaCalibracao: { lte: in7days, gte: todayStart } },
      select: { nome: true, dataProximaCalibracao: true },
      orderBy: { dataProximaCalibracao: 'asc' },
      take: 3,
    }),
    prisma.documentoPOP.count({ where: { tenantId, updatedAt: { gte: todayStart } } }),
    prisma.driveCredential.findUnique({
      where: { tenantId },
      select: { id: true, driveEmail: true, accessToken: true, refreshToken: true },
    }),
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { cnpj: true, endereco: true, razaoSocial: true, alvaraSanitario: true, telefone: true },
    }),
  ])

  // Backfill lazy driveEmail
  let driveEmail = drive?.driveEmail ?? null
  if (drive && !driveEmail) {
    try {
      const oauth2 = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET)
      oauth2.setCredentials({ access_token: decrypt(drive.accessToken), refresh_token: decrypt(drive.refreshToken) })
      const { token } = await oauth2.getAccessToken()
      const tokenInfo = await oauth2.getTokenInfo(token!)
      driveEmail = tokenInfo.email ?? null
      if (driveEmail) await prisma.driveCredential.update({ where: { tenantId }, data: { driveEmail } })
    } catch { /* sem scope email */ }
  }

  const today = new Date()
  const todayLabel = today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  const passosConcluidos = {
    dados: !!(tenant?.cnpj && tenant?.endereco && tenant?.razaoSocial && tenant?.alvaraSanitario),
    drive: drive !== null,
    primeiroCliente: totalClientes > 0,
    primeiroDsf: dsfHoje > 0 || totalClientes > 0,
  }
  const totalPassos = Object.keys(passosConcluidos).length
  const passosFeitos = Object.values(passosConcluidos).filter(Boolean).length
  const mostrarOnboarding = passosFeitos < totalPassos

  // Temperatura
  const tempAtual = ultimaTemp?.temperaturaGraus ?? null
  const tempMax = ultimaTemp?.ambiente?.tempMax ?? 25
  const tempMin = ultimaTemp?.ambiente?.tempMin ?? 15
  const tempForaRange = tempAtual !== null && (tempAtual > tempMax || tempAtual < tempMin)
  const tempAlerta = tempAtual !== null && tempAtual > tempMax - 2

  function tempColor() {
    if (tempAtual === null) return '#64748b'
    if (tempAtual > tempMax) return '#dc2626'
    if (tempAtual > tempMax - 2) return '#d97706'
    return '#16a34a'
  }

  function tempStatus() {
    if (tempAtual === null) return { dot: '#94a3b8', text: 'Sem leitura recente' }
    if (tempAtual > tempMax) return { dot: '#dc2626', text: `acima do limite (${tempMax}°C)` }
    if (tempAtual > tempMax - 2) return { dot: '#d97706', text: 'próximo ao limite' }
    return { dot: '#16a34a', text: 'dentro do range' }
  }

  function fmtHora(d: Date) {
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  function fmtDsfDate(d: Date) {
    const dDay = new Date(d)
    dDay.setHours(0, 0, 0, 0)
    const diff = Math.round((todayStart.getTime() - dDay.getTime()) / 86400000)
    if (diff === 0) return `hoje, ${fmtHora(d)}`
    if (diff === 1) return `ontem, ${fmtHora(d)}`
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + `, ${fmtHora(d)}`
  }

  // Alertas
  type Alerta = { tipo: 'danger' | 'warn' | 'ok'; titulo: string; desc: string }
  const alertas: Alerta[] = []

  if (tempForaRange && ultimaTemp) {
    alertas.push({
      tipo: 'danger',
      titulo: 'Temperatura fora do range',
      desc: `${ultimaTemp.ambiente?.nome ?? 'Ambiente'} — ${tempAtual}°C (máx. ${tempMax}°C)`,
    })
  } else if (tempAlerta && ultimaTemp) {
    alertas.push({
      tipo: 'warn',
      titulo: 'Temperatura próxima ao limite',
      desc: `${ultimaTemp.ambiente?.nome ?? 'Ambiente'} — ${tempAtual}°C`,
    })
  }

  for (const eq of equipamentosVencendo) {
    const diasRestantes = Math.ceil((eq.dataProximaCalibracao!.getTime() - today.getTime()) / 86400000)
    alertas.push({
      tipo: diasRestantes <= 2 ? 'danger' : 'warn',
      titulo: `Calibração vence em ${diasRestantes} ${diasRestantes === 1 ? 'dia' : 'dias'}`,
      desc: `${eq.nome} — vence ${eq.dataProximaCalibracao!.toLocaleDateString('pt-BR')}`,
    })
  }

  if (popsHoje > 0) {
    alertas.push({ tipo: 'ok', titulo: `${popsHoje} POP${popsHoje > 1 ? 's' : ''} atualizado${popsHoje > 1 ? 's' : ''} hoje`, desc: 'Versão publicada hoje' })
  }

  if (alertas.length === 0) {
    alertas.push({ tipo: 'ok', titulo: 'Nenhum alerta no momento', desc: 'Tudo dentro dos parâmetros de conformidade' })
  }

  const ts = tempStatus()

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-screen-xl mx-auto">

      {/* Topbar */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Início</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">{todayLabel} — visão geral da conformidade</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Sino — badge se há alertas danger */}
          <button className="relative w-9 h-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors">
            <svg className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {alertas.some(a => a.tipo === 'danger') && (
              <span style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: '50%', background: '#dc2626', border: '2px solid white' }} />
            )}
          </button>
          {/* Google Drive */}
          <Link href="/dashboard/configuracoes" className="w-9 h-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors" title={drive ? `Drive: ${driveEmail ?? 'conectado'}` : 'Conectar Google Drive'}>
            <svg style={{ width: 18, height: 18 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Onboarding banner */}
      {mostrarOnboarding && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-5 h-5 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-bold text-blue-900">Configure seu FarmaSign</h2>
              <p className="text-xs text-blue-700 mt-0.5">{passosFeitos} de {totalPassos} passos concluídos</p>
            </div>
            <div className="text-xs font-bold text-blue-700 bg-blue-100 rounded-lg px-2.5 py-1 flex-shrink-0">
              {Math.round((passosFeitos / totalPassos) * 100)}%
            </div>
          </div>
          <div className="space-y-2">
            <OnboardingStep done={passosConcluidos.dados} href="/dashboard/geral" label="Complete os dados da farmácia" desc="CNPJ, razão social, endereço e alvará sanitário" />
            <OnboardingStep done={passosConcluidos.drive} href="/dashboard/configuracoes" label="Conecte o Google Drive" desc="Backup automático das DSFs em nuvem" />
            <OnboardingStep done={passosConcluidos.primeiroCliente} href="/dashboard/clientes" label="Cadastre seu primeiro cliente" desc="Necessário para emitir a primeira DSF" />
            <OnboardingStep done={passosConcluidos.primeiroDsf} href="/dashboard/clientes" label="Emita sua primeira DSF" desc="Conformidade com a RDC 44/2009" />
          </div>
        </div>
      )}

      {/* Cards de métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* DSFs hoje */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs text-slate-500 font-medium leading-tight">DSFs emitidas hoje</p>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#EAF3DE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg style={{ width: 16, height: 16, color: '#3B6D11' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-semibold text-slate-900">{dsfHoje}</p>
          <p className="text-xs text-slate-400 mt-0.5">declarações</p>
          <div className="flex items-center gap-1.5 mt-2">
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: dsfPendentes > 0 ? '#f59e0b' : '#22c55e', flexShrink: 0, display: 'inline-block' }} />
            <span className="text-[11px] text-slate-500">{dsfPendentes > 0 ? `${dsfPendentes} pendente${dsfPendentes > 1 ? 's' : ''} de assinatura` : 'todas assinadas'}</span>
          </div>
        </div>

        {/* Temperatura */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs text-slate-500 font-medium leading-tight">Temperatura ambiente</p>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#FAEEDA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg style={{ width: 16, height: 16, color: '#633806' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 14.76V3.5a2.5 2.5 0 00-5 0v11.26a4.5 4.5 0 105 0z" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-semibold" style={{ color: tempAtual !== null ? tempColor() : '#94a3b8' }}>
            {tempAtual !== null ? `${tempAtual.toFixed(1)}°` : '—'}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {ultimaTemp ? `última leitura às ${fmtHora(ultimaTemp.dataLeitura)}` : 'sem leituras hoje'}
          </p>
          <div className="flex items-center gap-1.5 mt-2">
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: ts.dot, flexShrink: 0, display: 'inline-block' }} />
            <span className="text-[11px] text-slate-500">{ts.text}</span>
          </div>
        </div>

        {/* Clientes */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 col-span-2 lg:col-span-1">
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs text-slate-500 font-medium leading-tight">Clientes cadastrados</p>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg style={{ width: 16, height: 16, color: '#185FA5' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-semibold text-slate-900">{totalClientes}</p>
          <p className="text-xs text-slate-400 mt-0.5">no sistema</p>
          <div className="flex items-center gap-1.5 mt-2">
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', flexShrink: 0, display: 'inline-block' }} />
            <span className="text-[11px] text-slate-500">{clientesSemana > 0 ? `+${clientesSemana} esta semana` : 'nenhum novo esta semana'}</span>
          </div>
        </div>
      </div>

      {/* Busca rápida */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
        <CpfSearch />
      </div>

      {/* Grid alertas + DSFs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Alertas */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-800">Alertas do dia</h2>
            <Link href="/dashboard/temperatura" className="text-xs font-medium" style={{ color: '#28B478' }}>ver todos</Link>
          </div>
          <div className="space-y-3">
            {alertas.map((a, i) => (
              <div key={i} className="flex items-start gap-3 pb-3 border-b border-slate-50 last:border-0 last:pb-0">
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: a.tipo === 'danger' ? '#FEE2E2' : a.tipo === 'warn' ? '#FEF3C7' : '#DCFCE7',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {a.tipo === 'danger' && <svg style={{ width: 15, height: 15, color: '#dc2626' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
                  {a.tipo === 'warn' && <svg style={{ width: 15, height: 15, color: '#d97706' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
                  {a.tipo === 'ok' && <svg style={{ width: 15, height: 15, color: '#16a34a' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 leading-tight">{a.titulo}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{a.desc}</p>
                  <span style={{
                    display: 'inline-block', marginTop: 4, padding: '1px 8px', borderRadius: 99, fontSize: 10, fontWeight: 500,
                    background: a.tipo === 'danger' ? '#FEE2E2' : a.tipo === 'warn' ? '#FEF3C7' : '#DCFCE7',
                    color: a.tipo === 'danger' ? '#dc2626' : a.tipo === 'warn' ? '#92400e' : '#15803d',
                  }}>
                    {a.tipo === 'danger' ? 'crítico' : a.tipo === 'warn' ? 'atenção' : 'ok'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Últimas DSFs */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-800">Últimas DSFs emitidas</h2>
            <Link href="/dashboard/clientes" className="text-xs font-medium" style={{ color: '#28B478' }}>emitir nova</Link>
          </div>
          {ultimasDsfs.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Nenhuma DSF emitida ainda</p>
          ) : (
            <div className="space-y-3">
              {ultimasDsfs.map(dsf => (
                <div key={dsf.id} className="flex items-center gap-3 pb-3 border-b border-slate-50 last:border-0 last:pb-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{dsf.cliente.nome}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{fmtDsfDate(dsf.createdAt)}</p>
                  </div>
                  <span style={{
                    flexShrink: 0, padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 500,
                    background: dsf.status === 'CONCLUIDA' ? '#DCFCE7' : dsf.status === 'CANCELADA' ? '#FEE2E2' : '#FEF3C7',
                    color: dsf.status === 'CONCLUIDA' ? '#15803d' : dsf.status === 'CANCELADA' ? '#dc2626' : '#92400e',
                  }}>
                    {dsf.status === 'CONCLUIDA' ? 'assinada' : dsf.status === 'CANCELADA' ? 'cancelada' : 'pendente'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function OnboardingStep({ done, href, label, desc }: { done: boolean; href: string; label: string; desc: string }) {
  return (
    <a href={done ? '#' : href} className={`flex items-start gap-3 p-3 rounded-xl transition-colors ${done ? 'opacity-60 cursor-default' : 'bg-white hover:bg-blue-50 border border-blue-100'}`}>
      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${done ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
        {done
          ? <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          : <div className="w-2 h-2 rounded-full bg-slate-300" />
        }
      </div>
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${done ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{label}</p>
        {!done && <p className="text-xs text-slate-500 mt-0.5">{desc}</p>}
      </div>
      {!done && (
        <svg className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      )}
    </a>
  )
}
