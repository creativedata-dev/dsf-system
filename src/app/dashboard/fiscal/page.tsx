'use client'
import { useState, useEffect, useCallback } from 'react'

const SECOES_DISPONIVEIS = [
  { slug: 'TEMPERATURA', label: 'Temperatura e Umidade' },
  { slug: 'EQUIPAMENTOS', label: 'Equipamentos e Calibração' },
  { slug: 'POPS', label: 'POPs e Treinamentos' },
  { slug: 'VALIDADE', label: 'Controle de Validade' },
]

interface TokenFiscal {
  id: string
  token: string
  secoes: string[]
  dataInicio: string
  dataFim: string
  expiraEm: string
  usadoEm: string | null
  createdAt: string
  expirado: boolean
  logs: { evento: string; createdAt: string }[]
}

function fmtData(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}
function fmtHora(d: string) {
  return new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
}

export default function FiscalPage() {
  const hoje = new Date().toISOString().slice(0, 10)
  const [dataInicio, setDataInicio] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
  const [dataFim, setDataFim] = useState(hoje)
  const [secoes, setSecoes] = useState<string[]>(['TEMPERATURA', 'EQUIPAMENTOS', 'POPS', 'VALIDADE'])
  const [tokens, setTokens] = useState<TokenFiscal[]>([])
  const [loading, setLoading] = useState(false)
  const [gerandoId, setGerandoId] = useState<string | null>(null)
  const [linkGerado, setLinkGerado] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  const carregar = useCallback(async () => {
    const res = await fetch('/api/fiscal/tokens')
    if (res.ok) setTokens(await res.json())
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const toggleSecao = (slug: string) => {
    setSecoes(prev => prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug])
  }

  const gerarLink = async () => {
    if (!secoes.length) return alert('Selecione ao menos uma seção')
    setLoading(true)
    setLinkGerado(null)
    try {
      const res = await fetch('/api/fiscal/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secoes, dataInicio, dataFim }),
      })
      if (!res.ok) { alert((await res.json()).error); return }
      const data = await res.json()
      const url = `${window.location.origin}/fiscal/${data.token}`
      setLinkGerado(url)
      carregar()
    } finally {
      setLoading(false)
    }
  }

  const reenviar = async (id: string) => {
    setGerandoId(id)
    try {
      const res = await fetch(`/api/fiscal/tokens/${id}/reenviar`, { method: 'POST' })
      if (!res.ok) { alert((await res.json()).error); return }
      const data = await res.json()
      const url = `${window.location.origin}/fiscal/${data.token}`
      setLinkGerado(url)
      carregar()
    } finally {
      setGerandoId(null)
    }
  }

  const copiar = async (url: string) => {
    await navigator.clipboard.writeText(url)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Painel do Fiscal</h1>
        <p className="text-gray-500 text-sm mt-1">Gere links de acesso temporário para fiscais da ANVISA/Vigilância Sanitária</p>
      </div>

      {/* Gerador de link */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
        <h2 className="font-semibold text-gray-900">Gerar Novo Link</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data início</label>
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data fim</label>
            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Seções a incluir</label>
          <div className="grid grid-cols-2 gap-2">
            {SECOES_DISPONIVEIS.map(s => (
              <label key={s.slug} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={secoes.includes(s.slug)} onChange={() => toggleSecao(s.slug)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <span className="text-sm text-gray-700">{s.label}</span>
              </label>
            ))}
          </div>
        </div>

        <button onClick={gerarLink} disabled={loading}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {loading ? 'Gerando...' : 'Gerar Link de Acesso'}
        </button>

        {linkGerado && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-green-800">Link gerado! Válido por 30 minutos (uso único):</p>
            <div className="flex items-center gap-2">
              <input readOnly value={linkGerado}
                className="flex-1 text-xs bg-white border border-green-300 rounded px-2 py-1.5 font-mono" />
              <button onClick={() => copiar(linkGerado)}
                className="text-xs bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 transition-colors">
                {copiado ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Histórico de tokens */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Histórico de Links</h2>
        </div>
        {tokens.length === 0 ? (
          <div className="px-6 py-10 text-center text-gray-400 text-sm">Nenhum link gerado ainda</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {tokens.map(t => {
              const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/fiscal/${t.token}`
              return (
                <div key={t.id} className="px-6 py-4 flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        t.expirado ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'
                      }`}>
                        {t.expirado ? (t.usadoEm ? 'Utilizado' : 'Expirado') : 'Ativo'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {fmtData(t.dataInicio)} — {fmtData(t.dataFim)}
                      </span>
                      <span className="text-xs text-gray-400">
                        gerado {fmtHora(t.createdAt)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {t.secoes.map(s => (
                        <span key={s} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-blue-50 text-blue-700">
                          {SECOES_DISPONIVEIS.find(d => d.slug === s)?.label ?? s}
                        </span>
                      ))}
                    </div>
                    {t.usadoEm && (
                      <p className="text-xs text-amber-600">Aberto em {fmtHora(t.usadoEm)}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!t.expirado && (
                      <button onClick={() => copiar(url)}
                        className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 px-2 py-1 rounded transition-colors">
                        Copiar link
                      </button>
                    )}
                    <button onClick={() => reenviar(t.id)} disabled={gerandoId === t.id}
                      className="text-xs text-gray-600 hover:text-gray-900 border border-gray-200 px-2 py-1 rounded transition-colors disabled:opacity-50">
                      {gerandoId === t.id ? '...' : 'Reenviar'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
