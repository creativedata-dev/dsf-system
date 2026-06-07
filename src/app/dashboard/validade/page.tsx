'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'

const UNIDADES = ['un', 'cx', 'mL', 'g', 'mg', 'L', 'kg', 'comp', 'amp', 'fr']
const MOTIVOS_DESCARTE = ['Vencimento', 'Contaminação', 'Embalagem danificada', 'Recall do fabricante', 'Qualidade comprometida', 'Outro']

interface ProdutoCatalogo {
  id: string
  nome: string
  fabricante: string | null
  unidadePadrao: string
}

interface Descarte {
  id: string
  numeroAuto: string
  motivo: string
  dataDescarte: string
  responsavel: string
}

interface Lote {
  id: string
  nomeProduto: string
  produtoCatalogoId: string
  fabricante: string
  lote: string
  validade: string
  diffDias: number
  quantidade: number
  unidade: string
  status: 'ATIVO' | 'QUARENTENA' | 'DESCARTADO'
  alerta: 'VENCIDO' | 'VENCENDO_30' | 'VENCENDO_90' | null
  localizacao: string | null
  obs: string | null
  descarte: Descarte | null
  createdAt: string
}

type Aba = 'alertas' | 'quarentena' | 'todos'
type Modal = null | 'novo' | 'quarentena' | 'descartar'

