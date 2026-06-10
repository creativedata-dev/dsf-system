'use client'

import { useEffect, useState, useCallback } from 'react'

interface Procedimento {
  tipoServico: string
  label: string
  ativo: boolean
  textoOrientacao: string | null
}

export default function ProcedimentosPage() {
  const [procedimentos, setProcedimentos] = useState<Procedimento[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/procedimentos')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setProcedimentos(data.procedimentos)
    } catch {
      setError('Erro ao carregar procedimentos.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function toggle(tipo: string) {
    setProcedimentos((prev) =>
      prev.map((p) => p.tipoServico === tipo ? { ...p, ativo: !p.ativo } : p)
    )
  }

  function setTexto(tipo: string, texto: string) {
    setProcedimentos((prev) =>
      prev.map((p) => p.tipoServico === tipo ? { ...p, textoOrientacao: texto || null } : p)
    )
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const res = await fetch('/api/admin/procedimentos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ procedimentos }),
      })
      if (!res.ok) throw new Error()
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('Erro ao salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Procedimentos</h1>
          <p className="text-sm text-slate-500 mt-1">
            Ative ou desative tipos de serviço e personalize os textos de orientação impressos na DSF
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
      </div>

      {saved && (
        <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg">
          Configurações salvas com sucesso.
        </div>
      )}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-slate-500">Carregando…</div>
      ) : (
        <div className="space-y-3">
          {procedimentos.map((p) => (
            <div
              key={p.tipoServico}
              className={`rounded-xl border bg-white p-4 transition-opacity ${p.ativo ? '' : 'opacity-60'}`}
            >
              <div className="flex items-center justify-between gap-4">
                <span className="font-medium text-slate-800 text-sm">{p.label}</span>
                <button
                  type="button"
                  onClick={() => toggle(p.tipoServico)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                    p.ativo ? 'bg-green-500' : 'bg-slate-300'
                  }`}
                  role="switch"
                  aria-checked={p.ativo}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
                      p.ativo ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {p.ativo && (
                <div className="mt-3">
                  <label className="block text-xs text-slate-500 mb-1">
                    Texto de orientação (opcional) — aparece na impressão do DSF
                  </label>
                  <textarea
                    rows={3}
                    value={p.textoOrientacao ?? ''}
                    onChange={(e) => setTexto(p.tipoServico, e.target.value)}
                    placeholder={`Ex: PA 12x8 → Normal | PA 13x9 → Alta, consultar médico`}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
