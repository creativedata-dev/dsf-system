'use client'

import { useState, useEffect, useCallback } from 'react'

type TipoPlano = 'TRIAL' | 'MENSAL' | 'ANUAL' | 'VITALICIO'

interface Plano {
  id: string
  nome: string
  descricao: string | null
  tipo: TipoPlano
  precoMensal: number | null
  precoAnual: number | null
  limiteUsuarios: number | null
  limiteDsfsMes: number | null
  trialDias: number | null
  ativo: boolean
  createdAt: string
  _count: { assinaturas: number }
}

const TIPO_LABEL: Record<TipoPlano, string> = {
  TRIAL: 'Trial',
  MENSAL: 'Mensal',
  ANUAL: 'Anual',
  VITALICIO: 'Vitalício',
}

const TIPO_COLOR: Record<TipoPlano, string> = {
  TRIAL:    'bg-amber-100 text-amber-700',
  MENSAL:   'bg-blue-100 text-blue-700',
  ANUAL:    'bg-purple-100 text-purple-700',
  VITALICIO:'bg-green-100 text-green-700',
}

function fmtBRL(centavos: number | null) {
  if (centavos == null) return '—'
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const BLANK_FORM = {
  nome: '', descricao: '', tipo: 'MENSAL' as TipoPlano,
  precoMensal: '', precoAnual: '', limiteUsuarios: '', limiteDsfsMes: '',
  trialDias: '', ativo: true,
}

type PlanoForm = typeof BLANK_FORM

function PlanoModal({
  title, form, onChange, saving, error, onSave, onClose,
}: {
  title: string
  form: PlanoForm
  onChange: (f: PlanoForm) => void
  saving: boolean
  error: string
  onSave: () => void
  onClose: () => void
}) {
  const set = (key: keyof PlanoForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    onChange({ ...form, [key]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !saving && onClose()} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} disabled={saving} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {/* Nome + Tipo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Nome</label>
              <input value={form.nome} onChange={set('nome')} placeholder="Ex: Mensal Plus"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Tipo</label>
              <select value={form.tipo} onChange={set('tipo')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                {(Object.keys(TIPO_LABEL) as TipoPlano[]).map(t => (
                  <option key={t} value={t}>{TIPO_LABEL[t]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Descrição</label>
            <textarea rows={2} value={form.descricao} onChange={set('descricao')}
              placeholder="Descrição exibida para o cliente…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>

          {/* Preços */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Preço mensal (R$)</label>
              <input type="number" min="0" step="0.01" value={form.precoMensal} onChange={set('precoMensal')}
                placeholder="0,00"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Preço anual (R$)</label>
              <input type="number" min="0" step="0.01" value={form.precoAnual} onChange={set('precoAnual')}
                placeholder="0,00"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* Limites */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Limite de usuários <span className="text-slate-400">(vazio = ilimitado)</span></label>
              <input type="number" min="1" value={form.limiteUsuarios} onChange={set('limiteUsuarios')}
                placeholder="Ilimitado"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Limite DSFs/mês <span className="text-slate-400">(vazio = ilimitado)</span></label>
              <input type="number" min="1" value={form.limiteDsfsMes} onChange={set('limiteDsfsMes')}
                placeholder="Ilimitado"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* Trial dias */}
          {form.tipo === 'TRIAL' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Duração do trial (dias)</label>
              <input type="number" min="1" value={form.trialDias} onChange={set('trialDias')}
                placeholder="14"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}

          {/* Ativo */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={form.ativo} onChange={set('ativo')} className="w-4 h-4 rounded accent-blue-600" />
            <span className="text-sm text-slate-700">Plano ativo (disponível para assinatura)</span>
          </label>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex-shrink-0 flex gap-3 justify-end">
          <button onClick={onClose} disabled={saving}
            className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50">
            Cancelar
          </button>
          <button onClick={onSave} disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PlanosPage() {
  const [planos, setPlanos] = useState<Plano[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; plano?: Plano } | null>(null)
  const [form, setForm] = useState<PlanoForm>(BLANK_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const fetchPlanos = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/planos')
      if (!res.ok) throw new Error()
      setPlanos((await res.json()).planos)
    } catch { setError('Erro ao carregar planos.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchPlanos() }, [fetchPlanos])

  function openCreate() {
    setForm(BLANK_FORM)
    setFormError('')
    setModal({ mode: 'create' })
  }

  function openEdit(p: Plano) {
    setForm({
      nome: p.nome,
      descricao: p.descricao ?? '',
      tipo: p.tipo,
      precoMensal: p.precoMensal != null ? String(p.precoMensal / 100) : '',
      precoAnual: p.precoAnual != null ? String(p.precoAnual / 100) : '',
      limiteUsuarios: p.limiteUsuarios != null ? String(p.limiteUsuarios) : '',
      limiteDsfsMes: p.limiteDsfsMes != null ? String(p.limiteDsfsMes) : '',
      trialDias: p.trialDias != null ? String(p.trialDias) : '',
      ativo: p.ativo,
    })
    setFormError('')
    setModal({ mode: 'edit', plano: p })
  }

  function formToPayload() {
    return {
      nome: form.nome.trim(),
      descricao: form.descricao.trim() || null,
      tipo: form.tipo,
      precoMensal: form.precoMensal ? Math.round(parseFloat(form.precoMensal) * 100) : null,
      precoAnual: form.precoAnual ? Math.round(parseFloat(form.precoAnual) * 100) : null,
      limiteUsuarios: form.limiteUsuarios ? parseInt(form.limiteUsuarios) : null,
      limiteDsfsMes: form.limiteDsfsMes ? parseInt(form.limiteDsfsMes) : null,
      trialDias: form.trialDias ? parseInt(form.trialDias) : null,
      ativo: form.ativo,
    }
  }

  async function handleSave() {
    if (!form.nome.trim()) { setFormError('Nome é obrigatório.'); return }
    setSaving(true); setFormError('')
    try {
      const payload = formToPayload()
      const isEdit = modal?.mode === 'edit'
      const res = await fetch('/api/admin/planos', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isEdit ? { id: modal!.plano!.id, ...payload } : payload),
      })
      const json = await res.json()
      if (!res.ok) { setFormError(json.error ?? 'Erro ao salvar'); return }
      setModal(null)
      fetchPlanos()
    } catch { setFormError('Falha de conexão') }
    finally { setSaving(false) }
  }

  async function toggleAtivo(p: Plano) {
    try {
      await fetch('/api/admin/planos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.id, ativo: !p.ativo }),
      })
      fetchPlanos()
    } catch { /* silencioso */ }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Planos de Assinatura</h1>
          <p className="text-sm text-slate-500 mt-1">{planos.length} plano{planos.length !== 1 ? 's' : ''} cadastrado{planos.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Novo Plano
        </button>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Plano</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Mensal</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Anual</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Users</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">DSFs</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Assin.</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {planos.map((p) => (
                <tr key={p.id} className={`hover:bg-slate-50 transition-colors ${!p.ativo ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{p.nome}</p>
                    {p.descricao && <p className="text-xs text-slate-400 mt-0.5 max-w-[200px] truncate">{p.descricao}</p>}
                    {p.tipo === 'TRIAL' && p.trialDias && (
                      <p className="text-xs text-amber-600 mt-0.5">{p.trialDias} dias</p>
                    )}
                    <p className="text-[10px] text-slate-300 mt-0.5">{new Date(p.createdAt).toLocaleDateString('pt-BR')}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${TIPO_COLOR[p.tipo]}`}>
                      {TIPO_LABEL[p.tipo]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700 tabular-nums text-sm">{fmtBRL(p.precoMensal)}</td>
                  <td className="px-4 py-3 text-right text-slate-700 tabular-nums text-sm">{fmtBRL(p.precoAnual)}</td>
                  <td className="px-4 py-3 text-center text-slate-600 text-sm">{p.limiteUsuarios ?? '∞'}</td>
                  <td className="px-4 py-3 text-center text-slate-600 text-sm">{p.limiteDsfsMes ?? '∞'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${p.ativo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {p._count.assinaturas} · {p.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => openEdit(p)}
                        className="px-2.5 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50">
                        Editar
                      </button>
                      <button onClick={() => toggleAtivo(p)}
                        className={`px-2.5 py-1.5 text-xs font-medium rounded-lg ${p.ativo ? 'text-red-700 bg-red-50 hover:bg-red-100' : 'text-green-700 bg-green-50 hover:bg-green-100'}`}>
                        {p.ativo ? 'Desativar' : 'Ativar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {planos.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-sm text-slate-400">
                    Nenhum plano cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <PlanoModal
          title={modal.mode === 'create' ? 'Novo Plano' : `Editar — ${modal.plano?.nome}`}
          form={form}
          onChange={setForm}
          saving={saving}
          error={formError}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