const alertaConfig = {
  VENCIDO:     { label: 'Vencido',       bg: 'bg-red-100',    text: 'text-red-700',    border: 'border-red-200' },
  VENCENDO_30: { label: 'Vence em 30d',  bg: 'bg-amber-100',  text: 'text-amber-700',  border: 'border-amber-200' },
  VENCENDO_90: { label: 'Vence em 90d',  bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200' },
}

function formatValidade(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

function AlertaBadge({ alerta }: { alerta: Lote['alerta'] }) {
  if (!alerta) return null
  const cfg = alertaConfig[alerta]
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  )
}

function StatusBadge({ status }: { status: Lote['status'] }) {
  const cfg = {
    ATIVO:       { label: 'Ativo',       cls: 'bg-emerald-100 text-emerald-700' },
    QUARENTENA:  { label: 'Quarentena',  cls: 'bg-orange-100 text-orange-700' },
    DESCARTADO:  { label: 'Descartado',  cls: 'bg-slate-100 text-slate-500' },
  }[status]
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.cls}`}>{cfg.label}</span>
}

export default function ValidadePage() {
  const { data: session } = useSession()
  const [lotes, setLotes] = useState<Lote[]>([])
  const [loading, setLoading] = useState(true)
  const [aba, setAba] = useState<Aba>('alertas')
  const [modal, setModal] = useState<Modal>(null)
  const [loteAlvo, setLoteAlvo] = useState<Lote | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  // Form novo lote
  const [nomeProduto, setNomeProduto] = useState('')
  const [sugestoes, setSugestoes] = useState<ProdutoCatalogo[]>([])
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false)
  const [fabricante, setFabricante] = useState('')
  const [loteNum, setLoteNum] = useState('')
  const [validade, setValidade] = useState('')
  const [quantidade, setQuantidade] = useState('')
  const [unidade, setUnidade] = useState('un')
  const [localizacao, setLocalizacao] = useState('')
  const [obsNovo, setObsNovo] = useState('')

  // Form quarentena
  const [obsQuarentena, setObsQuarentena] = useState('')

  // Form descarte
  const [numeroAuto, setNumeroAuto] = useState('')
  const [motivoDescarte, setMotivoDescarte] = useState('Vencimento')
  const [dataDescarte, setDataDescarte] = useState(new Date().toISOString().split('T')[0])
  const [responsavel, setResponsavel] = useState(session?.user?.name ?? '')
  const [obsDescarte, setObsDescarte] = useState('')

  const autocompleteRef = useRef<HTMLDivElement>(null)

  const fetchLotes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/validade/lotes')
      if (res.ok) setLotes(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchLotes() }, [fetchLotes])

  useEffect(() => {
    if (!nomeProduto.trim()) { setSugestoes([]); return }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/validade/catalogo?q=${encodeURIComponent(nomeProduto)}`)
      if (res.ok) setSugestoes(await res.json())
    }, 250)
    return () => clearTimeout(t)
  }, [nomeProduto])

  function selecionarProduto(p: ProdutoCatalogo) {
    setNomeProduto(p.nome)
    setFabricante(p.fabricante ?? '')
    setUnidade(p.unidadePadrao)
    setSugestoes([])
    setMostrarSugestoes(false)
  }

  function resetForm() {
    setNomeProduto(''); setFabricante(''); setLoteNum(''); setValidade('')
    setQuantidade(''); setUnidade('un'); setLocalizacao(''); setObsNovo('')
    setSugestoes([]); setErro('')
  }

  async function salvarLote() {
    if (!nomeProduto || !fabricante || !loteNum || !validade || !quantidade) {
      setErro('Preencha todos os campos obrigatórios.'); return
    }
    setSalvando(true); setErro('')
    try {
      const res = await fetch('/api/validade/lotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nomeProduto, fabricante, lote: loteNum, validade, quantidade: parseFloat(quantidade), unidade, localizacao, obs: obsNovo }),
      })
      if (!res.ok) { const d = await res.json(); setErro(d.error ?? 'Erro ao salvar'); return }
      resetForm(); setModal(null); fetchLotes()
    } finally { setSalvando(false) }
  }

  async function salvarQuarentena() {
    if (!loteAlvo) return
    setSalvando(true); setErro('')
    try {
      const res = await fetch(`/api/validade/lotes/${loteAlvo.id}/quarentena`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ obs: obsQuarentena }),
      })
      if (!res.ok) { const d = await res.json(); setErro(d.error ?? 'Erro'); return }
      setModal(null); setLoteAlvo(null); setObsQuarentena(''); fetchLotes()
    } finally { setSalvando(false) }
  }

  async function salvarDescarte() {
    if (!loteAlvo) return
    if (!numeroAuto || !motivoDescarte || !dataDescarte || !responsavel) {
      setErro('Preencha todos os campos obrigatórios.'); return
    }
    setSalvando(true); setErro('')
    try {
      const res = await fetch(`/api/validade/lotes/${loteAlvo.id}/descartar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numeroAuto, motivo: motivoDescarte, dataDescarte, responsavel, obs: obsDescarte }),
      })
      if (!res.ok) { const d = await res.json(); setErro(d.error ?? 'Erro'); return }
      setModal(null); setLoteAlvo(null); setNumeroAuto(''); setObsDescarte(''); fetchLotes()
    } finally { setSalvando(false) }
  }

  // Filtros por aba
  const lotesAba = lotes.filter(l => {
    if (aba === 'alertas') return l.status === 'ATIVO' && l.alerta !== null
    if (aba === 'quarentena') return l.status === 'QUARENTENA'
    return true
  })

  const countAlertas = lotes.filter(l => l.status === 'ATIVO' && l.alerta !== null).length
  const countQuarentena = lotes.filter(l => l.status === 'QUARENTENA').length
  const countVencidos = lotes.filter(l => l.alerta === 'VENCIDO' && l.status === 'ATIVO').length

  const canEdit = session?.user?.permissions?.includes('VALIDADE_GERENCIAR') ||
                  session?.user?.permissions?.includes('SUPER_ADMIN_GLOBAIS')

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Controle de Validade</h1>
          <p className="text-sm text-slate-500 mt-0.5">Lotes por validade, quarentena e descarte</p>
        </div>
        {canEdit && (
          <button
            onClick={() => { resetForm(); setModal('novo') }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Novo Lote
          </button>
        )}
      </div>

      {/* Alertas em destaque */}
      {countVencidos > 0 && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800 flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <strong>{countVencidos} lote{countVencidos > 1 ? 's' : ''} vencido{countVencidos > 1 ? 's' : ''}.</strong>
          {' '}Mova para quarentena ou registre o descarte.
        </div>
      )}

      {/* Abas */}
      <div className="flex gap-1 mb-4 bg-slate-100 p-1 rounded-xl">
        {([
          { key: 'alertas', label: 'Alertas', count: countAlertas },
          { key: 'quarentena', label: 'Quarentena', count: countQuarentena },
          { key: 'todos', label: 'Todos', count: lotes.length },
        ] as { key: Aba; label: string; count: number }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setAba(t.key)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 ${
              aba === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                t.key === 'alertas' && countVencidos > 0 ? 'bg-red-500 text-white' :
                aba === t.key ? 'bg-slate-200 text-slate-700' : 'bg-slate-200 text-slate-500'
              }`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-center py-10 text-slate-400 text-sm">Carregando lotes...</div>
      ) : lotesAba.length === 0 ? (
        <div className="text-center py-10 text-slate-400 text-sm">
          {aba === 'alertas' ? 'Nenhum lote com alerta de validade.' :
           aba === 'quarentena' ? 'Nenhum produto em quarentena.' :
           'Nenhum lote cadastrado.'}
        </div>
      ) : (
        <div className="space-y-2">
          {lotesAba.map(l => (
            <div
              key={l.id}
              className={`bg-white rounded-xl border p-4 ${
                l.alerta === 'VENCIDO' ? 'border-red-200' :
                l.alerta === 'VENCENDO_30' ? 'border-amber-200' :
                l.status === 'QUARENTENA' ? 'border-orange-200' :
                'border-slate-200'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-sm font-semibold text-slate-900">{l.nomeProduto}</p>
                    <AlertaBadge alerta={l.alerta} />
                    <StatusBadge status={l.status} />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-0.5 text-xs text-slate-500">
                    <span>Lote: <strong className="text-slate-700">{l.lote}</strong></span>
                    <span>Validade: <strong className={l.alerta === 'VENCIDO' ? 'text-red-600' : 'text-slate-700'}>{formatValidade(l.validade)}</strong></span>
                    <span>Qtd: <strong className="text-slate-700">{l.quantidade} {l.unidade}</strong></span>
                    <span>Fab.: <strong className="text-slate-700">{l.fabricante}</strong></span>
                    {l.localizacao && <span className="col-span-2">Local: <strong className="text-slate-700">{l.localizacao}</strong></span>}
                  </div>
                  {l.descarte && (
                    <div className="mt-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-2 py-1">
                      Descartado em {formatValidade(l.descarte.dataDescarte)} — Auto nº {l.descarte.numeroAuto} — {l.descarte.motivo}
                    </div>
                  )}
                </div>

                {canEdit && l.status === 'ATIVO' && (
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => { setLoteAlvo(l); setObsQuarentena(''); setErro(''); setModal('quarentena') }}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors border border-orange-200"
                      title="Mover para quarentena"
                    >
                      Quarentena
                    </button>
                    <button
                      onClick={() => {
                        setLoteAlvo(l)
                        setNumeroAuto(''); setMotivoDescarte('Vencimento')
                        setDataDescarte(new Date().toISOString().split('T')[0])
                        setResponsavel(session?.user?.name ?? '')
                        setObsDescarte(''); setErro(''); setModal('descartar')
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 transition-colors border border-red-200"
                      title="Registrar descarte"
                    >
                      Descartar
                    </button>
                  </div>
                )}
                {canEdit && l.status === 'QUARENTENA' && (
                  <button
                    onClick={() => {
                      setLoteAlvo(l)
                      setNumeroAuto(''); setMotivoDescarte('Vencimento')
                      setDataDescarte(new Date().toISOString().split('T')[0])
                      setResponsavel(session?.user?.name ?? '')
                      setObsDescarte(''); setErro(''); setModal('descartar')
                    }}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 transition-colors border border-red-200 flex-shrink-0"
                  >
                    Descartar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal Novo Lote ── */}
      {modal === 'novo' && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="px-5 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Novo Lote</h2>
              <button onClick={() => setModal(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Produto com autocomplete */}
              <div className="relative" ref={autocompleteRef}>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Produto *</label>
                <input
                  value={nomeProduto}
                  onChange={e => { setNomeProduto(e.target.value); setMostrarSugestoes(true) }}
                  onFocus={() => setMostrarSugestoes(true)}
                  onBlur={() => setTimeout(() => setMostrarSugestoes(false), 150)}
                  placeholder="Ex: Amoxicilina 500mg Cápsulas"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {mostrarSugestoes && sugestoes.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {sugestoes.map(s => (
                      <button
                        key={s.id}
                        onMouseDown={() => selecionarProduto(s)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0"
                      >
                        <p className="font-medium text-slate-800">{s.nome}</p>
                        {s.fabricante && <p className="text-xs text-slate-400">{s.fabricante}</p>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Fabricante *</label>
                <input value={fabricante} onChange={e => setFabricante(e.target.value)} placeholder="Nome do fabricante" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Número do Lote *</label>
                  <input value={loteNum} onChange={e => setLoteNum(e.target.value)} placeholder="Ex: LOT2024A01" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Validade *</label>
                  <input type="date" value={validade} onChange={e => setValidade(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Quantidade *</label>
                  <input type="number" min="0" step="0.001" value={quantidade} onChange={e => setQuantidade(e.target.value)} placeholder="0" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Unidade *</label>
                  <select value={unidade} onChange={e => setUnidade(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Localização</label>
                <input value={localizacao} onChange={e => setLocalizacao(e.target.value)} placeholder="Ex: Prateleira A3, Geladeira 1" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Observações</label>
                <textarea value={obsNovo} onChange={e => setObsNovo(e.target.value)} rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>

              {erro && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</p>}

              <div className="flex gap-3 pt-1">
                <button onClick={() => setModal(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200">Cancelar</button>
                <button onClick={salvarLote} disabled={salvando} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                  {salvando ? 'Salvando...' : 'Salvar Lote'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Quarentena ── */}
      {modal === 'quarentena' && loteAlvo && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="px-5 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Mover para Quarentena</h2>
              <button onClick={() => setModal(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-sm">
                <p className="font-semibold text-orange-800">{loteAlvo.nomeProduto}</p>
                <p className="text-orange-700 text-xs mt-0.5">Lote {loteAlvo.lote} · Validade {formatValidade(loteAlvo.validade)} · {loteAlvo.quantidade} {loteAlvo.unidade}</p>
              </div>
              <p className="text-sm text-slate-600">O produto será segregado fisicamente e marcado como <strong>Quarentena</strong> no sistema. Será necessário registrar o descarte formal posteriormente.</p>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Motivo / Observação</label>
                <textarea value={obsQuarentena} onChange={e => setObsQuarentena(e.target.value)} rows={2} placeholder="Ex: Suspeita de contaminação, aguardando análise..." className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
              </div>
              {erro && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</p>}
              <div className="flex gap-3">
                <button onClick={() => setModal(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200">Cancelar</button>
                <button onClick={salvarQuarentena} disabled={salvando} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50">
                  {salvando ? 'Salvando...' : 'Confirmar Quarentena'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Descarte ── */}
      {modal === 'descartar' && loteAlvo && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="px-5 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Registrar Descarte</h2>
              <button onClick={() => setModal(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm">
                <p className="font-semibold text-red-800">{loteAlvo.nomeProduto}</p>
                <p className="text-red-700 text-xs mt-0.5">Lote {loteAlvo.lote} · Validade {formatValidade(loteAlvo.validade)} · {loteAlvo.quantidade} {loteAlvo.unidade}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nº do Auto de Descarte *</label>
                <input value={numeroAuto} onChange={e => setNumeroAuto(e.target.value)} placeholder="Ex: AD-2026-001" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Motivo do Descarte *</label>
                <select value={motivoDescarte} onChange={e => setMotivoDescarte(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white">
                  {MOTIVOS_DESCARTE.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Data do Descarte *</label>
                  <input type="date" value={dataDescarte} onChange={e => setDataDescarte(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Responsável *</label>
                  <input value={responsavel} onChange={e => setResponsavel(e.target.value)} placeholder="Nome do responsável" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Observações</label>
                <textarea value={obsDescarte} onChange={e => setObsDescarte(e.target.value)} rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none" />
              </div>

              {erro && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</p>}

              <div className="flex gap-3">
                <button onClick={() => setModal(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200">Cancelar</button>
                <button onClick={salvarDescarte} disabled={salvando} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                  {salvando ? 'Salvando...' : 'Confirmar Descarte'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
