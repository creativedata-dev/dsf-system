'use client'

import { useEffect, useState, useCallback } from 'react'

interface Ambiente {
  id: string
  nome: string
  tipo: string
  tempMin: number
  tempMax: number
  umidadeMin: number | null
  umidadeMax: number | null
}

interface Registro {
  id: string
  ambienteId: string
  dataLeitura: string
  periodo: string
  temperaturaGraus: number
  umidadePercent: number | null
  alertaDisparado: boolean
  observacao: string | null
  nomeUsuario: string
}

interface DiaFechado {
  id: string
  data: string  // YYYY-MM-DD
  motivo: string | null
}

type Periodo = 'MANHA' | 'TARDE'
type Mode = 'idle' | 'digitando' | 'salvando' | 'uploading' | 'salvo' | 'marcando_fechado'

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const inp = 'w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 transition'

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10)
}

function periodoAtual(): Periodo {
  return new Date().getHours() < 13 ? 'MANHA' : 'TARDE'
}

type DiaStatus = 'completo' | 'parcial' | 'alerta' | 'fechado' | 'vazio'

function statusDia(registros: Registro[], ambienteId: string, dateStr: string): Omit<DiaStatus, 'fechado'> {
  const regs = registros.filter(r => r.ambienteId === ambienteId && r.dataLeitura.slice(0, 10) === dateStr)
  if (regs.length === 0) return 'vazio'
  if (regs.some(r => r.alertaDisparado)) return 'alerta'
  const temManha = regs.some(r => r.periodo === 'MANHA')
  const temTarde = regs.some(r => r.periodo === 'TARDE')
  if (temManha && temTarde) return 'completo'
  return 'parcial'
}

const statusColor: Record<DiaStatus, string> = {
  completo: 'bg-emerald-500',
  parcial:  'bg-amber-400',
  alerta:   'bg-red-500',
  fechado:  'bg-slate-400',
  vazio:    'bg-slate-200',
}

// Fundo da célula por status
const statusCellBg: Record<DiaStatus, string> = {
  completo: 'bg-emerald-50',
  parcial:  'bg-amber-50',
  alerta:   'bg-red-50',
  fechado:  'bg-slate-200',
  vazio:    '',
}

