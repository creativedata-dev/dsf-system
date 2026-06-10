'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

/* ─── Types ──────────────────────────────────────────────────────────────────── */

interface TenantItem { id: string; nomeFantasia: string }

interface ClienteItem {
  id: string
  tenantId: string
  nome: string
  cpf: string
  dataNascimento: string
  sexo: string
  telefone: string
  email: string | null
  createdAt: string
  _count: { dsfs: number }
}

interface DsfDetail {
  id: string
  numeroDsf: string
  tipoServico: string
  tipoServicoLabel: string
  dataEmissao: string
  status: 'EMITIDA' | 'CONCLUIDA' | 'CANCELADA'
  driveFileId: string | null
  observacoes: string | null
  rtNome: string
  rtCrf: string | null
  atendenteNome: string
  insumos: { nomeProduto: string; lote: string; fabricante: string; validade: string; quantidade: number; unidade: string }[]
}

interface ClienteDetail {
  id: string
  nome: string
  cpf: string
  rg: string | null
  dataNascimento: string
  sexo: string
  telefone: string
  email: string | null
  endereco: string
  consentimentoLgpdAt: string
  createdAt: string
  updatedAt: string
}

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

function fmtCpf(cpf: string) {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
}

const STATUS_COLORS: Record<string, string> = {
  EMITIDA: 'bg-amber-100 text-amber-700',
  CONCLUIDA: 'bg-green-100 text-green-700',
  CANCELADA: 'bg-red-100 text-red-700',
}
const STATUS_LABELS: Record<string, string> = {
  EMITIDA: 'Emitida', CONCLUIDA: 'Concluída', CANCELADA: 'Cancelada',
}

/* ─── Component ──────────────────────────────────────────────────────────────── */

