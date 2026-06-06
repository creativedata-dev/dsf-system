'use client'

import { useEffect, useState, useCallback } from 'react'

interface Ambiente {
  id: string
  nome: string
}

interface Registro {
  id: string
  dataLeitura: string
  periodo: string
  temperaturaGraus: number
  umidadePercent: number | null
  alertaDisparado: boolean
  observacao: string | null
  fotoUrl: string | null
  nomeUsuario: string
  ambiente: {
    nome: string
    tempMin: number
    tempMax: number
  }
}

function hoje() {
  return new Date().toISOString().slice(0, 10)
}
function trintaDiasAtras() {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().slice(0, 10)
}

export default function HistoricoPage() {
  const [ambientes, setAmbientes] = useState<Ambiente[]>([])
  const [registros, setRegistros] = useState<Registro[]>([])
  const [loading, setLoading] = useState(false)
  const [exportando, setExportando] = useState(false)

  const [ambienteId, setAmbienteId] = useState('')
  const [dataInicio, setDataInicio] = useState(trintaDiasAtras())
  const [dataFim, setDataFim] = useState(hoje())

  useEffect(() => {
    fetch('/api/ambientes').then(r => r.json()).then(setAmbientes)
  }, [])

  const buscar = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ dataInicio, dataFim })
    if (ambienteId) params.set('ambienteId', ambienteId)
    const res = await fetch(`/api/temperatura/historico?${params}`)
    if (res.ok) setRegistros(await res.json())
    setLoading(false)
  }, [ambienteId, dataInicio, dataFim])

  useEffect(() => { buscar() }, [buscar])

  async function exportarPdf() {
    setExportando(true)
    const params = new URLSearchParams({ dataInicio, dataFim })
    if (ambienteId) params.set('ambienteId', ambienteId)
    const res = await fetch(`/api/temperatura/export?${params}`)
    if (res.ok) {
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `temperatura_${dataInicio}_${dataFim}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    }
    setExportando(false)
  }

  const inp =
    'px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition'

  const alertasCount = registros.filter(r => r.alertaDisparado).length

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Histórico de Temperatura</h1>
          <p className="text-sm text-slate-500 mt-0.5">Registros por ambiente e período</p>
        </div>
        <button
          onClick={exportarPdf}
          disabled={exportando || registros.length === 0}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition"
        >
          {exportando ? 'Gerando PDF...' : '↓ Exportar PDF'}
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Ambiente</label>
          <select
            className={inp}
            value={ambienteId}
            onChange={e => setAmbienteId(e.target.value)}
          >
            <option value="">Todos os ambientes</option>
            {ambientes.map(a => (
              <option key={a.id} value={a.id}>{a.nome}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">De</label>
          <input type="date" className={inp} value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Até</label>
          <input type="date" className={inp} value={dataFim} onChange={e => setDataFim(e.target.value)} />
        </div>
      </div>

      {/* Resumo */}
      {!loading && registros.length > 0 && (
        <div className="flex gap-4 text-sm">
          <span className="text-slate-600">{registros.length} registros</span>
          {alertasCount > 0 && (
            <span className="text-red-600 font-medium">⚠️ {alertasCount} alerta{alertasCount > 1 ? 's' : ''}</span>
          )}
        </div>
      )}

      {/* Tabela */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Carregando...</div>
      ) : registros.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
          <p className="text-slate-500 text-sm">Nenhum registro encontrado para o período selecionado.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Data</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Período</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Ambiente</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Temp (°C)</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Umid (%)</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Responsável</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Status</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Foto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {registros.map(r => {
                const tempFora = r.temperaturaGraus < r.ambiente.tempMin || r.temperaturaGraus > r.ambiente.tempMax
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700">
                      {new Date(r.dataLeitura).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {r.periodo === 'MANHA' ? 'Manhã' : 'Tarde'}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{r.ambiente.nome}</td>
                    <td className={`px-4 py-3 text-right font-mono font-medium ${tempFora ? 'text-red-600' : 'text-slate-700'}`}>
                      {r.temperaturaGraus.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {r.umidadePercent != null ? r.umidadePercent.toFixed(1) : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{r.nomeUsuario}</td>
                    <td className="px-4 py-3 text-center">
                      {r.alertaDisparado ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                          ⚠ Alerta
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
                          ✓ OK
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {r.fotoUrl ? (
                        <a
                          href={r.fotoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition"
                          title="Ver foto no Drive"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                          </svg>
                        </a>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <a
        href="/dashboard/temperatura"
        className="block text-center text-sm text-slate-500 hover:text-slate-700 pt-2"
      >
        ← Voltar para lançamentos
      </a>
    </div>
  )
}
