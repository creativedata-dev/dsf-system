'use client'

import { useEffect, useState, useCallback } from 'react'

interface DashboardData {
  assinaturas: { ativas: number; trial: number; suspensas: number; canceladas: number; expiradas: number; total: number }
  receita: { mesAtual: number; mesAnterior: number }
  novos: { mesAtual: number; mesAnterior: number }
  totalTenants: number
  distribuicaoPlanos: { planoId: string; nome: string; tipo: string; total: number }[]
  ultimasPagamentos: { id: string; valor: number; gateway: string; tenant: string; createdAt: string }[]
  historico6Meses: { mes: string; total: number }[]
}

function fmtBRL(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtMes(iso: string) {
  const [ano, mes] = iso.split('-')
  const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  return `${nomes[parseInt(mes) - 1]}/${ano.slice(2)}`
}

function pct(a: number, b: number) {
  if (b === 0) return null
  const diff = ((a - b) / b) * 100
  return diff
}

function Delta({ val }: { val: number | null }) {
  if (val === null) return <span className="text-xs text-slate-400">—</span>
  const up = val >= 0
  return (
    <span className={`text-xs font-medium ${up ? 'text-green-600' : 'text-red-500'}`}>
      {up ? '▲' : '▼'} {Math.abs(val).toFixed(1)}% vs mês ant.
    </span>
  )
}

function BarChart({ data }: { data: { mes: string; total: number }[] }) {
  if (!data.length) return <p className="text-sm text-slate-400 text-center py-8">Sem dados</p>
  const max = Math.max(...data.map(d => d.total), 1)
  return (
    <div className="flex items-end gap-2 h-32 pt-2">
      {data.map(d => (
        <div key={d.mes} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-xs font-semibold text-slate-700">{d.total}</span>
          <div
            className="w-full bg-blue-500 rounded-t transition-all"
            style={{ height: `${Math.max((d.total / max) * 96, d.total > 0 ? 6 : 0)}px` }}
          />
          <span className="text-[10px] text-slate-400 whitespace-nowrap">{fmtMes(d.mes)}</span>
        </div>
      ))}
    </div>
  )
}

function DonutChart({ data }: { data: { nome: string; total: number; cor: string }[] }) {
  const total = data.reduce((s, d) => s + d.total, 0)
  if (!total) return <p className="text-sm text-slate-400 text-center py-4">Sem assinaturas ativas</p>

  let offset = 0
  const radius = 40
  const circ = 2 * Math.PI * radius

  const slices = data.filter(d => d.total > 0).map(d => {
    const pctVal = d.total / total
    const dash = pctVal * circ
    const slice = { ...d, dash, offset }
    offset += dash
    return slice
  })

  return (
    <div className="flex items-center gap-6">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="18" />
        {slices.map((s, i) => (
          <circle key={i} cx="50" cy="50" r={radius} fill="none"
            stroke={s.cor} strokeWidth="18"
            strokeDasharray={`${s.dash} ${circ - s.dash}`}
            strokeDashoffset={-s.offset + circ / 4}
            style={{ transform: 'rotate(-90deg)', transformOrigin: '50px 50px' }}
          />
        ))}
        <text x="50" y="54" textAnchor="middle" className="text-xs" fontSize="12" fontWeight="700" fill="#1e293b">{total}</text>
      </svg>
      <div className="space-y-1.5">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.cor }} />
            <span>{s.nome}</span>
            <span className="font-semibold text-slate-800 ml-auto pl-3">{s.total}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const PLANO_CORES: Record<string, string> = {
  TRIAL:    '#f59e0b',
  MENSAL:   '#3b82f6',
  ANUAL:    '#8b5cf6',
  VITALICIO:'#10b981',
}

export function SaasDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/dashboard')
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch { setError('Erro ao carregar métricas.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (error || !data) return <p className="p-8 text-sm text-red-600">{error || 'Sem dados'}</p>

  const { assinaturas, receita, novos, totalTenants, distribuicaoPlanos, ultimasPagamentos, historico6Meses } = data

  const donutData = distribuicaoPlanos.map(p => ({
    nome: p.nome,
    total: p.total,
    cor: PLANO_CORES[p.tipo] ?? '#94a3b8',
  }))

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard SaaS</h1>
          <p className="text-sm text-slate-500 mt-0.5">Visão geral das assinaturas e receita</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Atualizar
        </button>
      </div>

      {/* ── Cards principais ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card label="Assinaturas ativas" value={assinaturas.ativas + assinaturas.trial}
          sub={`${assinaturas.ativas} pagas · ${assinaturas.trial} trial`} color="blue" />
        <Card label="Receita no mês" value={fmtBRL(receita.mesAtual)}
          delta={<Delta val={pct(receita.mesAtual, receita.mesAnterior)} />} color="green" />
        <Card label="Novos assinantes" value={novos.mesAtual}
          delta={<Delta val={pct(novos.mesAtual, novos.mesAnterior)} />} color="purple" />
        <Card label="Farmácias ativas" value={totalTenants}
          sub={`${assinaturas.suspensas} suspensas · ${assinaturas.expiradas} expiradas`} color="amber" />
      </div>

      {/* ── Gráfico + Donut ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-sm font-semibold text-slate-800 mb-4">Novos assinantes — últimos 6 meses</p>
          <BarChart data={historico6Meses} />
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-sm font-semibold text-slate-800 mb-4">Distribuição por plano</p>
          <DonutChart data={donutData} />
        </div>
      </div>

      {/* ── Status + Últimos pagamentos ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Status */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-sm font-semibold text-slate-800 mb-4">Status das assinaturas</p>
          <div className="space-y-3">
            {[
              { label: 'Ativas',    val: assinaturas.ativas,    color: 'bg-green-500' },
              { label: 'Trial',     val: assinaturas.trial,     color: 'bg-amber-400' },
              { label: 'Suspensas', val: assinaturas.suspensas, color: 'bg-orange-400' },
              { label: 'Expiradas', val: assinaturas.expiradas, color: 'bg-red-400' },
              { label: 'Canceladas',val: assinaturas.canceladas,color: 'bg-slate-400' },
            ].map(({ label, val, color }) => {
              const pctBar = assinaturas.total ? (val / assinaturas.total) * 100 : 0
              return (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600">{label}</span>
                    <span className="font-semibold text-slate-800">{val}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pctBar}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Últimos pagamentos */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-sm font-semibold text-slate-800 mb-4">Últimos pagamentos aprovados</p>
          {ultimasPagamentos.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">Nenhum pagamento registrado.</p>
          ) : (
            <div className="space-y-3">
              {ultimasPagamentos.map(p => (
                <div key={p.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{p.tenant}</p>
                    <p className="text-xs text-slate-400">
                      {p.gateway} · {new Date(p.createdAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-green-700">{fmtBRL(p.valor)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Card({ label, value, sub, delta, color }: {
  label: string; value: string | number; sub?: string; delta?: React.ReactNode
  color: 'blue' | 'green' | 'purple' | 'amber'
}) {
  const bg = { blue: 'bg-blue-50', green: 'bg-green-50', purple: 'bg-purple-50', amber: 'bg-amber-50' }[color]
  const text = { blue: 'text-blue-700', green: 'text-green-700', purple: 'text-purple-700', amber: 'text-amber-700' }[color]
  return (
    <div className={`${bg} rounded-2xl p-4`}>
      <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${text} leading-tight`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      {delta && <div className="mt-1">{delta}</div>}
    </div>
  )
}