export default function TemperaturaPage() {
  const [mounted, setMounted] = useState(false)
  const [diaHoje, setDiaHoje] = useState('')
  const [ano, setAno] = useState(2026)
  const [mes, setMes] = useState(5)
  const [diaSelecionado, setDiaSelecionado] = useState('')

  useEffect(() => {
    const agora = new Date()
    const hoje = toDateStr(agora)
    setDiaHoje(hoje)
    setAno(agora.getFullYear())
    setMes(agora.getMonth())
    setDiaSelecionado(hoje)
    setMounted(true)
  }, [])

  const [ambientes, setAmbientes] = useState<Ambiente[]>([])
  const [registros, setRegistros] = useState<Registro[]>([])
  const [diasFechados, setDiasFechados] = useState<DiaFechado[]>([])
  const [loading, setLoading] = useState(true)

  const [mode, setMode] = useState<Mode>('idle')
  const [ambienteSelecionado, setAmbienteSelecionado] = useState<Ambiente | null>(null)
  const [periodo, setPeriodo] = useState<Periodo>('MANHA')
  useEffect(() => { setPeriodo(periodoAtual()) }, [])

  const [temperatura, setTemperatura] = useState('')
  const [umidade, setUmidade] = useState('')
  const [observacao, setObservacao] = useState('')
  const [foto, setFoto] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [ultimoAlerta, setUltimoAlerta] = useState(false)

  // modal fechar dia
  const [motivoFechado, setMotivoFechado] = useState('')

  const carregarDados = useCallback(async (a: number, m: number) => {
    setLoading(true)
    const inicio = `${a}-${String(m + 1).padStart(2, '0')}-01`
    const ultimo = new Date(a, m + 1, 0)
    const fim = toDateStr(ultimo)
    const [ambRes, regRes, fechRes] = await Promise.all([
      fetch('/api/ambientes'),
      fetch(`/api/temperatura/historico?dataInicio=${inicio}&dataFim=${fim}`),
      fetch(`/api/temperatura/dia-fechado?dataInicio=${inicio}&dataFim=${fim}`),
    ])
    if (ambRes.ok) setAmbientes(await ambRes.json())
    if (regRes.ok) setRegistros(await regRes.json())
    if (fechRes.ok) setDiasFechados(await fechRes.json())
    setLoading(false)
  }, [])

  useEffect(() => { carregarDados(ano, mes) }, [carregarDados, ano, mes])

  function navegarMes(delta: number) {
    const d = new Date(ano, mes + delta, 1)
    setAno(d.getFullYear())
    setMes(d.getMonth())
    const novoHoje = new Date()
    if (d.getFullYear() === novoHoje.getFullYear() && d.getMonth() === novoHoje.getMonth()) {
      setDiaSelecionado(toDateStr(novoHoje))
    } else {
      setDiaSelecionado(toDateStr(new Date(d.getFullYear(), d.getMonth(), 1)))
    }
  }

  const primeiroDia = new Date(ano, mes, 1).getDay()
  const diasNoMes = new Date(ano, mes + 1, 0).getDate()
  const celulas: (number | null)[] = [
    ...Array(primeiroDia).fill(null),
    ...Array.from({ length: diasNoMes }, (_, i) => i + 1),
  ]
  while (celulas.length % 7 !== 0) celulas.push(null)

  function isDiaFechado(dateStr: string): boolean {
    return diasFechados.some(d => d.data === dateStr)
  }

  function getDiaFechado(dateStr: string): DiaFechado | undefined {
    return diasFechados.find(d => d.data === dateStr)
  }

  function statusGeral(dateStr: string): DiaStatus {
    if (isDiaFechado(dateStr)) return 'fechado'
    if (ambientes.length === 0) return 'vazio'
    const statuses = ambientes.map(a => statusDia(registros, a.id, dateStr))
    if (statuses.some(s => s === 'alerta'))   return 'alerta'
    if (statuses.every(s => s === 'completo')) return 'completo'
    if (statuses.some(s => s === 'completo' || s === 'parcial')) return 'parcial'
    return 'vazio'
  }

  const regsDia = registros.filter(r => r.dataLeitura.slice(0, 10) === diaSelecionado)
  const diaFechadoSelecionado = getDiaFechado(diaSelecionado)

  function abrirLancamento(amb: Ambiente) {
    setAmbienteSelecionado(amb)
    setPeriodo(periodoAtual())
    setTemperatura('')
    setUmidade('')
    setObservacao('')
    setFoto(null)
    setFotoPreview(null)
    setError('')
    setMode('digitando')
  }

  function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFoto(file)
    setFotoPreview(URL.createObjectURL(file))
  }

  async function salvar() {
    if (!ambienteSelecionado) return
    const temp = parseFloat(temperatura)
    if (!temperatura || isNaN(temp)) { setError('Informe a temperatura'); return }
    setError('')
    setMode('salvando')
    try {
      const res = await fetch('/api/temperatura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ambienteId: ambienteSelecionado.id,
          dataLeitura: diaSelecionado,
          periodo,
          temperaturaGraus: temp,
          umidadePercent: umidade ? parseFloat(umidade) : null,
          observacao: observacao || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        setError(err.error ?? 'Erro ao salvar')
        setMode('digitando')
        return
      }
      const data = await res.json()
      setUltimoAlerta(data.alertaDisparado)

      if (foto) {
        setMode('uploading')
        const fd = new FormData()
        fd.append('registroId', data.id)
        fd.append('foto', foto)
        await fetch('/api/temperatura/foto', { method: 'POST', body: fd })
      }

      setMode('salvo')
      await carregarDados(ano, mes)
    } catch {
      setError('Erro de conexão')
      setMode('digitando')
    }
  }

  async function marcarFechado() {
    setMode('marcando_fechado')
    try {
      const res = await fetch('/api/temperatura/dia-fechado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: diaSelecionado, motivo: motivoFechado || null }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error('Erro ao marcar dia fechado:', err)
      }
    } catch (e) {
      console.error('Erro de conexão ao marcar dia fechado:', e)
    }
    setMotivoFechado('')
    await carregarDados(ano, mes)
    setMode('idle')
  }

  async function desmarcarFechado() {
    await fetch(`/api/temperatura/dia-fechado?data=${diaSelecionado}`, { method: 'DELETE' })
    await carregarDados(ano, mes)
  }

  const isFuturo = (d: number) => {
    const ds = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    return ds > diaHoje
  }

  if (!mounted) return (
    <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
      Carregando...
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Controle de Ambientes</h1>
          <p className="text-xs text-slate-400 mt-0.5">Temperatura e Umidade</p>
        </div>
        <div className="flex gap-2">
          <a href="/dashboard/temperatura/ambientes" className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition">
            Ambientes
          </a>
          <a href="/dashboard/temperatura/historico" className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition">
            Histórico
          </a>
        </div>
      </div>

      {/* Calendário */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Nav mês */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <button onClick={() => navegarMes(-1)} className="p-1.5 rounded-lg hover:bg-slate-100 transition text-slate-500">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-slate-800">{MESES[mes]} {ano}</span>
          <button onClick={() => navegarMes(1)} className="p-1.5 rounded-lg hover:bg-slate-100 transition text-slate-500">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Header dias da semana */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }} className="border-b border-slate-100">
          {DIAS_SEMANA.map(d => (
            <div key={d} className="py-2 text-center text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              {d}
            </div>
          ))}
        </div>

        {/* Grid dias */}
        {loading ? (
          <div className="h-48 flex items-center justify-center text-sm text-slate-400">Carregando...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {celulas.map((dia, idx) => {
              if (dia === null) {
                return (
                  <div
                    key={`e-${idx}`}
                    style={{ aspectRatio: '1/1' }}
                    className="border-b border-r border-slate-50"
                  />
                )
              }
              const ds = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
              const isHoje = ds === diaHoje
              const isSel = ds === diaSelecionado
              const futuro = isFuturo(dia)
              const status = futuro ? null : statusGeral(ds)
              const fechado = status === 'fechado'

              return (
                <button
                  key={ds}
                  onClick={() => !futuro && setDiaSelecionado(ds)}
                  disabled={futuro}
                  style={{ aspectRatio: '1/1' }}
                  className={[
                    'relative flex flex-col items-center justify-center border-b border-r border-slate-100 transition overflow-hidden',
                    futuro ? 'cursor-default opacity-30' : 'hover:brightness-95',
                    isSel
                      ? 'bg-blue-600'
                      : status && status !== 'vazio'
                        ? statusCellBg[status]
                        : '',
                  ].join(' ')}
                >
                  <span className={`text-xs font-semibold leading-none z-10 ${isSel ? 'text-white' : isHoje ? 'text-blue-600' : fechado ? 'text-slate-400' : 'text-slate-700'}`}>
                    {dia}
                  </span>
                  {/* Barra colorida no topo da célula */}
                  {status && status !== 'vazio' && !isSel && (
                    <span className={`absolute top-0 left-0 right-0 h-1 ${statusColor[status]}`} />
                  )}
                  {/* Indicador selecionado */}
                  {isSel && status && status !== 'vazio' && (
                    <span className={`w-2 h-2 rounded-full mt-0.5 ${
                      status === 'completo' ? 'bg-emerald-300'
                      : status === 'alerta'  ? 'bg-red-300'
                      : status === 'parcial' ? 'bg-amber-300'
                      : 'bg-slate-400'
                    }`} />
                  )}
                  {/* Ícone fechado */}
                  {fechado && !isSel && (
                    <svg className="w-3.5 h-3.5 text-slate-500 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* Legenda */}
        <div className="flex flex-wrap items-center gap-3 px-5 py-2.5 border-t border-slate-100 bg-slate-50">
          {([['completo','Completo'],['parcial','Parcial'],['alerta','Alerta'],['fechado','Fechado'],['vazio','Sem registro']] as [DiaStatus,string][]).map(([s, label]) => (
            <span key={s} className="flex items-center gap-1.5 text-[10px] text-slate-500">
              {s === 'fechado' ? (
                <svg className="w-2.5 h-2.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              ) : (
                <span className={`w-2 h-2 rounded-full ${statusColor[s]}`} />
              )}
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Painel do dia selecionado */}
      {!loading && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">
              {new Date(diaSelecionado + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            </p>
            {diaFechadoSelecionado ? (
              <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                Fechado
              </span>
            ) : (
              diaSelecionado <= diaHoje && (
                <span className="text-[10px] text-slate-400">{regsDia.length} registro{regsDia.length !== 1 ? 's' : ''}</span>
              )
            )}
          </div>

          {/* Banner dia fechado */}
          {diaFechadoSelecionado ? (
            <div className="px-5 py-6">
              <div className="flex items-start gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-700">Farmácia fechada neste dia</p>
                  {diaFechadoSelecionado.motivo ? (
                    <p className="text-xs text-slate-500 mt-0.5">{diaFechadoSelecionado.motivo}</p>
                  ) : (
                    <p className="text-xs text-slate-400 mt-0.5">Sem justificativa informada</p>
                  )}
                  <button
                    onClick={desmarcarFechado}
                    className="mt-3 text-xs text-red-600 hover:text-red-700 font-medium hover:underline"
                  >
                    Remover marcação de fechado
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {ambientes.length === 0 ? (
                <div className="px-5 py-6 text-center">
                  <p className="text-sm text-slate-500 mb-3">Nenhum ambiente cadastrado.</p>
                  <a href="/dashboard/temperatura/ambientes" className="text-sm text-blue-600 font-medium hover:underline">
                    Cadastrar ambientes →
                  </a>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {ambientes.map(amb => {
                    const regsAmb = regsDia.filter(r => r.ambienteId === amb.id)
                    const manha = regsAmb.find(r => r.periodo === 'MANHA')
                    const tarde = regsAmb.find(r => r.periodo === 'TARDE')
                    const status = statusDia(registros, amb.id, diaSelecionado) as DiaStatus

                    return (
                      <div key={amb.id} className="px-5 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColor[status]}`} />
                              <p className="text-sm font-medium text-slate-800 truncate">{amb.nome}</p>
                              <span className="text-[10px] text-slate-400">{amb.tempMin}°–{amb.tempMax}°C</span>
                            </div>

                            <div className="mt-2 flex gap-3">
                              {/* Manhã */}
                              <div className={`flex-1 rounded-lg px-3 py-2 text-xs ${manha ? (manha.alertaDisparado ? 'bg-red-50 border border-red-200' : 'bg-emerald-50 border border-emerald-200') : 'bg-slate-50 border border-dashed border-slate-200'}`}>
                                <p className={`font-semibold mb-0.5 ${manha ? (manha.alertaDisparado ? 'text-red-700' : 'text-emerald-700') : 'text-slate-400'}`}>
                                  🌅 Manhã
                                </p>
                                {manha ? (
                                  <>
                                    <p className={`font-bold text-sm ${manha.alertaDisparado ? 'text-red-800' : 'text-slate-800'}`}>
                                      {manha.temperaturaGraus}°C{manha.umidadePercent != null ? ` · ${manha.umidadePercent}%` : ''}
                                    </p>
                                    <p className="text-slate-400 mt-0.5">{manha.nomeUsuario}</p>
                                    {manha.observacao && <p className="text-slate-500 italic mt-0.5">{manha.observacao}</p>}
                                  </>
                                ) : (
                                  <p className="text-slate-400">Não registrado</p>
                                )}
                              </div>

                              {/* Tarde */}
                              <div className={`flex-1 rounded-lg px-3 py-2 text-xs ${tarde ? (tarde.alertaDisparado ? 'bg-red-50 border border-red-200' : 'bg-emerald-50 border border-emerald-200') : 'bg-slate-50 border border-dashed border-slate-200'}`}>
                                <p className={`font-semibold mb-0.5 ${tarde ? (tarde.alertaDisparado ? 'text-red-700' : 'text-emerald-700') : 'text-slate-400'}`}>
                                  🌆 Tarde
                                </p>
                                {tarde ? (
                                  <>
                                    <p className={`font-bold text-sm ${tarde.alertaDisparado ? 'text-red-800' : 'text-slate-800'}`}>
                                      {tarde.temperaturaGraus}°C{tarde.umidadePercent != null ? ` · ${tarde.umidadePercent}%` : ''}
                                    </p>
                                    <p className="text-slate-400 mt-0.5">{tarde.nomeUsuario}</p>
                                    {tarde.observacao && <p className="text-slate-500 italic mt-0.5">{tarde.observacao}</p>}
                                  </>
                                ) : (
                                  <p className="text-slate-400">Não registrado</p>
                                )}
                              </div>
                            </div>
                          </div>

                          {diaSelecionado <= diaHoje && (
                            <button
                              onClick={() => abrirLancamento(amb)}
                              className="mt-0.5 flex-shrink-0 text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                            >
                              + Registrar
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Botão marcar dia fechado */}
              {diaSelecionado <= diaHoje && (
                <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
                  <button
                    onClick={() => { setMotivoFechado(''); setMode('marcando_fechado') }}
                    className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 hover:border-slate-400 transition-colors shadow-sm"
                  >
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
                    </svg>
                    Farmácia fechada neste dia
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {!loading && ambientes.length === 0 && !diaFechadoSelecionado && (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
          <p className="text-sm text-slate-500 mb-3">Nenhum ambiente cadastrado.</p>
          <a href="/dashboard/temperatura/ambientes" className="text-sm text-blue-600 font-medium hover:underline">
            Cadastrar ambientes →
          </a>
        </div>
      )}

      {/* Modal lançamento de leitura */}
      {(mode === 'digitando' || mode === 'salvando' || mode === 'uploading') && ambienteSelecionado && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <p className="font-semibold text-slate-900">{ambienteSelecionado.nome}</p>
                <p className="text-xs text-slate-400">
                  {new Date(diaSelecionado + 'T12:00:00').toLocaleDateString('pt-BR')} · Limite {ambienteSelecionado.tempMin}°–{ambienteSelecionado.tempMax}°C
                </p>
              </div>
              <button onClick={() => setMode('idle')} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {(['MANHA', 'TARDE'] as Periodo[]).map(p => (
                  <button key={p} onClick={() => setPeriodo(p)}
                    className={`py-2 rounded-lg text-sm font-medium transition ${periodo === p ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    {p === 'MANHA' ? '🌅 Manhã' : '🌆 Tarde'}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Temperatura (°C) *</label>
                  <input type="number" step="0.1" className={inp} placeholder="Ex: 5.2" value={temperatura}
                    onChange={e => setTemperatura(e.target.value)} disabled={mode === 'salvando'} autoFocus />
                </div>

                {(ambienteSelecionado.umidadeMin != null || ambienteSelecionado.umidadeMax != null) && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Umidade (%)
                      {ambienteSelecionado.umidadeMin != null && (
                        <span className="text-slate-400 font-normal ml-1">Limite: {ambienteSelecionado.umidadeMin}%–{ambienteSelecionado.umidadeMax}%</span>
                      )}
                    </label>
                    <input type="number" step="0.1" className={inp} placeholder="Ex: 60" value={umidade}
                      onChange={e => setUmidade(e.target.value)} disabled={mode === 'salvando'} />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Observação (opcional)</label>
                  <input type="text" className={inp} placeholder="Ex: geladeira estava aberta" value={observacao}
                    onChange={e => setObservacao(e.target.value)} disabled={mode === 'salvando'} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Foto (opcional)</label>
                {fotoPreview ? (
                  <div className="relative">
                    <img src={fotoPreview} alt="preview" className="w-full h-36 object-cover rounded-lg border border-slate-200" />
                    <button onClick={() => { setFoto(null); setFotoPreview(null) }}
                      className="absolute top-2 right-2 w-6 h-6 bg-white rounded-full shadow text-slate-500 hover:text-red-600 flex items-center justify-center text-xs font-bold">✕</button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 px-3 py-2.5 border border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition">
                    <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                    </svg>
                    <span className="text-sm text-slate-500">Tirar foto ou escolher arquivo</span>
                    <input type="file" accept="image/*" capture="environment" className="hidden"
                      onChange={handleFotoChange} disabled={mode === 'salvando' || mode === 'uploading'} />
                  </label>
                )}
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>

            <div className="px-5 py-4 border-t border-slate-100">
              <button onClick={salvar} disabled={mode === 'salvando' || mode === 'uploading'}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl transition text-sm">
                {mode === 'uploading' ? 'Enviando foto...' : mode === 'salvando' ? 'Salvando...' : '✓ Confirmar leitura'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal marcar dia fechado */}
      {mode === 'marcando_fechado' && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">Farmácia fechada</p>
                  <p className="text-xs text-slate-400">
                    {new Date(diaSelecionado + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                  </p>
                </div>
              </div>
              <button onClick={() => setMode('idle')} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
            </div>

            <div className="px-5 py-4 space-y-3">
              <p className="text-xs text-slate-500">
                Marcar este dia como fechado justifica a ausência de leituras de temperatura e umidade, mantendo a conformidade do registro.
              </p>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Motivo (opcional)</label>
                <input
                  type="text"
                  className={inp}
                  placeholder="Ex: Feriado nacional, domingo, manutenção..."
                  value={motivoFechado}
                  onChange={e => setMotivoFechado(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div className="px-5 pb-5 flex gap-3">
              <button
                onClick={marcarFechado}
                className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition"
              >
                Confirmar
              </button>
              <button
                onClick={() => setMode('idle')}
                className="flex-1 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-600 text-sm font-medium rounded-xl transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback pós-salvamento */}
      {mode === 'salvo' && (
        <div className={`rounded-xl p-4 text-center ${ultimoAlerta ? 'bg-red-50 border border-red-200' : 'bg-emerald-50 border border-emerald-200'}`}>
          <p className={`font-semibold ${ultimoAlerta ? 'text-red-800' : 'text-emerald-800'}`}>
            {ultimoAlerta ? '⚠️ Leitura registrada — temperatura fora do limite!' : '✓ Leitura registrada com sucesso'}
          </p>
          <button onClick={() => setMode('idle')} className="mt-2 text-sm text-slate-500 underline">
            Fechar
          </button>
        </div>
      )}
    </div>
  )
}
