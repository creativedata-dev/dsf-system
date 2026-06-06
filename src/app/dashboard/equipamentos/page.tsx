'use client'

import { useEffect, useState, useCallback } from 'react'

interface Equipamento {
  id: string
  nome: string
  marcaModelo: string
  numeroSerie: string | null
  dataUltimaCalibracao: string
  dataProximaCalibracao: string
  status: string
  laudoUrl: string | null
  fotoUrl: string | null
  numeroCertificado: string | null
  laboratorio: string | null
  obs: string | null
  ativo: boolean
}

type Mode = 'lista' | 'novo' | 'editando' | 'salvando' | 'uploading'

const inp =
  'w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500 transition'

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  ATIVO:     { label: 'Em dia',         cls: 'bg-emerald-100 text-emerald-700' },
  VENCENDO:  { label: 'Vence em breve', cls: 'bg-amber-100 text-amber-700' },
  VENCIDO:   { label: 'Vencido',        cls: 'bg-red-100 text-red-700' },
  MANUTENCAO:{ label: 'Manutenção',     cls: 'bg-slate-100 text-slate-600' },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

function hoje() {
  return new Date().toISOString().slice(0, 10)
}

function calcStatus(dataProxima: string) {
  const proxima = new Date(dataProxima)
  const h = new Date()
  h.setHours(0, 0, 0, 0)
  const diff = Math.floor((proxima.getTime() - h.getTime()) / (1000 * 60 * 60 * 24))
  return diff < 0 ? 'VENCIDO' : diff <= 30 ? 'VENCENDO' : 'ATIVO'
}

const EMPTY_FORM = {
  nome: '',
  marcaModelo: '',
  numeroSerie: '',
  dataUltimaCalibracao: hoje(),
  dataProximaCalibracao: '',
  numeroCertificado: '',
  laboratorio: '',
  obs: '',
  status: 'ATIVO' as string,
}

