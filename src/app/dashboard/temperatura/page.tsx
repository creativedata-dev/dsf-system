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

interface RegistroHoje {
  ambienteId: string
  periodo: string
  temperaturaGraus: number
  alertaDisparado: boolean
}

type Periodo = 'MANHA' | 'TARDE'
type Mode = 'idle' | 'selecionando' | 'digitando' | 'salvando' | 'salvo' | 'uploading'

const inp =
  'w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500 transition'

function periodoAtual(): Periodo {
  const h = new Date().getHours()
  return h < 13 ? 'MANHA' : 'TARDE'
}

function hoje(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function TemperaturaPage() {
  const [ambientes, setAmbientes] = useState<Ambiente[]>([])
  const [registrosHoje, setRegistrosHoje] = useState<RegistroHoje[]>([])
  const [loading, setLoading] = useState(true)

  const [mode, setMode] = useState<Mode>('idle')
  const [ambienteSelecionado, setAmbienteSelecionado] = useState<Ambiente | null>(null)
  const [periodo, setPeriodo] = useState<Periodo>(periodoAtual())
  const [temperatura, setTemperatura] = useState('')
  const [umidade, setUmidade] = useState('')
  const [observacao, setObservacao] = useState('')
  const [foto, setFoto] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [ultimoAlerta, setUltimoAlerta] = useState(false)

  const carregarDados = useCallback(async () => {
    const [ambRes, regRes] = await Promise.all([
      fetch('/api/ambientes'),
      fetch(`/api/temperatura/historico?dataInicio=${hoje()}&dataFim=${hoje()}`),
    ])
    if (ambRes.ok) setAmbientes(await ambRes.json())
    if (regRes.ok) setRegistrosHoje(await regRes.json())
    setLoading(false)
  }, [])

  useEffect(() => { carregarDados() }, [carregarDados])

  function statusAmbiente(amb: Ambiente): { ok: boolean; textos: string[] } {
    const regs = registrosHoje.filter(r => r.ambienteId === amb.id)
    const temManha = regs.some(r => r.periodo === 'MANHA')
    const temTarde = regs.some(r => r.periodo === 'TARDE')
    const temAlerta = regs.some(r => r.alertaDisparado)
    const textos: string[] = []
    if (!temManha) textos.push('Falta: Manhã')
    if (!temTarde) textos.push('Falta: Tarde')
    if (temAlerta) textos.push('Alerta de temperatura')
    return { ok: textos.length === 0, textos }
  }

  function iniciarLancamento(amb: Ambiente) {
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
    if (!temperatura || isNaN(temp)) {
      setError('Informe a temperatura')
      return
    }
    setError('')
    setMode('salvando')
    try {
      const res = await fetch('/api/temperatura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ambienteId: ambienteSelecionado.id,
          dataLeitura: hoje(),
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
        // Ignora erro de upload de foto — leitura já foi salva com sucesso
      }

      setMode('salvo')
      await carregarDados()
    } catch {
      setError('Erro de conexão')
      setMode('digitando')
    }
  }

  const alertasTotal = registrosHoje.filter(r => r.alertaDisparado).length
  const ambientesSemLeitura = ambientes.filter(a => {
    const regs = registrosHoje.filter(r => r.ambienteId === a.id)
    return !regs.some(r => r.periodo === 'MANHA') || !regs.some(r => r.periodo === 'TARDE')
  }).length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        Carregando...
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
      {/* Resumo do dia */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 mb-1">Temperatura e Umidade</h1>
        <p className="text-sm text-slate-500">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
        </p>
      </div>

      {(alertasTotal > 0 || ambientesSemLeitura > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1">
          {alertasTotal > 0 && (
            <p className="text-sm font-medium text-amber-800">
              ⚠️ {alertasTotal} leitura{alertasTotal > 1 ? 's' : ''} fora do limite hoje
            </p>
          )}
          {ambientesSemLeitura > 0 && (
            <p className="text-sm text-amber-700">
              {ambientesSemLeitura} ambiente{ambientesSemLeitura > 1 ? 's' : ''} sem leitura completa
            </p>
          )}
        </div>
      )}

      {/* Modal de lançamento */}
      {(mode === 'digitando' || mode === 'salvando' || mode === 'uploading') && ambienteSelecionado && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-900">{ambienteSelecionado.nome}</p>
              <p className="text-xs text-slate-500">
                Limite: {ambienteSelecionado.tempMin}°C — {ambienteSelecionado.tempMax}°C
              </p>
            </div>
            <button
              onClick={() => setMode('idle')}
              className="text-slate-400 hover:text-slate-600 text-lg leading-none"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(['MANHA', 'TARDE'] as Periodo[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriodo(p)}
                className={`py-2 rounded-lg text-sm font-medium transition ${
                  periodo === p
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {p === 'MANHA' ? '🌅 Manhã' : '🌆 Tarde'}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Temperatura (°C) *</label>
              <input
                type="number"
                step="0.1"
                className={inp}
                placeholder="Ex: 5.2"
                value={temperatura}
                onChange={e => setTemperatura(e.target.value)}
                disabled={mode === 'salvando'}
                autoFocus
              />
            </div>

            {(ambienteSelecionado.umidadeMin != null || ambienteSelecionado.umidadeMax != null) && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Umidade (%)
                  {ambienteSelecionado.umidadeMin != null && (
                    <span className="text-slate-400 font-normal ml-1">
                      Limite: {ambienteSelecionado.umidadeMin}% — {ambienteSelecionado.umidadeMax}%
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  step="0.1"
                  className={inp}
                  placeholder="Ex: 60"
                  value={umidade}
                  onChange={e => setUmidade(e.target.value)}
                  disabled={mode === 'salvando'}
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Observação (opcional)</label>
              <input
                type="text"
                className={inp}
                placeholder="Ex: geladeira estava aberta"
                value={observacao}
                onChange={e => setObservacao(e.target.value)}
                disabled={mode === 'salvando'}
              />
            </div>
          </div>

          {/* Foto opcional */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Foto do equipamento (opcional)</label>
            {fotoPreview ? (
              <div className="relative">
                <img src={fotoPreview} alt="Foto da leitura" className="w-full h-40 object-cover rounded-lg border border-slate-200" />
                <button
                  onClick={() => { setFoto(null); setFotoPreview(null) }}
                  className="absolute top-2 right-2 w-6 h-6 bg-white rounded-full shadow text-slate-500 hover:text-red-600 flex items-center justify-center text-xs font-bold"
                >
                  ✕
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-2 px-3 py-2.5 border border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition">
                <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                </svg>
                <span className="text-sm text-slate-500">Tirar foto ou escolher arquivo</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFotoChange}
                  disabled={mode === 'salvando' || mode === 'uploading'}
                />
              </label>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            onClick={salvar}
            disabled={mode === 'salvando' || mode === 'uploading'}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl transition text-sm"
          >
            {mode === 'uploading' ? 'Enviando foto...' : mode === 'salvando' ? 'Salvando...' : '✓ Confirmar leitura'}
          </button>
        </div>
      )}

      {mode === 'salvo' && (
        <div
          className={`rounded-xl p-4 text-center ${
            ultimoAlerta ? 'bg-red-50 border border-red-200' : 'bg-emerald-50 border border-emerald-200'
          }`}
        >
          <p className={`font-semibold ${ultimoAlerta ? 'text-red-800' : 'text-emerald-800'}`}>
            {ultimoAlerta ? '⚠️ Leitura registrada — temperatura fora do limite!' : '✓ Leitura registrada com sucesso'}
          </p>
          <button
            onClick={() => setMode('idle')}
            className="mt-3 text-sm text-slate-500 underline"
          >
            Registrar outra leitura
          </button>
        </div>
      )}

      {/* Lista de ambientes */}
      {mode === 'idle' && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Ambientes</h2>
          {ambientes.length === 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center">
              <p className="text-sm text-slate-500 mb-3">Nenhum ambiente cadastrado.</p>
              <a
                href="/dashboard/temperatura/ambientes"
                className="text-sm text-blue-600 font-medium hover:underline"
              >
                Cadastrar ambientes →
              </a>
            </div>
          )}
          {ambientes.map(amb => {
            const { ok, textos } = statusAmbiente(amb)
            return (
              <button
                key={amb.id}
                onClick={() => iniciarLancamento(amb)}
                className="w-full text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">{amb.nome}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {amb.tempMin}°C — {amb.tempMax}°C
                      {amb.umidadeMin != null && ` · ${amb.umidadeMin}% — ${amb.umidadeMax}%`}
                    </p>
                    {!ok && (
                      <div className="mt-1.5 space-y-0.5">
                        {textos.map(t => (
                          <p key={t} className="text-xs text-amber-700 font-medium">{t}</p>
                        ))}
                      </div>
                    )}
                  </div>
                  <span
                    className={`mt-0.5 shrink-0 w-2.5 h-2.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-amber-400'}`}
                  />
                </div>
              </button>
            )
          })}
        </div>
      )}

      {mode === 'idle' && ambientes.length > 0 && (
        <div className="flex gap-3 pt-2">
          <a
            href="/dashboard/temperatura/historico"
            className="flex-1 text-center py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition"
          >
            Histórico
          </a>
          <a
            href="/dashboard/temperatura/ambientes"
            className="flex-1 text-center py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition"
          >
            Gerenciar ambientes
          </a>
        </div>
      )}
    </div>
  )
}
