'use client'

import { useEffect, useState } from 'react'

interface Ambiente {
  id: string
  nome: string
  tipo: string
  tempMin: number
  tempMax: number
  umidadeMin: number | null
  umidadeMax: number | null
  ativo: boolean
}

type Mode = 'lista' | 'novo' | 'salvando' | 'editando' | 'salvando_edicao'

const inp =
  'w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500 transition'

const TIPOS = [
  { value: 'GELADEIRA', label: 'Geladeira / Câmara fria' },
  { value: 'AMBIENTE', label: 'Ambiente / Balcão' },
  { value: 'SALA_ESPECIAL', label: 'Sala especial (injetáveis)' },
]

const emptyForm = {
  nome: '',
  tipo: 'GELADEIRA',
  tempMin: '',
  tempMax: '',
  umidadeMin: '',
  umidadeMax: '',
}

export default function AmbientesPage() {
  const [ambientes, setAmbientes] = useState<Ambiente[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<Mode>('lista')
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [semPermissao, setSemPermissao] = useState(false)

  async function carregar() {
    const res = await fetch('/api/ambientes')
    if (res.ok) setAmbientes(await res.json())
    setLoading(false)
  }

  useEffect(() => { carregar() }, [])

  function abrirNovo() {
    setForm(emptyForm)
    setEditId(null)
    setError('')
    setMode('novo')
  }

  function abrirEdicao(amb: Ambiente) {
    setForm({
      nome: amb.nome,
      tipo: amb.tipo,
      tempMin: String(amb.tempMin),
      tempMax: String(amb.tempMax),
      umidadeMin: amb.umidadeMin != null ? String(amb.umidadeMin) : '',
      umidadeMax: amb.umidadeMax != null ? String(amb.umidadeMax) : '',
    })
    setEditId(amb.id)
    setError('')
    setMode('editando')
  }

  function validar(): string | null {
    if (!form.nome.trim()) return 'Nome obrigatório'
    if (!form.tempMin || !form.tempMax) return 'Limites de temperatura obrigatórios'
    if (parseFloat(form.tempMin) >= parseFloat(form.tempMax)) return 'Temperatura mínima deve ser menor que a máxima'
    if ((form.umidadeMin && !form.umidadeMax) || (!form.umidadeMin && form.umidadeMax)) {
      return 'Informe os dois limites de umidade ou nenhum'
    }
    return null
  }

  async function salvar() {
    const err = validar()
    if (err) { setError(err); return }
    setError('')
    setMode('salvando')

    const payload = {
      nome: form.nome.trim(),
      tipo: form.tipo,
      tempMin: parseFloat(form.tempMin),
      tempMax: parseFloat(form.tempMax),
      umidadeMin: form.umidadeMin ? parseFloat(form.umidadeMin) : null,
      umidadeMax: form.umidadeMax ? parseFloat(form.umidadeMax) : null,
    }

    const res = await fetch('/api/ambientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (res.status === 403) { setSemPermissao(true); setMode('lista'); return }
    if (!res.ok) {
      const e = await res.json()
      setError(e.error ?? 'Erro ao salvar')
      setMode('novo')
      return
    }
    await carregar()
    setMode('lista')
  }

  async function salvarEdicao() {
    if (!editId) return
    const err = validar()
    if (err) { setError(err); return }
    setError('')
    setMode('salvando_edicao')

    const payload = {
      nome: form.nome.trim(),
      tipo: form.tipo,
      tempMin: parseFloat(form.tempMin),
      tempMax: parseFloat(form.tempMax),
      umidadeMin: form.umidadeMin ? parseFloat(form.umidadeMin) : null,
      umidadeMax: form.umidadeMax ? parseFloat(form.umidadeMax) : null,
    }

    const res = await fetch(`/api/ambientes/${editId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (res.status === 403) { setSemPermissao(true); setMode('lista'); return }
    if (!res.ok) {
      const e = await res.json()
      setError(e.error ?? 'Erro ao salvar')
      setMode('editando')
      return
    }
    await carregar()
    setMode('lista')
  }

  async function desativar(id: string) {
    const res = await fetch(`/api/ambientes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: false }),
    })
    if (res.status === 403) { setSemPermissao(true); return }
    if (res.ok) await carregar()
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Carregando...</div>
  }

  if (semPermissao) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8 text-center">
        <p className="text-slate-600 text-sm">Você não tem permissão para gerenciar ambientes.</p>
        <a href="/dashboard/temperatura" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
          ← Voltar
        </a>
      </div>
    )
  }

  const isFormMode = mode === 'novo' || mode === 'salvando' || mode === 'editando' || mode === 'salvando_edicao'
  const isSaving = mode === 'salvando' || mode === 'salvando_edicao'
  const isEditing = mode === 'editando' || mode === 'salvando_edicao'

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Ambientes Monitorados</h1>
          <p className="text-sm text-slate-500 mt-0.5">Geladeiras, balcões e salas especiais</p>
        </div>
        {!isFormMode && (
          <button
            onClick={abrirNovo}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition"
          >
            + Novo
          </button>
        )}
      </div>

      {isFormMode && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-slate-900">{isEditing ? 'Editar ambiente' : 'Novo ambiente'}</h2>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nome *</label>
              <input
                type="text"
                className={inp}
                placeholder="Ex: Geladeira de Termolábeis"
                value={form.nome}
                onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                disabled={isSaving}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tipo *</label>
              <select
                className={inp}
                value={form.tipo}
                onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}
                disabled={isSaving}
              >
                {TIPOS.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Temp. mínima (°C) *</label>
                <input
                  type="number"
                  step="0.5"
                  className={inp}
                  placeholder="2"
                  value={form.tempMin}
                  onChange={e => setForm(p => ({ ...p, tempMin: e.target.value }))}
                  disabled={isSaving}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Temp. máxima (°C) *</label>
                <input
                  type="number"
                  step="0.5"
                  className={inp}
                  placeholder="8"
                  value={form.tempMax}
                  onChange={e => setForm(p => ({ ...p, tempMax: e.target.value }))}
                  disabled={isSaving}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Umidade mín. (%)</label>
                <input
                  type="number"
                  step="1"
                  className={inp}
                  placeholder="40"
                  value={form.umidadeMin}
                  onChange={e => setForm(p => ({ ...p, umidadeMin: e.target.value }))}
                  disabled={isSaving}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Umidade máx. (%)</label>
                <input
                  type="number"
                  step="1"
                  className={inp}
                  placeholder="60"
                  value={form.umidadeMax}
                  onChange={e => setForm(p => ({ ...p, umidadeMax: e.target.value }))}
                  disabled={isSaving}
                />
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <button
              onClick={() => setMode('lista')}
              disabled={isSaving}
              className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition"
            >
              Cancelar
            </button>
            <button
              onClick={isEditing ? salvarEdicao : salvar}
              disabled={isSaving}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-xl text-sm transition"
            >
              {isSaving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

      {!isFormMode && (
        <>
          {ambientes.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
              <p className="text-slate-500 text-sm">Nenhum ambiente cadastrado ainda.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {ambientes.map(amb => (
                <div key={amb.id} className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900">{amb.nome}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {TIPOS.find(t => t.value === amb.tipo)?.label ?? amb.tipo}
                      </p>
                      <p className="text-xs text-slate-500">
                        Temp: {amb.tempMin}°C — {amb.tempMax}°C
                        {amb.umidadeMin != null && ` · Umid: ${amb.umidadeMin}% — ${amb.umidadeMax}%`}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => abrirEdicao(amb)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => desativar(amb.id)}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Desativar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <a
            href="/dashboard/temperatura"
            className="block text-center text-sm text-slate-500 hover:text-slate-700 pt-2"
          >
            ← Voltar para lançamentos
          </a>
        </>
      )}
    </div>
  )
}