export default function EquipamentosPage() {
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<Mode>('lista')
  const [editando, setEditando] = useState<Equipamento | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')
  const [laudoFile, setLaudoFile] = useState<File | null>(null)
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [filtroStatus, setFiltroStatus] = useState('')

  const carregar = useCallback(async () => {
    const res = await fetch('/api/equipamentos')
    if (res.ok) setEquipamentos(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  function abrirNovo() {
    setEditando(null)
    setForm(EMPTY_FORM)
    setLaudoFile(null)
    setFotoFile(null)
    setFotoPreview(null)
    setError('')
    setMode('novo')
  }

  function abrirEditar(eq: Equipamento) {
    setEditando(eq)
    setForm({
      nome: eq.nome,
      marcaModelo: eq.marcaModelo,
      numeroSerie: eq.numeroSerie ?? '',
      dataUltimaCalibracao: eq.dataUltimaCalibracao.slice(0, 10),
      dataProximaCalibracao: eq.dataProximaCalibracao.slice(0, 10),
      numeroCertificado: eq.numeroCertificado ?? '',
      laboratorio: eq.laboratorio ?? '',
      obs: eq.obs ?? '',
      status: eq.status,
    })
    setLaudoFile(null)
    setFotoFile(null)
    setFotoPreview(null)
    setError('')
    setMode('editando')
  }

  function cancelar() {
    setMode('lista')
    setEditando(null)
    setLaudoFile(null)
    setFotoFile(null)
    setFotoPreview(null)
    setError('')
  }

  function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFotoFile(file)
    setFotoPreview(URL.createObjectURL(file))
  }

  async function salvar() {
    if (!form.nome || !form.marcaModelo || !form.dataUltimaCalibracao || !form.dataProximaCalibracao) {
      setError('Preencha todos os campos obrigatórios')
      return
    }
    setError('')
    setMode('salvando')

    const isEdit = editando != null
    const url = isEdit ? `/api/equipamentos/${editando!.id}` : '/api/equipamentos'
    const method = isEdit ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: form.nome,
        marcaModelo: form.marcaModelo,
        numeroSerie: form.numeroSerie || null,
        dataUltimaCalibracao: form.dataUltimaCalibracao,
        dataProximaCalibracao: form.dataProximaCalibracao,
        numeroCertificado: form.numeroCertificado || null,
        laboratorio: form.laboratorio || null,
        obs: form.obs || null,
        ...(isEdit && { status: form.status }),
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      setError(err.error ?? 'Erro ao salvar')
      setMode(isEdit ? 'editando' : 'novo')
      return
    }

    const saved: Equipamento = await res.json()

    // Upload laudo PDF
    if (laudoFile) {
      setMode('uploading')
      const fd = new FormData()
      fd.append('laudo', laudoFile)
      const uploadRes = await fetch(`/api/equipamentos/${saved.id}/laudo`, { method: 'POST', body: fd })
      if (!uploadRes.ok) {
        const err = await uploadRes.json()
        setError(err.error ?? 'Erro ao enviar laudo (equipamento foi salvo)')
        setMode('lista')
        await carregar()
        return
      }
    }

    // Upload foto
    if (fotoFile) {
      setMode('uploading')
      const fd = new FormData()
      fd.append('foto', fotoFile)
      await fetch(`/api/equipamentos/${saved.id}/foto`, { method: 'POST', body: fd })
      // Ignora erro de foto — equipamento já foi salvo
    }

    setMode('lista')
    setEditando(null)
    setLaudoFile(null)
    setFotoFile(null)
    setFotoPreview(null)
    await carregar()
  }

  async function desativar(eq: Equipamento) {
    if (!confirm(`Desativar "${eq.nome}"?`)) return
    await fetch(`/api/equipamentos/${eq.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: false }),
    })
    await carregar()
  }

  const exibidos = filtroStatus
    ? equipamentos.filter(e => e.status === filtroStatus)
    : equipamentos

  const vencidos = equipamentos.filter(e => e.status === 'VENCIDO').length
  const vencendo = equipamentos.filter(e => e.status === 'VENCENDO').length

  const isFormMode = mode === 'novo' || mode === 'editando' || mode === 'salvando' || mode === 'uploading'
  const isSaving = mode === 'salvando' || mode === 'uploading'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        Carregando...
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Equipamentos e Calibração</h1>
          <p className="text-sm text-slate-500 mt-0.5">Controle de calibrações e laudos</p>
        </div>
        {!isFormMode && (
          <button
            onClick={abrirNovo}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition"
          >
            + Cadastrar equipamento
          </button>
        )}
      </div>

      {/* Alertas de vencimento */}
      {(vencidos > 0 || vencendo > 0) && !isFormMode && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1">
          {vencidos > 0 && (
            <p className="text-sm font-medium text-red-800">
              ⚠️ {vencidos} equipamento{vencidos > 1 ? 's' : ''} com calibração vencida
            </p>
          )}
          {vencendo > 0 && (
            <p className="text-sm text-amber-700">
              🔔 {vencendo} equipamento{vencendo > 1 ? 's' : ''} com calibração vencendo em até 30 dias
            </p>
          )}
        </div>
      )}

      {/* Formulário */}
      {isFormMode && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-5">
          <h2 className="text-base font-semibold text-slate-900">
            {editando ? 'Editar equipamento' : 'Novo equipamento'}
          </h2>

          {/* Dados do equipamento */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nome *</label>
              <input type="text" className={inp} placeholder="Ex: Termômetro digital"
                value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} disabled={isSaving} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Marca / Modelo *</label>
              <input type="text" className={inp} placeholder="Ex: Incoterm 7664"
                value={form.marcaModelo} onChange={e => setForm(f => ({ ...f, marcaModelo: e.target.value }))} disabled={isSaving} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Número de série</label>
              <input type="text" className={inp} placeholder="Opcional"
                value={form.numeroSerie} onChange={e => setForm(f => ({ ...f, numeroSerie: e.target.value }))} disabled={isSaving} />
            </div>
            {editando && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                <select className={inp} value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value }))} disabled={isSaving}>
                  <option value="ATIVO">Em dia</option>
                  <option value="VENCENDO">Vence em breve</option>
                  <option value="VENCIDO">Vencido</option>
                  <option value="MANUTENCAO">Em manutenção</option>
                </select>
              </div>
            )}
          </div>

          {/* Datas de calibração */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Última calibração *</label>
              <input type="date" className={inp} value={form.dataUltimaCalibracao}
                onChange={e => setForm(f => ({ ...f, dataUltimaCalibracao: e.target.value }))} disabled={isSaving} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Próxima calibração *</label>
              <input type="date" className={inp} value={form.dataProximaCalibracao}
                onChange={e => setForm(f => ({
                  ...f,
                  dataProximaCalibracao: e.target.value,
                  status: calcStatus(e.target.value),
                }))} disabled={isSaving} />
              {form.dataProximaCalibracao && (
                <p className={`text-xs mt-1 font-medium ${
                  form.status === 'VENCIDO' ? 'text-red-600' :
                  form.status === 'VENCENDO' ? 'text-amber-600' : 'text-emerald-600'
                }`}>
                  {STATUS_CONFIG[form.status]?.label ?? form.status}
                </p>
              )}
            </div>
          </div>

          {/* Dados do certificado */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nº do certificado</label>
              <input type="text" className={inp} placeholder="Ex: CAL-2024-00123"
                value={form.numeroCertificado} onChange={e => setForm(f => ({ ...f, numeroCertificado: e.target.value }))} disabled={isSaving} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Laboratório responsável</label>
              <input type="text" className={inp} placeholder="Ex: Lab Metrologia SP"
                value={form.laboratorio} onChange={e => setForm(f => ({ ...f, laboratorio: e.target.value }))} disabled={isSaving} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Observações</label>
            <input type="text" className={inp} placeholder="Opcional"
              value={form.obs} onChange={e => setForm(f => ({ ...f, obs: e.target.value }))} disabled={isSaving} />
          </div>

          {/* Uploads lado a lado */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Certificado PDF */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Certificado de calibração (PDF)
              </label>
              {laudoFile ? (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                  <svg className="w-4 h-4 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  <span className="text-xs text-blue-700 flex-1 truncate">{laudoFile.name}</span>
                  <button onClick={() => setLaudoFile(null)} disabled={isSaving}
                    className="text-blue-400 hover:text-red-500 text-xs font-bold">✕</button>
                </div>
              ) : (
                <label className="flex items-center gap-2 px-3 py-2.5 border border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition">
                  <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  <span className="text-xs text-slate-500">Selecionar PDF</span>
                  <input type="file" accept="application/pdf" className="hidden"
                    onChange={e => setLaudoFile(e.target.files?.[0] ?? null)} disabled={isSaving} />
                </label>
              )}
            </div>

            {/* Foto do equipamento */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Foto do equipamento / lacre
              </label>
              {fotoPreview ? (
                <div className="relative">
                  <img src={fotoPreview} alt="Foto" className="w-full h-24 object-cover rounded-lg border border-slate-200" />
                  <button onClick={() => { setFotoFile(null); setFotoPreview(null) }} disabled={isSaving}
                    className="absolute top-1 right-1 w-5 h-5 bg-white rounded-full shadow text-slate-500 hover:text-red-600 flex items-center justify-center text-xs font-bold">
                    ✕
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-2 px-3 py-2.5 border border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition">
                  <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                  </svg>
                  <span className="text-xs text-slate-500">Tirar foto ou escolher</span>
                  <input type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={handleFotoChange} disabled={isSaving} />
                </label>
              )}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button onClick={cancelar} disabled={isSaving}
              className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition">
              Cancelar
            </button>
            <button onClick={salvar} disabled={isSaving}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition">
              {mode === 'uploading' ? 'Enviando arquivos...' : mode === 'salvando' ? 'Salvando...' : '✓ Salvar'}
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      {mode === 'lista' && (
        <>
          {equipamentos.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {(['', 'VENCIDO', 'VENCENDO', 'MANUTENCAO', 'ATIVO'] as const).map(s => (
                <button key={s} onClick={() => setFiltroStatus(s)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                    filtroStatus === s ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}>
                  {s === '' ? 'Todos' : STATUS_CONFIG[s]?.label ?? s}
                  {s !== '' && (
                    <span className="ml-1 opacity-70">({equipamentos.filter(e => e.status === s).length})</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {exibidos.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
              <p className="text-slate-500 text-sm mb-3">
                {equipamentos.length === 0 ? 'Nenhum equipamento cadastrado.' : 'Nenhum equipamento neste filtro.'}
              </p>
              {equipamentos.length === 0 && (
                <button onClick={abrirNovo} className="text-sm text-blue-600 font-medium hover:underline">
                  Cadastrar primeiro equipamento →
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {exibidos.map(eq => {
                const cfg = STATUS_CONFIG[eq.status] ?? { label: eq.status, cls: 'bg-slate-100 text-slate-600' }
                return (
                  <div key={eq.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition">
                    <div className="flex items-start gap-3">

                      {/* Foto thumbnail */}
                      {eq.fotoUrl && (
                        <a href={eq.fotoUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                          <div className="w-14 h-14 rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                            <img src={eq.fotoUrl.replace('/view', '/preview')} alt={eq.nome}
                              className="w-full h-full object-cover" />
                          </div>
                        </a>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-slate-900">{eq.nome}</p>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
                            {cfg.label}
                          </span>
                        </div>
                        <p className="text-sm text-slate-500 mt-0.5">{eq.marcaModelo}</p>

                        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
                          {eq.numeroSerie && <span>Série: {eq.numeroSerie}</span>}
                          {eq.numeroCertificado && <span>Cert.: {eq.numeroCertificado}</span>}
                          {eq.laboratorio && <span>Lab: {eq.laboratorio}</span>}
                        </div>

                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
                          <span>Última calibração: {formatDate(eq.dataUltimaCalibracao)}</span>
                          <span className={
                            eq.status === 'VENCIDO' ? 'text-red-600 font-medium' :
                            eq.status === 'VENCENDO' ? 'text-amber-600 font-medium' : ''
                          }>
                            Próxima: {formatDate(eq.dataProximaCalibracao)}
                          </span>
                        </div>

                        {eq.obs && <p className="text-xs text-slate-400 mt-1 italic">{eq.obs}</p>}
                      </div>

                      {/* Ações */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {eq.laudoUrl && (
                          <a href={eq.laudoUrl} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 hover:bg-blue-100 text-slate-500 hover:text-blue-600 transition"
                            title="Ver certificado de calibração">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                            </svg>
                          </a>
                        )}
                        <button onClick={() => abrirEditar(eq)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 hover:bg-blue-100 text-slate-500 hover:text-blue-600 transition"
                          title="Editar">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                          </svg>
                        </button>
                        <button onClick={() => desativar(eq)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 hover:bg-red-100 text-slate-400 hover:text-red-500 transition"
                          title="Desativar">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
