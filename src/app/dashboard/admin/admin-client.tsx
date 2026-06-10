'use client'

import { useState, useEffect, useCallback } from 'react'

/* ─── Types ──────────────────────────────────────────────────────────────────── */

interface TenantItem { id: string; nomeFantasia: string }

interface UserItem {
  id: string
  tenantId: string
  nome: string
  email: string
  permissions: string[]
  crf: string | null
  ativo: boolean
  createdAt: string
}

const ALL_PERMISSIONS: { value: string; label: string }[] = [
  { value: 'CLIENTE_BUSCAR',      label: 'Buscar Clientes' },
  { value: 'CLIENTE_CADASTRAR',   label: 'Cadastrar Clientes' },
  { value: 'DSF_EMITIR',         label: 'Emitir DSF' },
  { value: 'DSF_CANCELAR',       label: 'Cancelar DSF' },
  { value: 'ANVISA_RELATORIOS',   label: 'Relatórios ANVISA' },
  { value: 'DRIVE_CONFIGURAR',       label: 'Configurar Drive' },
  { value: 'TEMPERATURA_GERENCIAR',  label: 'Gerenciar Temperatura' },
  { value: 'EQUIPAMENTOS_GERENCIAR', label: 'Gerenciar Equipamentos' },
  { value: 'POPS_GERENCIAR',         label: 'Gerenciar POPs' },
  { value: 'VALIDADE_GERENCIAR',     label: 'Controle de Validade' },
  { value: 'PAINEL_FISCAL_GERENCIAR', label: 'Painel do Fiscal' },
  { value: 'SUPER_ADMIN_GLOBAIS',    label: 'Super Admin' },
]

const PERM_COLORS: Record<string, string> = {
  SUPER_ADMIN_GLOBAIS:  'bg-purple-100 text-purple-700',
  ANVISA_RELATORIOS:    'bg-blue-100 text-blue-700',
  DSF_CANCELAR:         'bg-red-100 text-red-700',
  DSF_EMITIR:           'bg-green-100 text-green-700',
  DRIVE_CONFIGURAR:     'bg-amber-100 text-amber-700',
  CLIENTE_CADASTRAR:    'bg-indigo-100 text-indigo-700',
  CLIENTE_BUSCAR:       'bg-slate-100 text-slate-600',
  TEMPERATURA_GERENCIAR: 'bg-cyan-100 text-cyan-700',
  EQUIPAMENTOS_GERENCIAR:'bg-teal-100 text-teal-700',
  POPS_GERENCIAR:       'bg-violet-100 text-violet-700',
  VALIDADE_GERENCIAR:   'bg-rose-100 text-rose-700',
  PAINEL_FISCAL_GERENCIAR: 'bg-orange-100 text-orange-700',
}

const PERM_LABEL: Record<string, string> = Object.fromEntries(
  ALL_PERMISSIONS.map((p) => [p.value, p.label])
)

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function blankForm(defaultTenantId: string) {
  return { tenantId: defaultTenantId, nome: '', email: '', senha: '', crf: '', permissions: ['CLIENTE_BUSCAR', 'DSF_EMITIR'] }
}

/* ─── Component ──────────────────────────────────────────────────────────────── */

