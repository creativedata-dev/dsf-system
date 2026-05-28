'use client'

import { useState, useEffect, useCallback } from 'react'
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

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

function fmtDate(iso: string) {
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

export function AnvisaClient({ canCancel }: { canCancel: boolean }) {
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
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fmtDate(dsf.dataEmissao)}</td>
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
                        <div className="flex items-center gap-2 justify-end">
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
                      <p className="text-xs text-slate-400 mt-0.5">{fmtDate(dsf.dataEmissao)}</p>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[dsf.status]}`}>
                      {STATUS_LABELS[dsf.status]}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-800">{dsf.clienteNome}</p>
                  <p className="text-xs text-slate-400">{fmtCpf(dsf.clienteCpf)}</p>
                  <p className="text-xs text-slate-600 mt-1">{dsf.tipoServicoLabel}</p>
                  <p className="text-xs text-slate-500 mt-0.5">RT: {dsf.rtNome}{dsf.rtCrf ? ` — ${dsf.rtCrf}` : ''}</p>
                  <div className="flex items-center gap-2 mt-3">
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
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeCancelModal}
          />
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
    </div>
  )
}
