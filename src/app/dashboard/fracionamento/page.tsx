'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'

const UNIDADES = ['un', 'cx', 'mL', 'g', 'mg', 'L', 'kg', 'comp', 'amp', 'fr']

interface Lote {
  id: string
  nomeProduto: string
  fabricante: string
  lote: string
  validade: string
  quantidade: number
  unidade: string
  status: string
}

interface FracaoForm {
  quantidade: string
  unidade: string
  destinacao: string
}

interface FracaoItem {
  id: string
  numero: number
  quantidade: number
  unidade: string
  destinacao: string | null
  etiquetaImpressaEm: string | null
}

interface Fracionamento {
  id: string
  loteId: string
  nomeProduto: string
  fabricante: string
  lote: string
  validade: string
  quantidadeFracionada: number
  unidadeOrigem: string
  totalFracoes: number
  obs: string | null
  dataFracionamento: string
  createdAt: string
  fracoes: FracaoItem[]
}

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

export default function FracionamentoPage() {
  const { data: session } = useSession()
  const podeCriar = session?.user?.permissions?.includes('FRACIONAMENTO_GERENCIAR')
    || session?.user?.permissions?.includes('SUPER_ADMIN_GLOBAIS')

  const [fracionamentos, setFracionamentos] = useState<Fracionamento[]>([])
  const [lotes, setLotes] = useState<Lote[]>([])
  const [loading, setLoading] = useState(true)
  const [abrirModal, setAbrirModal] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [expandido, setExpandido] = useState<string | null>(null)

  // Form novo fracionamento
  const [loteId, setLoteId] = useState('')
  const [qtdFracionada, setQtdFracionada] = useState('')
  const [obs, setObs] = useState('')
  const [fracoes, setFracoes] = useState<FracaoForm[]>([
    { quantidade: '', unidade: 'un', destinacao: '' },
  ])

  const fetchFracionamentos = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/fracionamento')
      if (res.ok) setFracionamentos(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchLotes = useCallback(async () => {
    const res = await fetch('/api/validade/lotes?status=ATIVO')
    if (res.ok) setLotes(await res.json())
  }, [])

  useEffect(() => {
    fetchFracionamentos()
    fetchLotes()
  }, [fetchFracionamentos, fetchLotes])

  function addFracao() {
    const ultima = fracoes[fracoes.length - 1]
    setFracoes([...fracoes, { quantidade: ultima.quantidade, unidade: ultima.unidade, destinacao: '' }])
  }

  function removeFracao(idx: number) {
    if (fracoes.length === 1) return
    setFracoes(fracoes.filter((_, i) => i !== idx))
  }

  function updateFracao(idx: number, field: keyof FracaoForm, val: string) {
    setFracoes(fracoes.map((f, i) => i === idx ? { ...f, [field]: val } : f))
  }

  function resetForm() {
    setLoteId(''); setQtdFracionada(''); setObs('')
    setFracoes([{ quantidade: '', unidade: 'un', destinacao: '' }])
    setErro('')
  }

  async function handleSalvar() {
    if (!loteId || !qtdFracionada) { setErro('Selecione o lote e informe a quantidade fracionada'); return }
    for (const fr of fracoes) {
      if (!fr.quantidade || !fr.unidade) { setErro('Preencha quantidade e unidade de todas as frações'); return }
    }
    setSalvando(true); setErro('')
    try {
      const res = await fetch('/api/fracionamento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loteId,
          quantidadeFracionada: Number(qtdFracionada),
          obs: obs || undefined,
          fracoes: fracoes.map(f => ({
            quantidade: Number(f.quantidade),
            unidade: f.unidade,
            destinacao: f.destinacao || undefined,
          })),
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setErro(d.error ?? 'Erro ao registrar fracionamento')
        return
      }
      setAbrirModal(false)
      resetForm()
      fetchFracionamentos()
    } finally {
      setSalvando(false)
    }
  }

  async function imprimirEtiquetas(fracionamentoId: string, fracaoId?: string) {
    const url = fracaoId
      ? `/api/fracionamento/${fracionamentoId}/etiqueta?fracaoId=${fracaoId}`
      : `/api/fracionamento/${fracionamentoId}/etiqueta`
    window.open(url, '_blank')
    // Atualiza lista para refletir timestamp de impressão
    setTimeout(fetchFracionamentos, 1500)
  }

  const loteSelecionado = lotes.find(l => l.id === loteId)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Fracionamento</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Registre fracionamentos de lotes e imprima etiquetas com QR Code para cada fração
          </p>
        </div>
        {podeCriar && (
          <button
            onClick={() => { setAbrirModal(true); setErro('') }}
            className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            + Novo Fracionamento
          </button>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <p className="text-slate-500 text-sm">Carregando...</p>
      ) : fracionamentos.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-4xl mb-3">✂️</p>
          <p className="font-medium">Nenhum fracionamento registrado</p>
          <p className="text-sm mt-1">Registre o primeiro fracionamento clicando em "+ Novo Fracionamento"</p>
        </div>
      ) : (
        <div className="space-y-3">
          {fracionamentos.map(f => (
            <div key={f.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              {/* Linha principal */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => setExpandido(expandido === f.id ? null : f.id)}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 truncate">{f.nomeProduto}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {f.fabricante} · Lote {f.lote} · Val: {fmt(f.validade)}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Fracionado em {fmt(f.dataFracionamento)} · {f.totalFracoes} {f.totalFracoes === 1 ? 'fração' : 'frações'} · {f.quantidadeFracionada} {f.unidadeOrigem} retirados
                  </p>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <button
                    onClick={e => { e.stopPropagation(); imprimirEtiquetas(f.id) }}
                    className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors font-medium"
                  >
                    🖨️ Todas etiquetas
                  </button>
                  <span className="text-slate-400">{expandido === f.id ? '▲' : '▼'}</span>
                </div>
              </div>

              {/* Frações expandidas */}
              {expandido === f.id && (
                <div className="border-t border-slate-100 px-4 pb-4 pt-3 bg-slate-50">
                  {f.obs && (
                    <p className="text-xs text-slate-500 mb-3 italic">Obs: {f.obs}</p>
                  )}
                  <div className="grid gap-2">
                    {f.fracoes.map(fr => (
                      <div key={fr.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2">
                        <div>
                          <span className="text-xs font-semibold text-slate-700">
                            Fração {fr.numero}/{f.totalFracoes}
                          </span>
                          <span className="text-xs text-slate-500 ml-2">
                            {fr.quantidade} {fr.unidade}
                            {fr.destinacao ? ` · ${fr.destinacao}` : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {fr.etiquetaImpressaEm ? (
                            <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                              Impressa {fmt(fr.etiquetaImpressaEm)}
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                              Não impressa
                            </span>
                          )}
                          <button
                            onClick={() => imprimirEtiquetas(f.id, fr.id)}
                            className="text-[10px] text-indigo-600 hover:text-indigo-800 font-medium"
                          >
                            🖨️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal novo fracionamento */}
      {abrirModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-bold text-slate-800">Novo Fracionamento</h2>
              <button onClick={() => { setAbrirModal(false); resetForm() }} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {/* Seleção de lote */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Lote de origem *</label>
                <select
                  value={loteId}
                  onChange={e => setLoteId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="">Selecione um lote ativo...</option>
                  {lotes.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.nomeProduto} — Lote {l.lote} — Val: {fmt(l.validade)} ({l.quantidade} {l.unidade})
                    </option>
                  ))}
                </select>
                {loteSelecionado && (
                  <p className="text-xs text-slate-500 mt-1">
                    Fabricante: {loteSelecionado.fabricante} · Disponível: {loteSelecionado.quantidade} {loteSelecionado.unidade}
                  </p>
                )}
              </div>

              {/* Quantidade fracionada do lote original */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Quantidade retirada do lote original *
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={qtdFracionada}
                    onChange={e => setQtdFracionada(e.target.value)}
                    placeholder="Ex: 100"
                    className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  {loteSelecionado && (
                    <span className="flex items-center text-sm text-slate-500 px-2">{loteSelecionado.unidade}</span>
                  )}
                </div>
              </div>

              {/* Frações */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-slate-700">Frações geradas *</label>
                  <button
                    type="button"
                    onClick={addFracao}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    + Adicionar fração
                  </button>
                </div>
                <div className="space-y-2">
                  {fracoes.map((fr, idx) => (
                    <div key={idx} className="flex gap-2 items-start border border-slate-200 rounded-lg p-3 bg-slate-50">
                      <span className="text-xs font-semibold text-slate-400 pt-2 w-8 shrink-0">#{idx + 1}</span>
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={fr.quantidade}
                          onChange={e => updateFracao(idx, 'quantidade', e.target.value)}
                          placeholder="Qtd"
                          className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                        <select
                          value={fr.unidade}
                          onChange={e => updateFracao(idx, 'unidade', e.target.value)}
                          className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        >
                          {UNIDADES.map(u => <option key={u}>{u}</option>)}
                        </select>
                        <input
                          type="text"
                          value={fr.destinacao}
                          onChange={e => updateFracao(idx, 'destinacao', e.target.value)}
                          placeholder="Destinação (opcional)"
                          className="col-span-2 border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                      </div>
                      {fracoes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeFracao(idx)}
                          className="text-slate-300 hover:text-red-400 text-lg leading-none pt-1"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Observação */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Observação</label>
                <textarea
                  value={obs}
                  onChange={e => setObs(e.target.value)}
                  rows={2}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                />
              </div>

              {erro && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{erro}</p>}
            </div>

            <div className="p-5 border-t border-slate-100 flex gap-3 justify-end">
              <button
                onClick={() => { setAbrirModal(false); resetForm() }}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvar}
                disabled={salvando}
                className="px-5 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {salvando ? 'Salvando...' : 'Registrar e gerar etiquetas'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
