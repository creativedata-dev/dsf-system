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

interface HistoricoItem {
  id: string
  dataCalib: string
  dataProxima: string
  numeroCertificado: string | null
  laboratorio: string | null
  laudoUrl: string | null
  obs: string | null
  nomeUsuario: string
  createdAt: string
}

type Mode = 'lista' | 'novo' | 'editando' | 'salvando' | 'uploading'
type HistMode = 'idle' | 'loading' | 'open' | 'nova_calib' | 'salvando_calib'

const inp =
  'w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500 transition'

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  ATIVO:      { label: 'Em dia',         cls: 'bg-emerald-100 text-emerald-700' },
  VENCENDO:   { label: 'Vence em breve', cls: 'bg-amber-100 text-amber-700' },
  VENCIDO:    { label: 'Vencido',        cls: 'bg-red-100 text-red-700' },
  MANUTENCAO: { label: 'Manutenção',     cls: 'bg-slate-100 text-slate-600' },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

function hoje() {
  return new Date().toISOString().slice(0, 10)
}

function calcStatus(dataProxima: string) {
  const proxima = new Date(dataProxima)
  const h = new Date(); h.setHours(0, 0, 0, 0)
  const diff = Math.floor((proxima.getTime() - h.getTime()) / (1000 * 60 * 60 * 24))
  return diff < 0 ? 'VENCIDO' : diff <= 30 ? 'VENCENDO' : 'ATIVO'
}

const EMPTY_FORM = {
  nome: '', marcaModelo: '', numeroSerie: '',
  dataUltimaCalibracao: hoje(), dataProximaCalibracao: '',
  numeroCertificado: '', laboratorio: '', obs: '', status: 'ATIVO' as string,
}

const EMPTY_CALIB = {
  dataCalib: hoje(), dataProxima: '',
  numeroCertificado: '', laboratorio: '', obs: '',
}

