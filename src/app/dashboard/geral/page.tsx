'use client'

import { useState, useEffect, useRef } from 'react'

interface TenantGeral {
  nomeFantasia: string
  razaoSocial: string | null
  cnpj: string | null
  endereco: string | null
  telefone: string | null
  alvaraSanitario: string | null
  tipoImpressao: string
  logoUrl: string | null
}

const CAMPOS_OBRIGATORIOS: (keyof TenantGeral)[] = [
  'nomeFantasia', 'razaoSocial', 'cnpj', 'endereco', 'telefone', 'alvaraSanitario',
]

function fmtCnpj(v: string) {
  return v.replace(/\D/g, '').replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
}

function resizeLogo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const MAX_W = 320, MAX_H = 160
        let { width: w, height: h } = img
        if (w > MAX_W || h > MAX_H) {
          const ratio = Math.min(MAX_W / w, MAX_H / h)
          w = Math.round(w * ratio); h = Math.round(h * ratio)
        }
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/webp', 0.85))
      }
      img.onerror = reject
      img.src = e.target!.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function campoVazio(v: string | null | undefined) {
  return !v || v.trim() === ''
}

export default function GeralPage() {
  const [dados, setDados] = useState<TenantGeral | null>(null)
  const [form, setForm] = useState<Partial<TenantGeral>>({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [tentouSalvar, setTentouSalvar] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/geral')
      .then(r => r.json())
      .then((d: TenantGeral) => { setDados(d); setForm(d) })
  }, [])

  function set(field: keyof TenantGeral, value: string | null) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const dataUrl = await resizeLogo(file)
      set('logoUrl', dataUrl)
    } catch {
      setMsg({ tipo: 'erro', texto: 'Erro ao processar a imagem.' })
    }
  }

  function erro(field: keyof TenantGeral) {
    return tentouSalvar && CAMPOS_OBRIGATORIOS.includes(field) && campoVazio(form[field] as string)
  }

  async function salvar() {
    setTentouSalvar(true)
    const faltando = CAMPOS_OBRIGATORIOS.some(f => campoVazio(form[f] as string))
    if (faltando) {
      setMsg({ tipo: 'erro', texto: 'Preencha todos os campos obrigatórios antes de salvar.' })
      return
    }
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

  const camposIncompletos = CAMPOS_OBRIGATORIOS.some(f => campoVazio(dados?.[f] as string))

  if (!dados) return <div className="p-6 text-gray-500">Carregando...</div>

  const inputClass = (field: keyof TenantGeral) =>
    `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
      erro(field)
        ? 'border-red-400 focus:ring-red-400 bg-red-50'
        : 'border-gray-300 focus:ring-blue-500'
    }`

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dados da Farmácia</h1>
        <p className="text-sm text-gray-500 mt-1">Informações do estabelecimento exibidas nos documentos e relatórios.</p>
      </div>

      {camposIncompletos && (
        <div className="rounded-lg px-4 py-3 text-sm bg-amber-50 text-amber-800 border border-amber-200 flex items-start gap-2">
          <span className="mt-0.5">⚠️</span>
          <span>Cadastro incompleto — a emissão de DSF requer todos os campos preenchidos.</span>
        </div>
      )}

      {msg && (
        <div className={`rounded-lg px-4 py-3 text-sm ${msg.tipo === 'ok' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {msg.texto}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        {/* Logotipo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Logotipo</label>
          <div className="flex items-center gap-4">
            <div className="w-32 h-16 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden">
              {form.logoUrl
                ? <img src={form.logoUrl} alt="logo" className="w-full h-full object-contain" />
                : <span className="text-xs text-gray-400">Sem logo</span>
              }
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
              >
                {form.logoUrl ? 'Trocar logo' : 'Enviar logo'}
              </button>
              {form.logoUrl && (
                <button
                  type="button"
                  onClick={() => set('logoUrl', null)}
                  className="px-3 py-1.5 rounded-lg border border-red-200 text-sm text-red-600 hover:bg-red-50"
                >
                  Remover
                </button>
              )}
              <p className="text-xs text-gray-400">PNG, JPG ou WebP — máx. 320×160px</p>
              {!form.logoUrl && (
                <p className="text-xs text-amber-600">Sem logo, o nome fantasia será exibido no lugar.</p>
              )}
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogo} />
        </div>

        <div className="border-t border-gray-100" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome Fantasia <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={form.nomeFantasia ?? ''}
              onChange={e => set('nomeFantasia', e.target.value)}
              className={inputClass('nomeFantasia')}
            />
            {erro('nomeFantasia') && <p className="text-xs text-red-500 mt-1">Campo obrigatório</p>}
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Razão Social <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={form.razaoSocial ?? ''}
              onChange={e => set('razaoSocial', e.target.value)}
              className={inputClass('razaoSocial')}
            />
            {erro('razaoSocial') && <p className="text-xs text-red-500 mt-1">Campo obrigatório</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={form.cnpj ? fmtCnpj(form.cnpj) : ''}
              onChange={e => set('cnpj', e.target.value.replace(/\D/g, ''))}
              placeholder="00.000.000/0000-00"
              maxLength={18}
              className={inputClass('cnpj')}
            />
            {erro('cnpj') && <p className="text-xs text-red-500 mt-1">Campo obrigatório</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefone <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={form.telefone ?? ''}
              onChange={e => set('telefone', e.target.value)}
              placeholder="(00) 00000-0000"
              className={inputClass('telefone')}
            />
            {erro('telefone') && <p className="text-xs text-red-500 mt-1">Campo obrigatório</p>}
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Endereço <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={form.endereco ?? ''}
              onChange={e => set('endereco', e.target.value)}
              placeholder="Rua, número, bairro, cidade — UF"
              className={inputClass('endereco')}
            />
            {erro('endereco') && <p className="text-xs text-red-500 mt-1">Campo obrigatório</p>}
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Alvará Sanitário <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={form.alvaraSanitario ?? ''}
              onChange={e => set('alvaraSanitario', e.target.value)}
              placeholder="Número do alvará"
              className={inputClass('alvaraSanitario')}
            />
            {erro('alvaraSanitario') && <p className="text-xs text-red-500 mt-1">Campo obrigatório</p>}
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

        <div className="pt-2 flex items-center gap-3">
          <button
            onClick={salvar}
            disabled={saving}
            className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </button>
          <span className="text-xs text-gray-400">Campos marcados com <span className="text-red-500">*</span> são obrigatórios para emissão de DSF</span>
        </div>
      </div>
    </div>
  )
}