export function PacientesClient({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [clientes, setClientes] = useState<ClienteItem[]>([])
  const [tenants, setTenants] = useState<TenantItem[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [appliedQ, setAppliedQ] = useState('')
  const [tenantFilter, setTenantFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Modal state
  const [selected, setSelected] = useState<ClienteItem | null>(null)
  const [detail, setDetail] = useState<{ cliente: ClienteDetail; dsfs: DsfDetail[] } | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'dados' | 'dsfs'>('dados')

  // Edit state
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ nome: '', telefone: '', email: '', rg: '', endereco: '' })
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')

  // DSF detail expand
  const [expandedDsf, setExpandedDsf] = useState<string | null>(null)

  const searchRef = useRef<HTMLInputElement>(null)

  const fetchClientes = useCallback(async (search: string, pg: number, tenant: string) => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page: String(pg) })
      if (search) params.set('q', search)
      if (tenant) params.set('tenantId', tenant)
      const res = await fetch(`/api/admin/clients?${params}`)
      if (!res.ok) { setError('Erro ao carregar pacientes'); return }
      const data = await res.json()
      setClientes(data.clientes)
      setTotal(data.total)
      setTotalPages(data.totalPages)
      if (data.tenants?.length) setTenants(data.tenants)
    } catch {
      setError('Falha de conexão')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchClientes(appliedQ, page, tenantFilter)
  }, [appliedQ, page, tenantFilter, fetchClientes])

  function search() { setPage(1); setAppliedQ(q) }
  function clearSearch() { setQ(''); setAppliedQ(''); setPage(1) }

  async function openDetail(c: ClienteItem) {
    setSelected(c)
    setDetail(null)
    setDetailLoading(true)
    setActiveTab('dados')
    setEditing(false)
    setExpandedDsf(null)
    try {
      const res = await fetch(`/api/admin/clients/${c.id}`)
      if (!res.ok) return
      const data = await res.json()
      setDetail(data)
      setEditForm({
        nome: data.cliente.nome,
        telefone: data.cliente.telefone,
        email: data.cliente.email ?? '',
        rg: data.cliente.rg ?? '',
        endereco: data.cliente.endereco,
      })
    } catch {
      // silently ignore
    } finally {
      setDetailLoading(false)
    }
  }

  function closeDetail() { setSelected(null); setDetail(null) }

  async function saveEdit() {
    if (!selected || !detail) return
    setSaving(true)
    setEditError('')
    try {
      const res = await fetch(`/api/admin/clients/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: editForm.nome.trim(),
          telefone: editForm.telefone.trim(),
          email: editForm.email.trim() || null,
          rg: editForm.rg.trim() || null,
          endereco: editForm.endereco.trim(),
        }),
      })
      const json = await res.json()
      if (!res.ok) { setEditError(json.error ?? 'Erro ao salvar'); return }
      setDetail((d) => d ? { ...d, cliente: { ...d.cliente, ...json } } : d)
      setClientes((cs) => cs.map((c) => c.id === selected.id ? { ...c, nome: json.nome } : c))
      setEditing(false)
    } catch {
      setEditError('Falha de conexão')
    } finally {
      setSaving(false)
    }
  }

  const tenantName = (id: string) => tenants.find((t) => t.id === id)?.nomeFantasia ?? '—'

  return (
    <div className="p-4 sm:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Pacientes</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {total > 0 ? `${total} paciente${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}` : 'Cadastro de pacientes do estabelecimento — dados protegidos pela LGPD'}
        </p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 flex gap-2">
            <input
              ref={searchRef}
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && search()}
              placeholder="Buscar por nome ou CPF..."
              className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button onClick={search} className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              Buscar
            </button>
            {appliedQ && (
              <button onClick={clearSearch} className="px-3 py-2 text-sm text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                Limpar
              </button>
            )}
          </div>
          {isSuperAdmin && tenants.length > 0 && (
            <select
              value={tenantFilter}
              onChange={(e) => { setTenantFilter(e.target.value); setPage(1) }}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos os tenants</option>
              {tenants.map((t) => <option key={t.id} value={t.id}>{t.nomeFantasia}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {error && <div className="px-6 py-4 bg-red-50 text-sm text-red-700">{error}</div>}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="ml-3 text-sm text-slate-500">Carregando...</span>
          </div>
        ) : clientes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <svg className="w-10 h-10 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-sm text-slate-400">Nenhum paciente encontrado</p>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Paciente</th>
                    {isSuperAdmin && <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Tenant</th>}
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">CPF</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Nascimento</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Telefone</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">DSFs</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Cadastro</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {clientes.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{c.nome}</p>
                        <p className="text-xs text-slate-400">{c.sexo}</p>
                      </td>
                      {isSuperAdmin && (
                        <td className="px-4 py-3">
                          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{tenantName(c.tenantId)}</span>
                        </td>
                      )}
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{fmtCpf(c.cpf)}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fmtDate(c.dataNascimento)}</td>
                      <td className="px-4 py-3 text-slate-600">{c.telefone}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">{c._count.dsfs}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">{fmtDate(c.createdAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openDetail(c)}
                          className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          Ver detalhes
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="lg:hidden divide-y divide-slate-100">
              {clientes.map((c) => (
                <div key={c.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 truncate">{c.nome}</p>
                    <p className="text-xs font-mono text-slate-400">{fmtCpf(c.cpf)}</p>
                    {isSuperAdmin && <p className="text-[10px] text-slate-400 mt-0.5">{tenantName(c.tenantId)}</p>}
                    <p className="text-xs text-slate-400 mt-0.5">{c._count.dsfs} DSF{c._count.dsfs !== 1 ? 's' : ''}</p>
                  </div>
                  <button onClick={() => openDetail(c)} className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                    Ver
                  </button>
                </div>
              ))}
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
                <p className="text-xs text-slate-500">{total} paciente{total !== 1 ? 's' : ''} — página {page} de {totalPages}</p>
                <div className="flex gap-2">
                  <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    ← Anterior
                  </button>
                  <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    Próxima →
                  </button>
                </div>
              </div>
            )}
            {totalPages <= 1 && total > 0 && (
              <div className="px-4 py-3 border-t border-slate-100 bg-slate-50">
                <p className="text-xs text-slate-400">{total} paciente{total !== 1 ? 's' : ''}</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Modal de Detalhe ── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeDetail} />
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh]">

            {/* Header do modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{selected.nome}</h3>
                <p className="text-xs font-mono text-slate-400 mt-0.5">{fmtCpf(selected.cpf)}</p>
              </div>
              <button onClick={closeDetail} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-100 px-6 flex-shrink-0">
              {(['dados', 'dsfs'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab === 'dados' ? 'Dados do Paciente' : `Histórico DSF (${selected._count.dsfs})`}
                </button>
              ))}
            </div>

            <div className="overflow-y-auto flex-1">
              {detailLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : detail ? (
                <>
                  {/* ── Tab Dados ── */}
                  {activeTab === 'dados' && (
                    <div className="px-6 py-5">
                      {editing ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="sm:col-span-2">
                              <label className="block text-xs font-medium text-slate-600 mb-1">Nome</label>
                              <input type="text" value={editForm.nome}
                                onChange={(e) => setEditForm((f) => ({ ...f, nome: e.target.value }))}
                                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">Telefone</label>
                              <input type="text" value={editForm.telefone}
                                onChange={(e) => setEditForm((f) => ({ ...f, telefone: e.target.value }))}
                                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">E-mail <span className="text-slate-400 font-normal">(opcional)</span></label>
                              <input type="email" value={editForm.email}
                                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">RG <span className="text-slate-400 font-normal">(opcional)</span></label>
                              <input type="text" value={editForm.rg}
                                onChange={(e) => setEditForm((f) => ({ ...f, rg: e.target.value }))}
                                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-xs font-medium text-slate-600 mb-1">Endereço</label>
                              <input type="text" value={editForm.endereco}
                                onChange={(e) => setEditForm((f) => ({ ...f, endereco: e.target.value }))}
                                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                          </div>
                          {editError && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{editError}</p>}
                          <div className="flex gap-2">
                            <button onClick={() => setEditing(false)} disabled={saving}
                              className="flex-1 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 transition-colors">
                              Cancelar
                            </button>
                            <button onClick={saveEdit} disabled={saving}
                              className="flex-1 py-2 text-sm font-medium bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-60 transition-colors">
                              {saving ? 'Salvando...' : 'Salvar Alterações'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <InfoRow label="Nome" value={detail.cliente.nome} />
                          <InfoRow label="CPF" value={fmtCpf(detail.cliente.cpf)} mono />
                          <InfoRow label="RG" value={detail.cliente.rg ?? '—'} />
                          <InfoRow label="Data de Nascimento" value={fmtDate(detail.cliente.dataNascimento)} />
                          <InfoRow label="Sexo" value={detail.cliente.sexo} />
                          <InfoRow label="Telefone" value={detail.cliente.telefone} />
                          <InfoRow label="E-mail" value={detail.cliente.email ?? '—'} />
                          <InfoRow label="Endereço" value={detail.cliente.endereco} />
                          <InfoRow label="Consentimento LGPD" value={fmtDateTime(detail.cliente.consentimentoLgpdAt)} />
                          <InfoRow label="Cadastrado em" value={fmtDateTime(detail.cliente.createdAt)} />
                          <div className="pt-2">
                            <button onClick={() => setEditing(true)}
                              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                              </svg>
                              Editar dados
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Tab DSFs ── */}
                  {activeTab === 'dsfs' && (
                    <div className="divide-y divide-slate-100">
                      {detail.dsfs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <p className="text-sm text-slate-400">Nenhuma DSF emitida para este paciente</p>
                        </div>
                      ) : detail.dsfs.map((dsf) => (
                        <div key={dsf.id} className="px-6 py-4">
                          {/* Header da DSF */}
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-mono text-xs font-semibold text-slate-700">{dsf.numeroDsf}</p>
                              <p className="text-xs text-slate-500 mt-0.5">{fmtDateTime(dsf.dataEmissao)}</p>
                            </div>
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${STATUS_COLORS[dsf.status]}`}>
                              {STATUS_LABELS[dsf.status]}
                            </span>
                          </div>
                          <p className="text-sm text-slate-700 mt-1.5">{dsf.tipoServicoLabel}</p>
                          <p className="text-xs text-slate-500 mt-0.5">RT: {dsf.rtNome}{dsf.rtCrf ? ` — ${dsf.rtCrf}` : ''}</p>

                          {/* Ações */}
                          <div className="flex items-center gap-2 mt-2.5">
                            <button
                              onClick={() => setExpandedDsf(expandedDsf === dsf.id ? null : dsf.id)}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                            >
                              <svg className={`w-3 h-3 transition-transform ${expandedDsf === dsf.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                              </svg>
                              {expandedDsf === dsf.id ? 'Ocultar detalhes' : 'Ver detalhes'}
                            </button>
                            {dsf.driveFileId && (
                              <a
                                href={`https://drive.google.com/file/d/${dsf.driveFileId}/view`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                              >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                Ver PDF assinado
                              </a>
                            )}
                          </div>

                          {/* Detalhe expandido */}
                          {expandedDsf === dsf.id && (
                            <div className="mt-3 pl-3 border-l-2 border-slate-200 space-y-1.5 text-xs text-slate-600">
                              <p><span className="text-slate-400">Atendente:</span> {dsf.atendenteNome}</p>
                              {dsf.observacoes && (
                                <p><span className="text-slate-400">Observações:</span> {dsf.observacoes}</p>
                              )}
                              {dsf.insumos.length > 0 && (
                                <div>
                                  <p className="text-slate-400 mb-1">Insumos:</p>
                                  <div className="space-y-1">
                                    {dsf.insumos.map((ins, i) => (
                                      <p key={i} className="bg-slate-50 rounded px-2 py-1">
                                        {ins.nomeProduto} — Lote: {ins.lote} | Fab: {ins.fabricante} | Val: {fmtDate(ins.validade)} | Qtd: {ins.quantidade} {ins.unidade}
                                      </p>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {!dsf.driveFileId && dsf.status === 'CONCLUIDA' && (
                                <p className="text-amber-600">PDF não arquivado (Drive não configurado no momento da emissão)</p>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── InfoRow ────────────────────────────────────────────────────────────────── */

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-slate-500 flex-shrink-0 w-40">{label}</span>
      <span className={`text-slate-800 font-medium text-right ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}