function driveThumb(url: string): string {
  const id = url.match(/\/d\/([^/]+)/)?.[1]
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w200` : url
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

  // Histórico por equipamento
  const [histEquipId, setHistEquipId] = useState<string | null>(null)
  const [histMode, setHistMode] = useState<HistMode>('idle')
  const [historico, setHistorico] = useState<HistoricoItem[]>([])
  const [calibForm, setCalibForm] = useState(EMPTY_CALIB)
  const [calibLaudoFile, setCalibLaudoFile] = useState<File | null>(null)
  const [calibError, setCalibError] = useState('')

  const carregar = useCallback(async () => {
    const res = await fetch('/api/equipamentos')
    if (res.ok) setEquipamentos(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function abrirHistorico(eq: Equipamento) {
    if (histEquipId === eq.id && histMode === 'open') {
      setHistEquipId(null); setHistMode('idle'); return
    }
    setHistEquipId(eq.id)
    setHistMode('loading')
    const res = await fetch(`/api/equipamentos/${eq.id}/historico`)
    if (res.ok) setHistorico(await res.json())
    setHistMode('open')
  }

  function abrirNovaCalib(eq: Equipamento) {
    setHistEquipId(eq.id)
    setCalibForm({
      dataCalib: hoje(),
      dataProxima: '',
      numeroCertificado: eq.numeroCertificado ?? '',
      laboratorio: eq.laboratorio ?? '',
      obs: '',
    })
    setCalibLaudoFile(null)
    setCalibError('')
    setHistMode('nova_calib')
  }

  async function salvarCalib() {
    if (!calibForm.dataCalib || !calibForm.dataProxima) {
      setCalibError('Preencha data da calibração e data da próxima'); return
    }
    setCalibError('')
    setHistMode('salvando_calib')
    const fd = new FormData()
    fd.append('dataCalib', calibForm.dataCalib)
    fd.append('dataProxima', calibForm.dataProxima)
    if (calibForm.numeroCertificado) fd.append('numeroCertificado', calibForm.numeroCertificado)
    if (calibForm.laboratorio)       fd.append('laboratorio', calibForm.laboratorio)
    if (calibForm.obs)               fd.append('obs', calibForm.obs)
    if (calibLaudoFile)              fd.append('laudo', calibLaudoFile)

    const res = await fetch(`/api/equipamentos/${histEquipId}/historico`, { method: 'POST', body: fd })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      setCalibError(err.error ?? `Erro ao salvar (${res.status})`)
      setHistMode('nova_calib')
      return
    }
    await carregar()
    // Recarrega histórico
    const hRes = await fetch(`/api/equipamentos/${histEquipId}/historico`)
    if (hRes.ok) setHistorico(await hRes.json())
    setHistMode('open')
  }

  function abrirNovo() {
    setEditando(null); setForm(EMPTY_FORM); setLaudoFile(null)
    setFotoFile(null); setFotoPreview(null); setError(''); setMode('novo')
  }

  function abrirEditar(eq: Equipamento) {
    setEditando(eq)
    setForm({
      nome: eq.nome, marcaModelo: eq.marcaModelo, numeroSerie: eq.numeroSerie ?? '',
      dataUltimaCalibracao: eq.dataUltimaCalibracao.slice(0, 10),
      dataProximaCalibracao: eq.dataProximaCalibracao.slice(0, 10),
      numeroCertificado: eq.numeroCertificado ?? '', laboratorio: eq.laboratorio ?? '',
      obs: eq.obs ?? '', status: eq.status,
    })
    setLaudoFile(null); setFotoFile(null); setFotoPreview(null); setError(''); setMode('editando')
  }

  function cancelar() {
    setMode('lista'); setEditando(null); setLaudoFile(null)
    setFotoFile(null); setFotoPreview(null); setError('')
  }

  function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setFotoFile(file); setFotoPreview(URL.createObjectURL(file))
  }

  async function salvar() {
    if (!form.nome || !form.marcaModelo || !form.dataUltimaCalibracao || !form.dataProximaCalibracao) {
      setError('Preencha todos os campos obrigatórios'); return
    }
    setError(''); setMode('salvando')
    const isEdit = editando != null
    const res = await fetch(isEdit ? `/api/equipamentos/${editando!.id}` : '/api/equipamentos', {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: form.nome, marcaModelo: form.marcaModelo, numeroSerie: form.numeroSerie || null,
        dataUltimaCalibracao: form.dataUltimaCalibracao, dataProximaCalibracao: form.dataProximaCalibracao,
        numeroCertificado: form.numeroCertificado || null, laboratorio: form.laboratorio || null,
        obs: form.obs || null, ...(isEdit && { status: form.status }),
      }),
    })
    if (!res.ok) {
      const err = await res.json(); setError(err.error ?? 'Erro ao salvar')
      setMode(isEdit ? 'editando' : 'novo'); return
    }
    const saved: Equipamento = await res.json()
    if (laudoFile) {
      setMode('uploading')
      const fd = new FormData(); fd.append('laudo', laudoFile)
      const uploadRes = await fetch(`/api/equipamentos/${saved.id}/laudo`, { method: 'POST', body: fd })
      if (!uploadRes.ok) {
        const err = await uploadRes.json()
        setError(err.error ?? 'Erro ao enviar laudo (equipamento foi salvo)')
        setMode('lista'); await carregar(); return
      }
    }
    if (fotoFile) {
      setMode('uploading')
      const fd = new FormData(); fd.append('foto', fotoFile)
      await fetch(`/api/equipamentos/${saved.id}/foto`, { method: 'POST', body: fd })
    }
    setMode('lista'); setEditando(null); setLaudoFile(null)
    setFotoFile(null); setFotoPreview(null); await carregar()
  }

  async function desativar(eq: Equipamento) {
    if (!confirm(`Desativar "${eq.nome}"?`)) return
    await fetch(`/api/equipamentos/${eq.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: false }),
    })
    await carregar()
  }

  const exibidos = filtroStatus ? equipamentos.filter(e => e.status === filtroStatus) : equipamentos
  const vencidos = equipamentos.filter(e => e.status === 'VENCIDO').length
  const vencendo = equipamentos.filter(e => e.status === 'VENCENDO').length
  const isFormMode = ['novo','editando','salvando','uploading'].includes(mode)
  const isSaving = mode === 'salvando' || mode === 'uploading'

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Carregando...</div>
  )

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Equipamentos</h1>
          <p className="text-sm text-slate-500 mt-0.5">Acompanhe os laudos de calibração e receba alertas antes do vencimento</p>
        </div>
        {!isFormMode && (
          <button onClick={abrirNovo}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition">
            + Cadastrar equipamento
          </button>
        )}
      </div>

      {(vencidos > 0 || vencendo > 0) && !isFormMode && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1">
          {vencidos > 0 && <p className="text-sm font-medium text-red-800">⚠️ {vencidos} equipamento{vencidos > 1 ? 's' : ''} com calibração vencida</p>}
          {vencendo > 0 && <p className="text-sm text-amber-700">🔔 {vencendo} equipamento{vencendo > 1 ? 's' : ''} com calibração vencendo em até 30 dias</p>}
        </div>
      )}

      {/* Formulário cadastro/edição */}
      {isFormMode && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-5">
          <h2 className="text-base font-semibold text-slate-900">{editando ? 'Editar equipamento' : 'Novo equipamento'}</h2>

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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Última calibração *</label>
              <input type="date" className={inp} value={form.dataUltimaCalibracao}
                onChange={e => setForm(f => ({ ...f, dataUltimaCalibracao: e.target.value }))} disabled={isSaving} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Próxima calibração *</label>
              <input type="date" className={inp} value={form.dataProximaCalibracao}
                onChange={e => setForm(f => ({ ...f, dataProximaCalibracao: e.target.value, status: calcStatus(e.target.value) }))} disabled={isSaving} />
              {form.dataProximaCalibracao && (
                <p className={`text-xs mt-1 font-medium ${form.status === 'VENCIDO' ? 'text-red-600' : form.status === 'VENCENDO' ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {STATUS_CONFIG[form.status]?.label ?? form.status}
                </p>
              )}
            </div>
          </div>

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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Certificado de calibração (PDF)</label>
              {laudoFile ? (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                  <svg className="w-4 h-4 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                  <span className="text-xs text-blue-700 flex-1 truncate">{laudoFile.name}</span>
                  <button onClick={() => setLaudoFile(null)} disabled={isSaving} className="text-blue-400 hover:text-red-500 text-xs font-bold">✕</button>
                </div>
              ) : (
                <label className="flex items-center gap-2 px-3 py-2.5 border border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition">
                  <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                  <span className="text-xs text-slate-500">Selecionar PDF</span>
                  <input type="file" accept="application/pdf" className="hidden" onChange={e => setLaudoFile(e.target.files?.[0] ?? null)} disabled={isSaving} />
                </label>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Foto do equipamento / lacre</label>
              {fotoPreview ? (
                <div className="relative">
                  <img src={fotoPreview} alt="Foto" className="w-full h-24 object-cover rounded-lg border border-slate-200" />
                  <button onClick={() => { setFotoFile(null); setFotoPreview(null) }} disabled={isSaving}
                    className="absolute top-1 right-1 w-5 h-5 bg-white rounded-full shadow text-slate-500 hover:text-red-600 flex items-center justify-center text-xs font-bold">✕</button>
                </div>
              ) : (
                <label className="flex items-center gap-2 px-3 py-2.5 border border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition">
                  <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" /></svg>
                  <span className="text-xs text-slate-500">Tirar foto ou escolher</span>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFotoChange} disabled={isSaving} />
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
                  className={`px-3 py-1 rounded-full text-xs font-medium transition ${filtroStatus === s ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {s === '' ? 'Todos' : STATUS_CONFIG[s]?.label ?? s}
                  {s !== '' && <span className="ml-1 opacity-70">({equipamentos.filter(e => e.status === s).length})</span>}
                </button>
              ))}
            </div>
          )}

          {exibidos.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
              <p className="text-slate-500 text-sm mb-3">{equipamentos.length === 0 ? 'Nenhum equipamento cadastrado.' : 'Nenhum equipamento neste filtro.'}</p>
              {equipamentos.length === 0 && <button onClick={abrirNovo} className="text-sm text-blue-600 font-medium hover:underline">Cadastrar primeiro equipamento →</button>}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {exibidos.map(eq => {
                const cfg = STATUS_CONFIG[eq.status] ?? { label: eq.status, cls: 'bg-slate-100 text-slate-600' }
                const isHistOpen = histEquipId === eq.id && (histMode === 'open' || histMode === 'loading' || histMode === 'nova_calib' || histMode === 'salvando_calib')

                return (
                  <div key={eq.id} className={`bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 transition ${isHistOpen ? 'md:col-span-2' : ''}`}>
                    {/* Linha principal */}
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        {eq.fotoUrl && (
                          <a href={eq.fotoUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                            <div className="w-14 h-14 rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                              <img src={driveThumb(eq.fotoUrl)} alt={eq.nome}
                                className="w-full h-full object-cover"
                                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                            </div>
                          </a>
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-slate-900">{eq.nome}</p>
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>{cfg.label}</span>
                          </div>
                          <p className="text-sm text-slate-500 mt-0.5">{eq.marcaModelo}</p>
                          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
                            {eq.numeroSerie && <span>Série: {eq.numeroSerie}</span>}
                            {eq.numeroCertificado && <span>Cert.: {eq.numeroCertificado}</span>}
                            {eq.laboratorio && <span>Lab: {eq.laboratorio}</span>}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
                            <span>Última calibração: {formatDate(eq.dataUltimaCalibracao)}</span>
                            <span className={eq.status === 'VENCIDO' ? 'text-red-600 font-medium' : eq.status === 'VENCENDO' ? 'text-amber-600 font-medium' : ''}>
                              Próxima: {formatDate(eq.dataProximaCalibracao)}
                            </span>
                          </div>
                          {eq.obs && <p className="text-xs text-slate-400 mt-1 italic">{eq.obs}</p>}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {eq.laudoUrl && (
                            <a href={eq.laudoUrl} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 hover:bg-blue-100 text-slate-500 hover:text-blue-600 transition" title="Ver certificado">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                            </a>
                          )}
                          <button onClick={() => abrirHistorico(eq)}
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition ${isHistOpen ? 'bg-blue-600 text-white' : 'bg-slate-100 hover:bg-blue-100 text-slate-500 hover:text-blue-600'}`}
                            title="Histórico de calibrações">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          </button>
                          <button onClick={() => abrirEditar(eq)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 hover:bg-blue-100 text-slate-500 hover:text-blue-600 transition" title="Editar">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                          </button>
                          <button onClick={() => desativar(eq)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 hover:bg-red-100 text-slate-400 hover:text-red-500 transition" title="Desativar">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Painel histórico expandido */}
                    {isHistOpen && (
                      <div className="border-t border-slate-100 bg-slate-50">

                        {/* Formulário nova calibração */}
                        {(histMode === 'nova_calib' || histMode === 'salvando_calib') && histEquipId === eq.id && (
                          <div className="px-5 py-4 border-b border-slate-200 bg-white space-y-4">
                            <p className="text-sm font-semibold text-slate-800">Registrar nova calibração</p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Data da calibração *</label>
                                <input type="date" className={inp} value={calibForm.dataCalib}
                                  onChange={e => setCalibForm(f => ({ ...f, dataCalib: e.target.value }))} disabled={histMode === 'salvando_calib'} />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Data da próxima *</label>
                                <input type="date" className={inp} value={calibForm.dataProxima}
                                  onChange={e => setCalibForm(f => ({ ...f, dataProxima: e.target.value }))} disabled={histMode === 'salvando_calib'} />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Nº do certificado</label>
                                <input type="text" className={inp} placeholder="Opcional" value={calibForm.numeroCertificado}
                                  onChange={e => setCalibForm(f => ({ ...f, numeroCertificado: e.target.value }))} disabled={histMode === 'salvando_calib'} />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Laboratório</label>
                                <input type="text" className={inp} placeholder="Opcional" value={calibForm.laboratorio}
                                  onChange={e => setCalibForm(f => ({ ...f, laboratorio: e.target.value }))} disabled={histMode === 'salvando_calib'} />
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">Observações</label>
                              <input type="text" className={inp} placeholder="Opcional" value={calibForm.obs}
                                onChange={e => setCalibForm(f => ({ ...f, obs: e.target.value }))} disabled={histMode === 'salvando_calib'} />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">Certificado PDF (opcional)</label>
                              {calibLaudoFile ? (
                                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                                  <svg className="w-4 h-4 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                                  <span className="text-xs text-blue-700 flex-1 truncate">{calibLaudoFile.name}</span>
                                  <button onClick={() => setCalibLaudoFile(null)} className="text-blue-400 hover:text-red-500 text-xs font-bold">✕</button>
                                </div>
                              ) : (
                                <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition">
                                  <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                                  <span className="text-xs text-slate-500">Selecionar PDF</span>
                                  <input type="file" accept="application/pdf" className="hidden" onChange={e => setCalibLaudoFile(e.target.files?.[0] ?? null)} disabled={histMode === 'salvando_calib'} />
                                </label>
                              )}
                            </div>

                            {calibError && <p className="text-sm text-red-600">{calibError}</p>}

                            <div className="flex gap-3">
                              <button onClick={() => setHistMode('open')} disabled={histMode === 'salvando_calib'}
                                className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition disabled:opacity-50">
                                Cancelar
                              </button>
                              <button onClick={salvarCalib} disabled={histMode === 'salvando_calib'}
                                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition">
                                {histMode === 'salvando_calib' ? 'Salvando...' : '✓ Confirmar calibração'}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Lista de histórico */}
                        {(histMode === 'open' || histMode === 'loading') && histEquipId === eq.id && (
                          <div>
                            <div className="flex items-center justify-between px-5 py-3">
                              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Histórico de calibrações</p>
                              <button onClick={() => abrirNovaCalib(eq)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                                Nova calibração
                              </button>
                            </div>

                            {histMode === 'loading' ? (
                              <div className="px-5 pb-4 text-xs text-slate-400">Carregando...</div>
                            ) : historico.length === 0 ? (
                              <div className="px-5 pb-5 text-center">
                                <p className="text-sm text-slate-400">Nenhuma calibração registrada.</p>
                                <p className="text-xs text-slate-400 mt-0.5">Registre a calibração atual para iniciar o histórico.</p>
                              </div>
                            ) : (
                              <div className="relative px-5 pb-4">
                                {/* Linha vertical da timeline */}
                                <div className="absolute left-8 top-0 bottom-4 w-px bg-slate-200" />
                                <div className="space-y-4">
                                  {historico.map((h, i) => (
                                    <div key={h.id} className="flex gap-4 relative">
                                      {/* Dot */}
                                      <div className={`relative z-10 w-4 h-4 rounded-full border-2 border-white mt-0.5 shrink-0 ${i === 0 ? 'bg-blue-500' : 'bg-slate-300'}`} />
                                      <div className="flex-1 min-w-0 pb-1">
                                        <div className="flex items-start justify-between gap-2">
                                          <div>
                                            <p className="text-sm font-semibold text-slate-800">
                                              {formatDate(h.dataCalib)}
                                              {i === 0 && <span className="ml-2 text-[10px] font-medium bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">Atual</span>}
                                            </p>
                                            <p className="text-xs text-slate-500 mt-0.5">
                                              Próxima: {formatDate(h.dataProxima)}
                                            </p>
                                            {h.numeroCertificado && <p className="text-xs text-slate-500">Cert.: {h.numeroCertificado}</p>}
                                            {h.laboratorio && <p className="text-xs text-slate-500">Lab: {h.laboratorio}</p>}
                                            {h.obs && <p className="text-xs text-slate-400 italic mt-0.5">{h.obs}</p>}
                                            <p className="text-[11px] text-slate-400 mt-1">por {h.nomeUsuario}</p>
                                          </div>
                                          {h.laudoUrl && (
                                            <a href={h.laudoUrl} target="_blank" rel="noopener noreferrer"
                                              className="shrink-0 flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition">
                                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                                              PDF
                                            </a>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
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
