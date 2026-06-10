'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { TIPO_SERVICO_OPTIONS } from '@/lib/tipo-servico'

/* ─── Types ──────────────────────────────────────────────────────────────────── */

interface DsfItem {
  id: string
  numeroDsf: string
  tipoServico: string
  tipoServicoLabel: string
  dataEmissao: string
  status: 'EMITIDA' | 'CONCLUIDA' | 'CANCELADA'
  driveFileId: string | null
  observacoes: string | null
  clienteNome: string
  clienteCpf: string
  rtNome: string
  rtCrf: string | null
  atendenteNome: string
}

interface ListResponse {
  total: number
  page: number
  pageSize: number
  totalPages: number
  dsfs: DsfItem[]
}

interface Filters {
  dateFrom: string
  dateTo: string
  status: string
  tipoServico: string
}

interface ReceiptDsf {
  id: string
  numeroDsf: string
  dataEmissao: string
  status: string
  drogariaNome: string
  drogariaCnpj: string
  drogariaTelefone: string
  drogariaLogoUrl: string | null
  tipoImpressao: string
  rtNome: string
  rtCrf: string | null
  clienteNome: string
  clienteCpf: string
  clienteDataNasc: string
  clienteTelefone: string
  tipoServico: string
  tipoServicoLabel: string
  textoOrientacao: string | null
  observacoes: string | null
  insumos: { nomeProduto: string; lote: string; fabricante: string; validade: string }[]
}

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  })
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })
}

