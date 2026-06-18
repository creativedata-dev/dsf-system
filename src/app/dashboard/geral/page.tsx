'use client'

import { useState, useEffect } from 'react'

interface TenantGeral {
  nomeFantasia: string
  razaoSocial: string | null
  cnpj: string | null
  endereco: string | null
  telefone: string | null
  alvaraSanitario: string | null
  tipoImpressao: string
}

function fmtCnpj(v: string) {
  return v.replace(/\D/g, '').replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
}

export default function GeralPage() {
  const [dados, setDados] = useState<TenantGeral | null>(null)
  const [form, setForm] = useState<Partial<TenantGeral>>({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  useEffect(() => {
    fetch('/api/geral')
      .then(r => r.json())
      .then((d: TenantGeral) => { setDados(d); setForm(d) })
  }, [])

  function set(field: keyof TenantGeral, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function salvar() {
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch('/api/geral', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) setMsg({ tipo: 'erro', texto: data.error ?? 'Erro ao salvar.' })
      else setMsg({ tipo: 'ok', texto: 'Dados salvos com sucesso!' })
    } catch {
      setMsg({ tipo: 'erro', texto: 'Erro de conexão.' })
    } finally {
      setSaving(false)
    }
  }

  if (!dados) return <div className="p-6 text-gray-500">Carregando...</div>

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dados da Farmácia</h1>
        <p className="text-sm text-gray-500 mt-1">Informações do estabelecimento exibidas nos documentos e relatórios.</p>
      </div>

      {msg && (
        <div className={`rounded-lg px-4 py-3 text-sm ${msg.tipo === 'ok' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {msg.texto}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome Fantasia *</label>
            <input
              type="text"
              value={form.nomeFantasia ?? ''}
              onChange={e => set('nomeFantasia', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Razão Social</label>
            <input
              type="text"
              value={form.razaoSocial ?? ''}
              onChange={e => set('razaoSocial', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ</label>
            <input
              type="text"
              value={form.cnpj ? fmtCnpj(form.cnpj) : ''}
              onChange={e => set('cnpj', e.target.value.replace(/\D/g, ''))}
              placeholder="00.000.000/0000-00"
              maxLength={18}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
            <input
              type="text"
              value={form.telefone ?? ''}
              onChange={e => set('telefone', e.target.value)}
              placeholder="(00) 00000-0000"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
            <input
              type="text"
              value={form.endereco ?? ''}
              onChange={e => set('endereco', e.target.value)}
              placeholder="Rua, número, bairro, cidade — UF"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Alvará Sanitário</label>
            <input
              type="text"
              value={form.alvaraSanitario ?? ''}
              onChange={e => set('alvaraSanitario', e.target.value)}
              placeholder="Número do alvará"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Impressão</label>
            <select
              value={form.tipoImpressao ?? 'BOBINA_80MM'}
              onChange={e => set('tipoImpressao', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="BOBINA_80MM">Cupom Térmico 80mm</option>
              <option value="FOLHA_A4">Folha A4</option>
            </select>
          </div>
        </div>

        <div className="pt-2">
          <button
            onClick={salvar}
            disabled={saving}
            className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </div>
    </div>
  )
}