export function AdminClient({ currentUserId, isSuperAdmin }: { currentUserId: string; isSuperAdmin: boolean }) {
  const [users, setUsers] = useState<UserItem[]>([])
  const [tenants, setTenants] = useState<TenantItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterTenant, setFilterTenant] = useState('')

  // Modal criação
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState(blankForm(''))
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  // Modal edição
  const [editTarget, setEditTarget] = useState<UserItem | null>(null)
  const [editForm, setEditForm] = useState({ tenantId: '', nome: '', email: '', senha: '', crf: '', permissions: [] as string[] })
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/users')
      if (!res.ok) { setError('Erro ao carregar usuários'); return }
      const data = await res.json()
      setUsers(data.users)
      setTenants(data.tenants)
      if (data.tenants.length > 0 && !createForm.tenantId) {
        setCreateForm((f) => ({ ...f, tenantId: data.tenants[0].id }))
      }
    } catch {
      setError('Falha de conexão')
    } finally {
      setLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const tenantName = (id: string) => tenants.find((t) => t.id === id)?.nomeFantasia ?? id

  const filtered = filterTenant ? users.filter((u) => u.tenantId === filterTenant) : users

  /* ── Criar ── */
  function openCreate() {
    setCreateForm(blankForm(tenants[0]?.id ?? ''))
    setCreateError('')
    setShowCreate(true)
  }

  function toggleCreatePerm(p: string) {
    setCreateForm((f) => ({
      ...f,
      permissions: f.permissions.includes(p) ? f.permissions.filter((x) => x !== p) : [...f.permissions, p],
    }))
  }

  async function submitCreate() {
    if (!createForm.tenantId || !createForm.nome.trim() || !createForm.email.trim() || !createForm.senha || !createForm.permissions.length) {
      setCreateError('Tenant, nome, e-mail, senha e ao menos uma permissão são obrigatórios')
      return
    }
    setCreating(true)
    setCreateError('')
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: createForm.tenantId,
          nome: createForm.nome.trim(),
          email: createForm.email.trim(),
          senha: createForm.senha,
          permissions: createForm.permissions,
          crf: createForm.crf.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setCreateError(json.error ?? 'Erro ao criar'); return }
      setShowCreate(false)
      fetchUsers()
    } catch {
      setCreateError('Falha de conexão')
    } finally {
      setCreating(false)
    }
  }

  /* ── Editar ── */
  function openEdit(u: UserItem) {
    setEditTarget(u)
    setEditForm({ tenantId: u.tenantId, nome: u.nome, email: u.email, senha: '', crf: u.crf ?? '', permissions: [...u.permissions] })
    setEditError('')
  }

  function toggleEditPerm(p: string) {
    setEditForm((f) => ({
      ...f,
      permissions: f.permissions.includes(p) ? f.permissions.filter((x) => x !== p) : [...f.permissions, p],
    }))
  }

  async function submitEdit() {
    if (!editTarget) return
    if (!editForm.nome.trim() || !editForm.email.trim() || !editForm.permissions.length) {
      setEditError('Nome, e-mail e ao menos uma permissão são obrigatórios')
      return
    }
    setSaving(true)
    setEditError('')
    try {
      const body: Record<string, unknown> = {
        nome: editForm.nome.trim(),
        email: editForm.email.trim(),
        permissions: editForm.permissions,
        crf: editForm.crf.trim() || null,
      }
      if (editForm.senha) body.senha = editForm.senha
      const res = await fetch(`/api/admin/users/${editTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) { setEditError(json.error ?? 'Erro ao salvar'); return }
      setEditTarget(null)
      fetchUsers()
    } catch {
      setEditError('Falha de conexão')
    } finally {
      setSaving(false)
    }
  }

  /* ── Toggle ativo ── */
  async function toggleAtivo(u: UserItem) {
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: !u.ativo }),
      })
      if (!res.ok) {
        const json = await res.json()
        setError(json.error ?? 'Erro ao alterar status')
        return
      }
      fetchUsers()
    } catch {
      setError('Falha de conexão')
    }
  }

  /* ── Render ── */
  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Usuários</h1>
          <p className="text-sm text-slate-500 mt-0.5">{isSuperAdmin ? 'Todos os usuários da plataforma' : 'Gerencie os acessos da equipe — defina permissões individuais para cada função'}</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Novo Usuário
        </button>
      </div>

      {/* Filtro por tenant — só super admin */}
      {isSuperAdmin && tenants.length > 1 && (
        <div className="mb-4 flex items-center gap-3">
          <select
            value={filterTenant}
            onChange={(e) => setFilterTenant(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos os tenants ({users.length})</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nomeFantasia} ({users.filter((u) => u.tenantId === t.id).length})
              </option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">{error}</div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="ml-3 text-sm text-slate-500">Carregando...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-sm text-slate-400">Nenhum usuário encontrado</p>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Usuário</th>
                    {isSuperAdmin && <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Tenant</th>}
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Permissões</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">CRF</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Cadastro</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((u) => (
                    <tr key={u.id} className={`hover:bg-slate-50 transition-colors ${!u.ativo ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{u.nome}</p>
                        <p className="text-xs text-slate-400">{u.email}</p>
                      </td>
                      {isSuperAdmin && (
                        <td className="px-4 py-3">
                          <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                            {tenantName(u.tenantId)}
                          </span>
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {u.permissions.map((p) => (
                            <span key={p} className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${PERM_COLORS[p] ?? 'bg-slate-100 text-slate-600'}`}>
                              {PERM_LABEL[p] ?? p}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{u.crf ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{fmtDate(u.createdAt)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${u.ativo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                          {u.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => openEdit(u)}
                            className="px-2.5 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                          >
                            Editar
                          </button>
                          {u.id !== currentUserId && (
                            <button
                              onClick={() => toggleAtivo(u)}
                              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                                u.ativo ? 'text-red-700 bg-red-50 hover:bg-red-100' : 'text-green-700 bg-green-50 hover:bg-green-100'
                              }`}
                            >
                              {u.ativo ? 'Desativar' : 'Ativar'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="lg:hidden divide-y divide-slate-100">
              {filtered.map((u) => (
                <div key={u.id} className={`p-4 ${!u.ativo ? 'opacity-50' : ''}`}>
                  <div className="flex items-start justify-between mb-1.5">
                    <div>
                      <p className="font-medium text-slate-800">{u.nome}</p>
                      <p className="text-xs text-slate-400">{u.email}</p>
                    </div>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${u.ativo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {u.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  {isSuperAdmin && (
                    <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                      {tenantName(u.tenantId)}
                    </span>
                  )}
                  {u.crf && <p className="text-xs text-blue-600 mt-1">{u.crf}</p>}
                  <div className="flex flex-wrap gap-1 my-2">
                    {u.permissions.map((p) => (
                      <span key={p} className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${PERM_COLORS[p] ?? 'bg-slate-100 text-slate-600'}`}>
                        {PERM_LABEL[p] ?? p}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(u)} className="px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                      Editar
                    </button>
                    {u.id !== currentUserId && (
                      <button
                        onClick={() => toggleAtivo(u)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                          u.ativo ? 'text-red-700 bg-red-50 hover:bg-red-100' : 'text-green-700 bg-green-50 hover:bg-green-100'
                        }`}
                      >
                        {u.ativo ? 'Desativar' : 'Ativar'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50">
              <p className="text-xs text-slate-400">
                {filtered.length} usuário{filtered.length !== 1 ? 's' : ''}
                {isSuperAdmin && (filterTenant ? ` em ${tenantName(filterTenant)}` : ` em ${tenants.length} tenant${tenants.length !== 1 ? 's' : ''}`)}
              </p>
            </div>
          </>
        )}
      </div>

      {/* ── Modal Criar ── */}
      {showCreate && (
        <Modal title="Novo Usuário" onClose={() => !creating && setShowCreate(false)}>
          <UserForm
            form={createForm}
            tenants={tenants}
            onChange={(f) => setCreateForm(f)}
            onTogglePerm={toggleCreatePerm}
            error={createError}
            loading={creating}
            onSubmit={submitCreate}
            onCancel={() => setShowCreate(false)}
            submitLabel="Criar Usuário"
            showTenant={isSuperAdmin}
            isSuperAdmin={isSuperAdmin}
            showSenha
            senhaRequired
          />
        </Modal>
      )}

      {/* ── Modal Editar ── */}
      {editTarget && (
        <Modal title={`Editar — ${editTarget.nome}`} onClose={() => !saving && setEditTarget(null)}>
          <div className="px-6 pt-4 pb-1">
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {tenantName(editTarget.tenantId)}
            </span>
          </div>
          <UserForm
            form={editForm}
            tenants={tenants}
            onChange={(f) => setEditForm(f)}
            onTogglePerm={toggleEditPerm}
            error={editError}
            loading={saving}
            onSubmit={submitEdit}
            onCancel={() => setEditTarget(null)}
            submitLabel="Salvar Alterações"
            showTenant={false}
            isSuperAdmin={isSuperAdmin}
            showSenha
            senhaRequired={false}
          />
        </Modal>
      )}
    </div>
  )
}

/* ─── Modal wrapper ──────────────────────────────────────────────────────────── */

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  )
}

/* ─── UserForm ───────────────────────────────────────────────────────────────── */

type FormState = { tenantId: string; nome: string; email: string; senha: string; crf: string; permissions: string[] }

function UserForm({
  form, tenants, onChange, onTogglePerm, error, loading, onSubmit, onCancel,
  submitLabel, showTenant, showSenha, senhaRequired, isSuperAdmin,
}: {
  form: FormState
  tenants: TenantItem[]
  onChange: (f: FormState) => void
  onTogglePerm: (p: string) => void
  error: string
  loading: boolean
  onSubmit: () => void
  onCancel: () => void
  submitLabel: string
  showTenant: boolean
  showSenha: boolean
  senhaRequired: boolean
  isSuperAdmin: boolean
}) {
  const visiblePermissions = isSuperAdmin
    ? ALL_PERMISSIONS
    : ALL_PERMISSIONS.filter((p) => p.value !== 'SUPER_ADMIN_GLOBAIS')
  return (
    <div className="px-6 py-5 space-y-4">
      {showTenant && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Tenant (farmácia)</label>
          <select
            value={form.tenantId}
            onChange={(e) => onChange({ ...form, tenantId: e.target.value })}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>{t.nomeFantasia}</option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">Nome completo</label>
          <input
            type="text"
            value={form.nome}
            onChange={(e) => onChange({ ...form, nome: e.target.value })}
            placeholder="Ex: Maria Santos"
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">E-mail</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => onChange({ ...form, email: e.target.value })}
            placeholder="maria@drogaria.com"
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">CRF <span className="text-slate-400 font-normal">(opcional)</span></label>
          <input
            type="text"
            value={form.crf}
            onChange={(e) => onChange({ ...form, crf: e.target.value })}
            placeholder="CRF-SP-00000"
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {showSenha && (
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Senha {!senhaRequired && <span className="text-slate-400 font-normal">(deixe em branco para não alterar)</span>}
            </label>
            <input
              type="password"
              value={form.senha}
              onChange={(e) => onChange({ ...form, senha: e.target.value })}
              placeholder={senhaRequired ? 'Mínimo 8 caracteres' : '••••••••'}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-2">Permissões</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {visiblePermissions.map((p) => {
            const active = form.permissions.includes(p.value)
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => onTogglePerm(p.value)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium text-left transition-colors ${
                  active ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${active ? 'bg-blue-600' : 'border border-slate-300'}`}>
                  {active && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                {p.label}
              </button>
            )
          })}
        </div>
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onCancel}
          disabled={loading}
          className="flex-1 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={onSubmit}
          disabled={loading}
          className="flex-1 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Salvando...
            </span>
          ) : submitLabel}
        </button>
      </div>
    </div>
  )
}