function fmtCpf(cpf: string) {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

const STATUS_LABELS: Record<string, string> = {
  EMITIDA: 'Emitida',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
}

const STATUS_COLORS: Record<string, string> = {
  EMITIDA: 'bg-amber-100 text-amber-700',
  CONCLUIDA: 'bg-green-100 text-green-700',
  CANCELADA: 'bg-red-100 text-red-700',
}

/* ─── Component ──────────────────────────────────────────────────────────────── */

export function AnvisaClient({ canCancel, canUpload }: { canCancel: boolean; canUpload: boolean }) {
  const [filters, setFilters] = useState<Filters>({ dateFrom: '', dateTo: '', status: '', tipoServico: '' })
  const [appliedFilters, setAppliedFilters] = useState<Filters>(filters)
  const [page, setPage] = useState(1)
  const [data, setData] = useState<ListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [cancelTarget, setCancelTarget] = useState<DsfItem | null>(null)
  const [cancelMotivo, setCancelMotivo] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')

  // Reprint
  const [reprintTarget, setReprintTarget] = useState<DsfItem | null>(null)
  const [reprintData, setReprintData] = useState<ReceiptDsf | null>(null)
  const [reprintLoading, setReprintLoading] = useState(false)
  const [reprintError, setReprintError] = useState('')

  // Reenviar foto
  const [uploadTarget, setUploadTarget] = useState<DsfItem | null>(null)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchDsfs = useCallback(async (f: Filters, p: number) => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page: String(p) })
      if (f.dateFrom) params.set('dateFrom', f.dateFrom)
      if (f.dateTo) params.set('dateTo', f.dateTo)
      if (f.status) params.set('status', f.status)
      if (f.tipoServico) params.set('tipoServico', f.tipoServico)

      const res = await fetch(`/api/dsf/list?${params}`)
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        setError(e.error ?? 'Erro ao buscar dados')
        return
      }
      setData(await res.json())
    } catch {
      setError('Falha de conexão')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDsfs(appliedFilters, page)
  }, [appliedFilters, page, fetchDsfs])

  function applyFilters() {
    setPage(1)
    setAppliedFilters({ ...filters })
  }

  function clearFilters() {
    const empty: Filters = { dateFrom: '', dateTo: '', status: '', tipoServico: '' }
    setFilters(empty)
    setAppliedFilters(empty)
    setPage(1)
  }

  function exportCsv() {
    const params = new URLSearchParams({ format: 'csv' })
    if (appliedFilters.dateFrom) params.set('dateFrom', appliedFilters.dateFrom)
    if (appliedFilters.dateTo) params.set('dateTo', appliedFilters.dateTo)
    if (appliedFilters.status) params.set('status', appliedFilters.status)
    if (appliedFilters.tipoServico) params.set('tipoServico', appliedFilters.tipoServico)
    window.open(`/api/dsf/list?${params}`, '_blank')
  }

  function openDriveFile(fileId: string) {
    window.open(`https://drive.google.com/file/d/${fileId}/view`, '_blank')
  }

  function openCancelModal(dsf: DsfItem) {
    setCancelTarget(dsf)
    setCancelMotivo('')
    setCancelError('')
  }

  function closeCancelModal() {
    if (cancelling) return
    setCancelTarget(null)
    setCancelMotivo('')
    setCancelError('')
  }

  async function confirmCancel() {
    if (!cancelTarget) return
    setCancelling(true)
    setCancelError('')
    try {
      const res = await fetch('/api/dsf/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dsfId: cancelTarget.id, motivo: cancelMotivo.trim() || undefined }),
      })
      const json = await res.json()
      if (!res.ok) {
        setCancelError(json.error ?? 'Erro ao cancelar')
        return
      }
      setCancelTarget(null)
      fetchDsfs(appliedFilters, page)
    } catch {
      setCancelError('Falha de conexão')
    } finally {
      setCancelling(false)
    }
  }

  /* ── Reimprimir ─────────────────────────────────────────────────────────────── */

  async function openReprint(dsf: DsfItem) {
    setReprintTarget(dsf)
    setReprintData(null)
    setReprintError('')
    setReprintLoading(true)
    try {
      const res = await fetch(`/api/dsf/${dsf.id}`)
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        setReprintError(e.error ?? 'Erro ao carregar DSF')
        return
      }
      setReprintData(await res.json())
    } catch {
      setReprintError('Falha de conexão')
    } finally {
      setReprintLoading(false)
    }
  }

  function closeReprint() {
    setReprintTarget(null)
    setReprintData(null)
    setReprintError('')
  }

  /* ── Reenviar foto ──────────────────────────────────────────────────────────── */

  function openUpload(dsf: DsfItem) {
    setUploadTarget(dsf)
    setCapturedImage(null)
    setUploadError('')
    setUploadSuccess(false)
  }

  function closeUpload() {
    if (uploading) return
    setUploadTarget(null)
    setCapturedImage(null)
    setUploadError('')
    setUploadSuccess(false)
  }

  function handleFileSelect(file: File) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      setCapturedImage(result)
      setUploadError('')
    }
    reader.readAsDataURL(file)
  }

  async function handleUpload() {
    if (!uploadTarget || !capturedImage) return
    setUploading(true)
    setUploadError('')
    try {
      const res = await fetch('/api/dsf/upload-signed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dsfId: uploadTarget.id, fileBase64: capturedImage }),
      })
      const json = await res.json()
      if (!res.ok) {
        setUploadError(json.error ?? 'Erro ao enviar arquivo')
        return
      }
      setUploadSuccess(true)
      fetchDsfs(appliedFilters, page)
    } catch {
      setUploadError('Falha de conexão')
    } finally {
      setUploading(false)
    }
  }

  const hasActiveFilters = Object.values(appliedFilters).some(Boolean)

  return (
    <div className="p-4 sm:p-8">
      {/* ── Header ── */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Histórico e Fiscalização ANVISA</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Declarações emitidas pelo tenant — RDC 44/2009
        </p>
      </div>

      {/* ── Filters ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Data inicial</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Data final</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Todos</option>
              <option value="EMITIDA">Emitida</option>
              <option value="CONCLUIDA">Concluída</option>
              <option value="CANCELADA">Cancelada</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de Serviço</label>
            <select
              value={filters.tipoServico}
              onChange={(e) => setFilters((f) => ({ ...f, tipoServico: e.target.value }))}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Todos</option>
              {TIPO_SERVICO_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={applyFilters}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Filtrar
          </button>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Limpar
            </button>
          )}
          <div className="ml-auto">
            <button
              onClick={exportCsv}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Exportar CSV
            </button>
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {error && (
          <div className="px-6 py-4 bg-red-50 border-b border-red-100 text-sm text-red-700">{error}</div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="ml-3 text-sm text-slate-500">Carregando...</span>
          </div>
        ) : data && data.dsfs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <svg className="w-10 h-10 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm font-medium text-slate-500">Nenhuma DSF encontrada</p>
            {hasActiveFilters && (
              <p className="text-xs text-slate-400 mt-1">Tente ajustar os filtros</p>
            )}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Nº DSF</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Data</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo de Serviço</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">RT</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data?.dsfs.map((dsf) => (
                    <tr key={dsf.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">{dsf.numeroDsf}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fmtDateTime(dsf.dataEmissao)}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{dsf.clienteNome}</p>
                        <p className="text-xs text-slate-400">{fmtCpf(dsf.clienteCpf)}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{dsf.tipoServicoLabel}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[dsf.status]}`}>
                          {STATUS_LABELS[dsf.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-slate-700">{dsf.rtNome}</p>
                        {dsf.rtCrf && <p className="text-xs text-blue-600">{dsf.rtCrf}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 justify-end flex-wrap">
                          {dsf.driveFileId && (
                            <button
                              onClick={() => openDriveFile(dsf.driveFileId!)}
                              title="Ver PDF no Google Drive"
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              PDF
                            </button>
                          )}
                          {dsf.status !== 'CANCELADA' && (
                            <button
                              onClick={() => openReprint(dsf)}
                              title="Reimprimir DSF"
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.056 48.056 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
                              </svg>
                              Imprimir
                            </button>
                          )}
                          {canUpload && dsf.status !== 'CANCELADA' && (
                            <button
                              onClick={() => openUpload(dsf)}
                              title="Reenviar foto assinada"
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                              </svg>
                              Foto
                            </button>
                          )}
                          {canCancel && dsf.status !== 'CANCELADA' && (
                            <button
                              onClick={() => openCancelModal(dsf)}
                              title="Cancelar DSF"
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              Cancelar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="lg:hidden divide-y divide-slate-100">
              {data?.dsfs.map((dsf) => (
                <div key={dsf.id} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-mono text-xs font-semibold text-slate-700">{dsf.numeroDsf}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{fmtDateTime(dsf.dataEmissao)}</p>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[dsf.status]}`}>
                      {STATUS_LABELS[dsf.status]}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-800">{dsf.clienteNome}</p>
                  <p className="text-xs text-slate-400">{fmtCpf(dsf.clienteCpf)}</p>
                  <p className="text-xs text-slate-600 mt-1">{dsf.tipoServicoLabel}</p>
                  <p className="text-xs text-slate-500 mt-0.5">RT: {dsf.rtNome}{dsf.rtCrf ? ` — ${dsf.rtCrf}` : ''}</p>
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    {dsf.driveFileId && (
                      <button
                        onClick={() => openDriveFile(dsf.driveFileId!)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        Ver PDF
                      </button>
                    )}
                    {dsf.status !== 'CANCELADA' && (
                      <button
                        onClick={() => openReprint(dsf)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.056 48.056 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
                        </svg>
                        Imprimir
                      </button>
                    )}
                    {canUpload && dsf.status !== 'CANCELADA' && (
                      <button
                        onClick={() => openUpload(dsf)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                        </svg>
                        Reenviar foto
                      </button>
                    )}
                    {canCancel && dsf.status !== 'CANCELADA' && (
                      <button
                        onClick={() => openCancelModal(dsf)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {data && data.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
                <p className="text-xs text-slate-500">
                  {data.total} registro{data.total !== 1 ? 's' : ''} — página {data.page} de {data.totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    ← Anterior
                  </button>
                  <button
                    disabled={page >= data.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Próxima →
                  </button>
                </div>
              </div>
            )}

            {data && data.totalPages <= 1 && data.total > 0 && (
              <div className="px-4 py-3 border-t border-slate-100 bg-slate-50">
                <p className="text-xs text-slate-400">
                  {data.total} registro{data.total !== 1 ? 's' : ''}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Cancel Modal ── */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeCancelModal} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Cancelar DSF</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {cancelTarget.numeroDsf} — {cancelTarget.clienteNome}
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-600 mb-4">
              Esta ação é irreversível. A DSF será marcada como{' '}
              <span className="font-semibold text-red-700">Cancelada</span> e registrada no log de auditoria.
            </p>

            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Motivo do cancelamento{' '}
                <span className="text-slate-400 font-normal">(opcional)</span>
              </label>
              <textarea
                value={cancelMotivo}
                onChange={(e) => setCancelMotivo(e.target.value)}
                maxLength={200}
                rows={3}
                placeholder="Ex: Erro de digitação, pedido do cliente..."
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
              />
            </div>

            {cancelError && (
              <p className="text-xs text-red-600 mb-3 bg-red-50 rounded-lg px-3 py-2">{cancelError}</p>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={closeCancelModal}
                disabled={cancelling}
                className="flex-1 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                Voltar
              </button>
              <button
                onClick={confirmCancel}
                disabled={cancelling}
                className="flex-1 py-2.5 text-sm font-medium bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-60 transition-colors"
              >
                {cancelling ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Cancelando...
                  </span>
                ) : (
                  'Confirmar Cancelamento'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reprint Modal ── */}
      {reprintTarget && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeReprint} />
          <div className="relative w-full max-w-2xl my-4">
            {/* Toolbar */}
            <div className="bg-slate-800 rounded-t-2xl px-4 py-3 flex items-center justify-between no-print">
              <div>
                <p className="text-white text-sm font-semibold">Reimprimir DSF</p>
                <p className="text-slate-400 text-xs mt-0.5">{reprintTarget.numeroDsf} — {reprintTarget.clienteNome}</p>
              </div>
              <div className="flex items-center gap-2">
                {reprintData && (
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white text-slate-900 text-xs font-semibold rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.056 48.056 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
                    </svg>
                    {reprintData.tipoImpressao === 'FOLHA_A4' ? 'Imprimir A4' : 'Imprimir Cupom'}
                  </button>
                )}
                <button onClick={closeReprint} className="text-slate-400 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="bg-slate-100 rounded-b-2xl p-4">
              {reprintLoading && (
                <div className="flex items-center justify-center py-16 gap-3">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-slate-600">Carregando documento...</span>
                </div>
              )}
              {reprintError && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{reprintError}</div>
              )}
              {reprintData && (
                <>
                  {reprintData.tipoImpressao === 'FOLHA_A4' ? (
                    <div className="dsf-doc bg-white rounded-2xl border border-slate-200 shadow-sm p-8 max-w-[210mm] mx-auto text-slate-900 text-sm leading-relaxed">
                      <div className="flex items-start justify-between mb-6 pb-4 border-b-2 border-slate-800">
                        <div>
                          {reprintData.drogariaLogoUrl
                            ? <img src={reprintData.drogariaLogoUrl} alt="Logo" className="h-14 object-contain mb-2" />
                            : <p className="text-xl font-extrabold uppercase tracking-wide">{reprintData.drogariaNome}</p>
                          }
                          <p className="text-xs text-slate-500">CNPJ: {reprintData.drogariaCnpj}</p>
                          {reprintData.drogariaTelefone && <p className="text-xs text-slate-500">Tel: {reprintData.drogariaTelefone}</p>}
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-base uppercase">Declaração de Serviço Farmacêutico</p>
                          <p className="text-slate-500 font-mono text-sm">{reprintData.numeroDsf}</p>
                          <p className="text-slate-500 text-xs">{new Date(reprintData.dataEmissao).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-6 mb-4">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Responsável Técnico</p>
                          <p className="font-semibold">{reprintData.rtNome}</p>
                          {reprintData.rtCrf && <p className="text-slate-500 text-xs">CRF: {reprintData.rtCrf}</p>}
                        </div>
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Paciente</p>
                          <p className="font-semibold">{reprintData.clienteNome}</p>
                          <p className="text-slate-500 text-xs">CPF: {fmtCpf(reprintData.clienteCpf)} | Nasc: {fmtDate(reprintData.clienteDataNasc)}</p>
                          <p className="text-slate-500 text-xs">Fone: {reprintData.clienteTelefone}</p>
                        </div>
                      </div>

                      <div className="border-t border-slate-200 my-4" />

                      <div className="mb-4">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Serviço Prestado</p>
                        <p className="font-semibold text-base">{reprintData.tipoServicoLabel}</p>
                        {reprintData.textoOrientacao && (
                          <p className="whitespace-pre-wrap text-sm text-slate-600 mt-1 bg-slate-50 rounded p-2">{reprintData.textoOrientacao}</p>
                        )}
                      </div>

                      {reprintData.observacoes && (
                        <div className="mb-4">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Evolução Farmacêutica e Conduta Proposta</p>
                          <p className="whitespace-pre-wrap bg-slate-50 rounded-lg p-3 text-sm">{reprintData.observacoes}</p>
                        </div>
                      )}

                      {reprintData.insumos.length > 0 && (
                        <div className="mb-4">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Insumos Utilizados</p>
                          <table className="w-full text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-100">
                                <th className="text-left p-2 font-semibold">Produto</th>
                                <th className="text-left p-2 font-semibold">Lote</th>
                                <th className="text-left p-2 font-semibold">Fabricante</th>
                                <th className="text-left p-2 font-semibold">Validade</th>
                              </tr>
                            </thead>
                            <tbody>
                              {reprintData.insumos.map((ins, i) => (
                                <tr key={i} className="border-t border-slate-100">
                                  <td className="p-2">{ins.nomeProduto}</td>
                                  <td className="p-2">{ins.lote}</td>
                                  <td className="p-2">{ins.fabricante}</td>
                                  <td className="p-2">{fmtDate(ins.validade)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      <div className="border-t border-slate-200 my-4" />

                      <div className="grid grid-cols-2 gap-8 mt-8">
                        <div>
                          <div className="border-b border-slate-900 mb-2 mt-12" />
                          <p className="text-xs text-center">{reprintData.rtNome}{reprintData.rtCrf ? ` — CRF ${reprintData.rtCrf}` : ''}</p>
                          <p className="text-[11px] text-center text-slate-500">Profissional Responsável (CRF/UF)</p>
                        </div>
                        <div>
                          <div className="border-b border-slate-900 mb-2 mt-12" />
                          <p className="text-xs text-center">{reprintData.clienteNome}</p>
                          <p className="text-[11px] text-center text-slate-500">Paciente / Usuário do Serviço</p>
                        </div>
                      </div>

                      <div className="border-t border-slate-200 mt-6 pt-3 text-center">
                        <p className="text-[10px] text-slate-400 leading-tight">
                          Esta declaração constitui um registro de monitoramento de parâmetros fisiológicos/bioquímicos e triagem em saúde. Não possui fins de diagnóstico definitivo e não substitui a consulta médica ou a avaliação por profissional de saúde habilitado.
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1">ANVISA RDC 44/2009 | LGPD Lei 13.709/2018</p>
                      </div>
                    </div>
                  ) : (
                    <div className="thermal-receipt bg-white rounded-2xl border border-slate-200 shadow-sm p-5 font-mono text-xs text-slate-900 max-w-[320px] mx-auto leading-relaxed">
                      <div className="text-center mb-3">
                        {reprintData.drogariaLogoUrl
                          ? <img src={reprintData.drogariaLogoUrl} alt="Logo" className="h-12 mx-auto object-contain mb-1" />
                          : <p className="font-bold text-sm uppercase tracking-wide">{reprintData.drogariaNome}</p>
                        }
                        {reprintData.drogariaLogoUrl && <p className="font-bold text-xs uppercase">{reprintData.drogariaNome}</p>}
                        <p className="text-slate-500">CNPJ: {reprintData.drogariaCnpj}</p>
                        {reprintData.drogariaTelefone && <p className="text-slate-500">Tel: {reprintData.drogariaTelefone}</p>}
                      </div>

                      <div className="border-t border-dashed border-slate-300 my-2" />

                      <div className="text-center mb-2">
                        <p className="font-bold text-sm">DECLARAÇÃO DE SERVIÇO FARMACÊUTICO</p>
                        <p className="text-slate-500 font-bold">{reprintData.numeroDsf}</p>
                        <p className="text-slate-500">{new Date(reprintData.dataEmissao).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>

                      <div className="border-t border-dashed border-slate-300 my-2" />

                      <p className="font-bold uppercase mb-1">Responsável Técnico</p>
                      <p>{reprintData.rtNome}</p>
                      {reprintData.rtCrf && <p className="text-slate-500">CRF: {reprintData.rtCrf}</p>}

                      <div className="border-t border-dashed border-slate-300 my-2" />

                      <p className="font-bold uppercase mb-1">Paciente</p>
                      <p>{reprintData.clienteNome}</p>
                      <p className="text-slate-500">CPF: {fmtCpf(reprintData.clienteCpf)}</p>
                      <p className="text-slate-500">Nasc: {fmtDate(reprintData.clienteDataNasc)}</p>
                      <p className="text-slate-500">Fone: {reprintData.clienteTelefone}</p>

                      <div className="border-t border-dashed border-slate-300 my-2" />

                      <p className="font-bold uppercase mb-1">Serviço Prestado</p>
                      <p className="font-semibold">{reprintData.tipoServicoLabel}</p>
                      {reprintData.textoOrientacao && (
                        <p className="whitespace-pre-wrap text-slate-600 text-xs mt-1">{reprintData.textoOrientacao}</p>
                      )}

                      {reprintData.insumos.length > 0 && (
                        <>
                          <div className="border-t border-dashed border-slate-300 my-2" />
                          <p className="font-bold uppercase mb-1">Insumos Utilizados</p>
                          {reprintData.insumos.map((ins, i) => (
                            <div key={i} className="mb-1">
                              <p className="font-medium">{ins.nomeProduto}</p>
                              <p className="text-slate-500">Lote: {ins.lote} | Fab: {ins.fabricante}</p>
                              <p className="text-slate-500">Val: {fmtDate(ins.validade)}</p>
                            </div>
                          ))}
                        </>
                      )}

                      {reprintData.observacoes && (
                        <>
                          <div className="border-t border-dashed border-slate-300 my-2" />
                          <p className="font-bold uppercase mb-1">Evolução Farmacêutica</p>
                          <p className="whitespace-pre-wrap">{reprintData.observacoes}</p>
                        </>
                      )}

                      <div className="border-t border-dashed border-slate-300 my-2" />

                      <div className="mt-4 mb-2">
                        <p className="font-bold uppercase mb-1">Profissional Responsável (CRF/UF)</p>
                        <div className="border-b border-slate-900 mt-8 mb-1" />
                        <p>{reprintData.rtNome}{reprintData.rtCrf ? ` — CRF ${reprintData.rtCrf}` : ''}</p>
                      </div>

                      <div className="mt-4 mb-2">
                        <p className="font-bold uppercase mb-1">Paciente / Usuário do Serviço</p>
                        <div className="border-b border-slate-900 mt-8 mb-1" />
                        <p>{reprintData.clienteNome}</p>
                      </div>

                      <div className="border-t border-dashed border-slate-300 my-3 text-center">
                        <p className="text-[10px] text-slate-500 leading-tight mt-2">
                          Esta declaração constitui um registro de monitoramento de parâmetros fisiológicos/bioquímicos e triagem em saúde. Não possui fins de diagnóstico definitivo e não substitui a consulta médica ou a avaliação por profissional de saúde habilitado.
                        </p>
                        <p className="text-[10px] text-slate-500 leading-tight mt-1">ANVISA RDC 44/2009 | LGPD Lei 13.709/2018</p>
                      </div>
                    </div>
                  )}

                  {/* Print CSS */}
                  {reprintData.tipoImpressao === 'FOLHA_A4' ? (
                    <style>{`
                      @media print {
                        body * { visibility: hidden; }
                        .dsf-doc, .dsf-doc * { visibility: visible; }
                        .dsf-doc {
                          position: fixed; left: 0; top: 0;
                          width: 100%; padding: 15mm;
                          font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.5;
                          color: #000; background: #fff;
                          border: none; border-radius: 0; box-shadow: none;
                        }
                        @page { size: A4; margin: 10mm; }
                      }
                    `}</style>
                  ) : (
                    <style>{`
                      @media print {
                        body * { visibility: hidden; }
                        .thermal-receipt, .thermal-receipt * { visibility: visible; }
                        .thermal-receipt {
                          position: fixed; left: 0; top: 0;
                          width: 72mm;
                          font-family: monospace; font-size: 9pt; line-height: 1.4;
                          color: #000; background: #fff;
                          border: none; border-radius: 0; box-shadow: none; padding: 2mm;
                        }
                        @page { size: 80mm auto; margin: 4mm; }
                      }
                    `}</style>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Upload Modal ── */}
      {uploadTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeUpload} />
          <div className="relative w-full max-w-md bg-slate-900 rounded-2xl shadow-xl overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 flex items-center justify-between border-b border-slate-700">
              <div>
                <p className="text-white text-sm font-semibold">
                  {uploadSuccess ? 'Foto enviada!' : 'Reenviar Cupom Assinado'}
                </p>
                <p className="text-slate-400 text-xs mt-0.5">
                  {uploadTarget.numeroDsf} — {uploadTarget.clienteNome}
                </p>
              </div>
              <button onClick={closeUpload} disabled={uploading} className="text-slate-400 hover:text-white disabled:opacity-40 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {uploadSuccess ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 px-6 text-center">
                <div className="w-14 h-14 bg-emerald-600 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-white font-semibold">Arquivo enviado com sucesso!</p>
                <p className="text-slate-400 text-xs">O PDF foi atualizado no Google Drive.</p>
                <button onClick={closeUpload} className="mt-2 px-6 py-2.5 bg-white text-slate-900 text-sm font-semibold rounded-xl hover:bg-slate-100 transition-colors">
                  Fechar
                </button>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {uploadError && (
                  <div className="flex items-center gap-2 bg-red-900/50 border border-red-700 text-red-300 rounded-lg px-3 py-2 text-xs">
                    <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {uploadError}
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }}
                />

                {capturedImage ? (
                  <>
                    {capturedImage.startsWith('data:application/pdf') ? (
                      <div className="flex flex-col items-center justify-center gap-3 py-8 bg-slate-800 rounded-xl">
                        <svg className="w-12 h-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                        <p className="text-white text-sm font-medium">PDF pronto para envio</p>
                      </div>
                    ) : (
                      <img src={capturedImage} alt="Arquivo selecionado" className="w-full rounded-xl object-contain max-h-56" />
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCapturedImage(null)}
                        disabled={uploading}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white text-sm font-medium rounded-xl transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                        </svg>
                        Trocar
                      </button>
                      <button
                        onClick={handleUpload}
                        disabled={uploading}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
                      >
                        {uploading ? (
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                          </svg>
                        )}
                        {uploading ? 'Enviando...' : 'Enviar'}
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault()
                      setIsDragOver(false)
                      const f = e.dataTransfer.files[0]
                      if (f) handleFileSelect(f)
                    }}
                    className={`w-full border-2 border-dashed rounded-2xl p-8 flex flex-col items-center gap-3 transition-colors ${isDragOver ? 'border-emerald-400 bg-emerald-900/20' : 'border-slate-600 hover:border-slate-400 hover:bg-slate-800/50'}`}
                  >
                    <svg className={`w-10 h-10 ${isDragOver ? 'text-emerald-400' : 'text-slate-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    <div className="text-center">
                      <p className="text-white font-semibold text-sm">Arraste a foto ou PDF do cupom assinado</p>
                      <p className="text-slate-400 text-xs mt-1">ou clique para selecionar — JPG, PNG, PDF</p>
                    </div>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
