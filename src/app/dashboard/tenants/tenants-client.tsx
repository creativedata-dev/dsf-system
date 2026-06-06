'use client'

import { useState, useEffect, useCallback } from 'react'

/* ─── CheckoutButton ─────────────────────────────────────────────────────────── */

const CADENCIA_MAP: Record<string, 'mensal' | 'anual' | 'unico'> = {
  MENSAL: 'mensal',
  ANUAL: 'anual',
  VITALICIO: 'unico',
}

function CheckoutButton({ tenantId, plano }: { tenantId: string; plano: PlanoItem }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const cadencia = CADENCIA_MAP[plano.tipo]
  if (!cadencia) return null

  async function handleCheckout() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, planoId: plano.id, cadencia }),
      })
      const text = await res.text()
      let json: Record<string, unknown> = {}
      try { json = JSON.parse(text) } catch { /* non-JSON */ }
      if (!res.ok) { setError(json.error as string ?? `Erro ${res.status}: ${text.slice(0, 200)}`); return }
      if (!json.url) { setError('URL de pagamento não retornada'); return }
      window.open(json.url as string, '_blank')
    } catch (e) { setError(`Erro: ${e instanceof Error ? e.message : String(e)}`) }
    finally { setLoading(false) }
  }

  return (
    <div className="pt-1">
      <button onClick={handleCheckout} disabled={loading}
        className="w-full py-2 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50">
        {loading ? 'Gerando…' : 'Gerar link de pagamento (Stripe)'}
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}

/* ─── Types ──────────────────────────────────────────────────────────────────── */

interface TenantItem {
  id: string
  nomeFantasia: string
  razaoSocial: string
  cnpj: string
  endereco: string
  telefone: string
  alvaraSanitario: string
  tipoImpressao: 'BOBINA_80MM' | 'FOLHA_A4'
  logoUrl: string | null
  ativo: boolean
  createdAt: string
  _count: { users: number; dsfs: number }
  assinatura: {
    status: string
    expiraEm: string | null
    plano: { nome: string; tipo: string }
  } | null
}

interface PlanoItem {
  id: string
  nome: string
  tipo: string
  precoMensal: number | null
  precoAnual: number | null
  limiteUsuarios: number | null
  limiteDsfsMes: number | null
  trialDias: number | null
  ativo: boolean
  createdAt: string
}

interface AssinaturaItem {
  id: string
  tenantId: string
  planoId: string
  plano: PlanoItem
  status: string
  inicioEm: string
  expiraEm: string | null
  trialExpiraEm: string | null
  canceladaEm: string | null
  motivoCancelamento: string | null
  gateway: string | null
  gatewayCustomerId: string | null
  gatewaySubscriptionId: string | null
  obs: string | null
  createdAt: string
  pagamentos: PagamentoItem[]
}

interface PagamentoItem {
  id: string
  valor: number
  moeda: string
  status: string
  gateway: string
  gatewayPaymentId: string | null
  descricao: string | null
  createdAt: string
}

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

/* ─── Permission constants ───────────────────────────────────────────────────── */

const ALL_PERMISSIONS = [
  { value: 'CLIENTE_BUSCAR',      label: 'Buscar Clientes' },
  { value: 'CLIENTE_CADASTRAR',   label: 'Cadastrar Clientes' },
  { value: 'DSF_EMITIR',         label: 'Emitir DSF' },
  { value: 'DSF_CANCELAR',       label: 'Cancelar DSF' },
  { value: 'ANVISA_RELATORIOS',   label: 'Relatórios ANVISA' },
  { value: 'DRIVE_CONFIGURAR',    label: 'Configurar Drive' },
  { value: 'SUPER_ADMIN_GLOBAIS', label: 'Super Admin' },
]

const PERM_COLORS: Record<string, string> = {
  SUPER_ADMIN_GLOBAIS: 'bg-purple-100 text-purple-700',
  ANVISA_RELATORIOS:   'bg-blue-100 text-blue-700',
  DSF_CANCELAR:        'bg-red-100 text-red-700',
  DSF_EMITIR:          'bg-green-100 text-green-700',
  DRIVE_CONFIGURAR:    'bg-amber-100 text-amber-700',
  CLIENTE_CADASTRAR:   'bg-indigo-100 text-indigo-700',
  CLIENTE_BUSCAR:      'bg-slate-100 text-slate-600',
}

const PERM_LABEL: Record<string, string> = Object.fromEntries(ALL_PERMISSIONS.map((p) => [p.value, p.label]))

/* ─── Tenant form defaults ───────────────────────────────────────────────────── */

const BLANK_TENANT_FORM = {
  nomeFantasia: '', razaoSocial: '', cnpj: '', endereco: '',
  telefone: '', alvaraSanitario: '', tipoImpressao: 'BOBINA_80MM',
  logoUrl: null as string | null,
}

const BLANK_USER_FORM = {
  nome: '', email: '', senha: '', crf: '',
  permissions: ['CLIENTE_BUSCAR', 'DSF_EMITIR'] as string[],
}

type TenantFormState = typeof BLANK_TENANT_FORM
type UserFormState  = typeof BLANK_USER_FORM

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

function fmtCnpj(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 14)
  return d.replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2')
           .replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d)/, '$1-$2')
}
function fmtTel(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  return d.length <= 10
    ? d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2')
    : d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2')
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function fmtCnpjDisplay(cnpj: string) {
  return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
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

/* ─── Component ──────────────────────────────────────────────────────────────── */

export function TenantsClient() {
  const [tenants, setTenants] = useState<TenantItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Modal criar tenant
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState<TenantFormState>(BLANK_TENANT_FORM)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  // Modal detalhe (tabs: dados | usuários | assinatura)
  const [detailTenant, setDetailTenant] = useState<TenantItem | null>(null)
  const [detailTab, setDetailTab] = useState<'dados' | 'usuarios' | 'assinatura'>('dados')
  const [editForm, setEditForm] = useState<TenantFormState>(BLANK_TENANT_FORM)
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')

  // Usuários do tenant selecionado
  const [users, setUsers] = useState<UserItem[]>([])
  const [usersLoading, setUsersLoading] = useState(false)

  // Assinatura do tenant selecionado
  const [assinatura, setAssinatura] = useState<AssinaturaItem | null | undefined>(undefined) // undefined = não carregado
  const [planos, setPlanos] = useState<PlanoItem[]>([])
  const [assinaturaForm, setAssinaturaForm] = useState({ planoId: '', status: 'TRIAL', expiraEm: '', gateway: '', gatewayCustomerId: '', gatewaySubscriptionId: '', obs: '' })
  const [assinaturaSaving, setAssinaturaSaving] = useState(false)
  const [assinaturaError, setAssinaturaError] = useState('')
  const [assinaturaSaved, setAssinaturaSaved] = useState(false)

  // Sub-modal usuário (criar/editar)
  const [userModal, setUserModal] = useState<{ mode: 'create' | 'edit'; user?: UserItem } | null>(null)
  const [userForm, setUserForm] = useState<UserFormState>(BLANK_USER_FORM)
  const [userSaving, setUserSaving] = useState(false)
  const [userError, setUserError] = useState('')

  /* ── Fetch tenants ── */
  const fetchTenants = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/admin/tenants')
      if (!res.ok) { setError('Erro ao carregar estabelecimentos'); return }
      setTenants((await res.json()).tenants)
    } catch { setError('Falha de conexão') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchTenants() }, [fetchTenants])

  /* ── Fetch users do tenant selecionado ── */
  const fetchUsers = useCallback(async (tenantId: string) => {
    setUsersLoading(true)
    try {
      const res = await fetch(`/api/admin/users?tenantId=${tenantId}`)
      if (res.ok) setUsers((await res.json()).users)
    } catch {}
    finally { setUsersLoading(false) }
  }, [])

  /* ── Criar tenant ── */
  async function submitCreate() {
    const { nomeFantasia, razaoSocial, cnpj, endereco, telefone, alvaraSanitario } = createForm
    if (!nomeFantasia.trim() || !razaoSocial.trim() || !cnpj.trim() || !endereco.trim() || !telefone.trim() || !alvaraSanitario.trim()) {
      setCreateError('Todos os campos são obrigatórios'); return
    }
    setCreating(true); setCreateError('')
    try {
      const res = await fetch('/api/admin/tenants', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      })
      const json = await res.json()
      if (!res.ok) { setCreateError(json.error ?? 'Erro ao criar'); return }
      setShowCreate(false); fetchTenants()
    } catch { setCreateError('Falha de conexão') }
    finally { setCreating(false) }
  }

  /* ── Abrir detalhe ── */
  function openDetail(t: TenantItem) {
    setDetailTenant(t)
    setDetailTab('dados')
    setEditForm({ nomeFantasia: t.nomeFantasia, razaoSocial: t.razaoSocial, cnpj: fmtCnpjDisplay(t.cnpj),
      endereco: t.endereco, telefone: t.telefone, alvaraSanitario: t.alvaraSanitario,
      tipoImpressao: t.tipoImpressao, logoUrl: t.logoUrl })
    setEditError('')
    setUsers([])
  }

  const fetchAssinatura = useCallback(async (tenantId: string) => {
    setAssinatura(undefined)
    setAssinaturaError('')
    try {
      const [resA, resP] = await Promise.all([
        fetch(`/api/admin/assinaturas?tenantId=${tenantId}`),
        fetch('/api/admin/planos'),
      ])
      const planosData: PlanoItem[] = resP.ok ? (await resP.json()).planos : []
      setPlanos(planosData)

      if (resA.ok) {
        const { assinatura: a } = await resA.json()
        setAssinatura(a ?? null)
        if (a) {
          setAssinaturaForm({
            planoId: a.planoId, status: a.status,
            expiraEm: a.expiraEm ? a.expiraEm.slice(0, 10) : '',
            gateway: a.gateway ?? '', gatewayCustomerId: a.gatewayCustomerId ?? '',
            gatewaySubscriptionId: a.gatewaySubscriptionId ?? '', obs: a.obs ?? '',
          })
        } else {
          // Sem assinatura: pré-seleciona o primeiro plano ativo
          const primeiro = planosData.find(p => p.ativo)
          setAssinaturaForm({ planoId: primeiro?.id ?? '', status: 'ATIVA', expiraEm: '', gateway: '', gatewayCustomerId: '', gatewaySubscriptionId: '', obs: '' })
        }
      }
    } catch { setAssinaturaError('Erro ao carregar assinatura') }
  }, [])

  async function submitAssinatura() {
    if (!detailTenant || !assinaturaForm.planoId) { setAssinaturaError('Selecione um plano'); return }
    setAssinaturaSaving(true); setAssinaturaError(''); setAssinaturaSaved(false)
    try {
      const method = assinatura ? 'PATCH' : 'POST'
      const url = assinatura ? `/api/admin/assinaturas/${assinatura.id}` : '/api/admin/assinaturas'
      const body = assinatura
        ? { status: assinaturaForm.status, planoId: assinaturaForm.planoId, expiraEm: assinaturaForm.expiraEm || null, gateway: assinaturaForm.gateway || null, gatewayCustomerId: assinaturaForm.gatewayCustomerId || null, gatewaySubscriptionId: assinaturaForm.gatewaySubscriptionId || null, obs: assinaturaForm.obs || null }
        : { tenantId: detailTenant.id, ...assinaturaForm, expiraEm: assinaturaForm.expiraEm || null, gateway: assinaturaForm.gateway || null, gatewayCustomerId: assinaturaForm.gatewayCustomerId || null, gatewaySubscriptionId: assinaturaForm.gatewaySubscriptionId || null, obs: assinaturaForm.obs || null }
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const text = await res.text()
      let json: Record<string, unknown> = {}
      try { json = JSON.parse(text) } catch { /* resposta não-JSON */ }
      if (!res.ok) { setAssinaturaError(json.error as string ?? `Erro ${res.status}: ${text.slice(0, 120)}`); return }
      setAssinatura(json.assinatura as AssinaturaItem)
      setAssinaturaSaved(true)
      setTimeout(() => setAssinaturaSaved(false), 3000)
    } catch (e) { setAssinaturaError(`Falha: ${e instanceof Error ? e.message : String(e)}`) }
    finally { setAssinaturaSaving(false) }
  }

  function switchTab(tab: 'dados' | 'usuarios' | 'assinatura') {
    setDetailTab(tab)
    if (tab === 'usuarios' && detailTenant) fetchUsers(detailTenant.id)
    if (tab === 'assinatura' && detailTenant) fetchAssinatura(detailTenant.id)
  }

  /* ── Salvar dados tenant ── */
  async function submitEdit() {
    if (!detailTenant) return
    const { nomeFantasia, razaoSocial, cnpj, endereco, telefone, alvaraSanitario } = editForm
    if (!nomeFantasia.trim() || !razaoSocial.trim() || !cnpj.trim() || !endereco.trim() || !telefone.trim() || !alvaraSanitario.trim()) {
      setEditError('Todos os campos são obrigatórios'); return
    }
    setSaving(true); setEditError('')
    try {
      const res = await fetch(`/api/admin/tenants/${detailTenant.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      const json = await res.json()
      if (!res.ok) { setEditError(json.error ?? 'Erro ao salvar'); return }
      setDetailTenant((t) => t ? { ...t, ...json.tenant } : t)
      fetchTenants()
    } catch { setEditError('Falha de conexão') }
    finally { setSaving(false) }
  }

  /* ── Toggle ativo tenant ── */
  async function toggleAtivo(t: TenantItem) {
    try {
      await fetch(`/api/admin/tenants/${t.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: !t.ativo }),
      })
      fetchTenants()
      if (detailTenant?.id === t.id) setDetailTenant((d) => d ? { ...d, ativo: !d.ativo } : d)
    } catch {}
  }

  /* ── Sub-modal usuário ── */
  function openCreateUser() {
    setUserForm(BLANK_USER_FORM); setUserError(''); setUserModal({ mode: 'create' })
  }
  function openEditUser(u: UserItem) {
    setUserForm({ nome: u.nome, email: u.email, senha: '', crf: u.crf ?? '', permissions: [...u.permissions] })
    setUserError(''); setUserModal({ mode: 'edit', user: u })
  }

  async function submitUserForm() {
    if (!detailTenant) return
    const { nome, email, senha, permissions, crf } = userForm
    if (!nome.trim() || !email.trim() || !permissions.length || (userModal?.mode === 'create' && !senha)) {
      setUserError('Nome, e-mail, senha e ao menos uma permissão são obrigatórios'); return
    }
    setUserSaving(true); setUserError('')
    try {
      const isCreate = userModal?.mode === 'create'
      const url = isCreate ? '/api/admin/users' : `/api/admin/users/${userModal!.user!.id}`
      const body: Record<string, unknown> = { nome: nome.trim(), email: email.trim(), permissions, crf: crf.trim() || null }
      if (isCreate) { body.tenantId = detailTenant.id; body.senha = senha }
      else if (senha) body.senha = senha

      const res = await fetch(url, {
        method: isCreate ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) { setUserError(json.error ?? 'Erro ao salvar'); return }
      setUserModal(null)
      fetchUsers(detailTenant.id)
      fetchTenants()
    } catch { setUserError('Falha de conexão') }
    finally { setUserSaving(false) }
  }

  async function toggleUserAtivo(u: UserItem) {
    if (!detailTenant) return
    try {
      await fetch(`/api/admin/users/${u.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: !u.ativo }),
      })
      fetchUsers(detailTenant.id)
    } catch {}
  }

  function toggleUserPerm(p: string) {
    setUserForm((f) => ({
      ...f,
      permissions: f.permissions.includes(p) ? f.permissions.filter((x) => x !== p) : [...f.permissions, p],
    }))
  }

  const ativos = tenants.filter((t) => t.ativo).length

  /* ─── Render ─────────────────────────────────────────────────────────────────── */
  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Painel Global SaaS</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {tenants.length} estabelecimento{tenants.length !== 1 ? 's' : ''} — {ativos} ativo{ativos !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={() => { setCreateForm(BLANK_TENANT_FORM); setCreateError(''); setShowCreate(true) }}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Novo Estabelecimento
        </button>
      </div>

      {error && <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">{error}</div>}

      {/* ── Tabela ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="ml-3 text-sm text-slate-500">Carregando...</span>
          </div>
        ) : tenants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-sm text-slate-400">Nenhum estabelecimento cadastrado</p>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Logo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Estabelecimento</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">CNPJ</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Impressão</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Usuários</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">DSFs</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Plano</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tenants.map((t) => (
                    <tr key={t.id} className={`hover:bg-slate-50 transition-colors ${!t.ativo ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3">
                        {t.logoUrl
                          ? <img src={t.logoUrl} alt={t.nomeFantasia} className="h-8 w-16 object-contain rounded" />
                          : <div className="h-8 w-16 bg-slate-100 rounded flex items-center justify-center text-[10px] text-slate-400 text-center leading-tight px-1">{t.nomeFantasia}</div>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{t.nomeFantasia}</p>
                        <p className="text-xs text-slate-400">{t.razaoSocial}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{fmtCnpjDisplay(t.cnpj)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium ${t.tipoImpressao === 'BOBINA_80MM' ? 'bg-slate-100 text-slate-600' : 'bg-indigo-100 text-indigo-700'}`}>
                          {t.tipoImpressao === 'BOBINA_80MM' ? '80mm' : 'A4'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600">{t._count.users}</td>
                      <td className="px-4 py-3 text-center text-slate-600">{t._count.dsfs}</td>
                      <td className="px-4 py-3">
                        {t.assinatura ? (
                          <div>
                            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium ${
                              t.assinatura.plano.tipo === 'VITALICIO' ? 'bg-green-100 text-green-700' :
                              t.assinatura.plano.tipo === 'ANUAL' ? 'bg-purple-100 text-purple-700' :
                              t.assinatura.plano.tipo === 'MENSAL' ? 'bg-blue-100 text-blue-700' :
                              'bg-amber-100 text-amber-700'
                            }`}>
                              {t.assinatura.plano.nome}
                            </span>
                            <p className={`text-[10px] mt-0.5 ${
                              t.assinatura.status === 'ATIVA' ? 'text-green-600' :
                              t.assinatura.status === 'TRIAL' ? 'text-amber-600' :
                              'text-red-500'
                            }`}>
                              {t.assinatura.status}
                              {t.assinatura.expiraEm && t.assinatura.status === 'TRIAL' &&
                                ` até ${new Date(t.assinatura.expiraEm).toLocaleDateString('pt-BR')}`}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${t.ativo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                          {t.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={() => openDetail(t)}
                            className="px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                            Detalhes
                          </button>
                          <button onClick={() => toggleAtivo(t)}
                            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${t.ativo ? 'text-red-700 bg-red-50 hover:bg-red-100' : 'text-green-700 bg-green-50 hover:bg-green-100'}`}>
                            {t.ativo ? 'Desativar' : 'Ativar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="lg:hidden divide-y divide-slate-100">
              {tenants.map((t) => (
                <div key={t.id} className={`p-4 ${!t.ativo ? 'opacity-50' : ''}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-slate-800">{t.nomeFantasia}</p>
                      <p className="text-xs text-slate-400">{fmtCnpjDisplay(t.cnpj)}</p>
                    </div>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${t.ativo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {t.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
                    <span>{t._count.users} usuário{t._count.users !== 1 ? 's' : ''}</span>
                    <span>·</span><span>{t._count.dsfs} DSFs</span>
                    <span>·</span><span>{t.tipoImpressao === 'BOBINA_80MM' ? '80mm' : 'A4'}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openDetail(t)} className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">Detalhes</button>
                    <button onClick={() => toggleAtivo(t)} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${t.ativo ? 'text-red-700 bg-red-50 hover:bg-red-100' : 'text-green-700 bg-green-50 hover:bg-green-100'}`}>
                      {t.ativo ? 'Desativar' : 'Ativar'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50">
              <p className="text-xs text-slate-400">{tenants.length} estabelecimento{tenants.length !== 1 ? 's' : ''}</p>
            </div>
          </>
        )}
      </div>

      {/* ── Modal Criar Tenant ── */}
      {showCreate && (
        <Modal title="Novo Estabelecimento" onClose={() => !creating && setShowCreate(false)}>
          <TenantForm form={createForm} onChange={setCreateForm} error={createError}
            loading={creating} onSubmit={submitCreate} onCancel={() => setShowCreate(false)}
            submitLabel="Cadastrar Estabelecimento" />
        </Modal>
      )}

      {/* ── Modal Detalhe Tenant (abas) ── */}
      {detailTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !saving && setDetailTenant(null)} />
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
              <div className="flex items-center gap-3">
                {detailTenant.logoUrl
                  ? <img src={detailTenant.logoUrl} alt={detailTenant.nomeFantasia} className="h-8 w-14 object-contain rounded" />
                  : <div className="h-8 w-14 bg-slate-100 rounded flex items-center justify-center text-[10px] text-slate-400 text-center leading-tight px-1">{detailTenant.nomeFantasia}</div>
                }
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{detailTenant.nomeFantasia}</h3>
                  <p className="text-xs text-slate-400">{fmtCnpjDisplay(detailTenant.cnpj)}</p>
                </div>
              </div>
              <button onClick={() => setDetailTenant(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-100 px-6 flex-shrink-0">
              {(['dados', 'usuarios', 'assinatura'] as const).map((tab) => (
                <button key={tab} onClick={() => switchTab(tab)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${detailTab === tab ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                  {tab === 'dados' ? 'Dados' : tab === 'usuarios' ? `Usuários (${detailTenant._count.users})` : 'Assinatura'}
                </button>
              ))}
            </div>

            <div className="overflow-y-auto flex-1">
              {/* ── Tab Dados ── */}
              {detailTab === 'dados' && (
                <TenantForm form={editForm} onChange={setEditForm} error={editError}
                  loading={saving} onSubmit={submitEdit} onCancel={() => setDetailTenant(null)}
                  submitLabel="Salvar Alterações" cancelLabel="Fechar" />
              )}

              {/* ── Tab Usuários ── */}
              {detailTab === 'usuarios' && (
                <div>
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <p className="text-xs text-slate-500">Usuários vinculados a este estabelecimento</p>
                    <button onClick={openCreateUser}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      Novo Usuário
                    </button>
                  </div>

                  {usersLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : users.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <p className="text-sm text-slate-400">Nenhum usuário cadastrado</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {users.map((u) => (
                        <div key={u.id} className={`px-6 py-4 ${!u.ativo ? 'opacity-50' : ''}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-medium text-slate-800 text-sm">{u.nome}</p>
                              <p className="text-xs text-slate-400">{u.email}</p>
                              {u.crf && <p className="text-xs text-blue-600 mt-0.5">{u.crf}</p>}
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {u.permissions.map((p) => (
                                  <span key={p} className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${PERM_COLORS[p] ?? 'bg-slate-100 text-slate-600'}`}>
                                    {PERM_LABEL[p] ?? p}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${u.ativo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                {u.ativo ? 'Ativo' : 'Inativo'}
                              </span>
                              <button onClick={() => openEditUser(u)}
                                className="px-2.5 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                                Editar
                              </button>
                              <button onClick={() => toggleUserAtivo(u)}
                                className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${u.ativo ? 'text-red-700 bg-red-50 hover:bg-red-100' : 'text-green-700 bg-green-50 hover:bg-green-100'}`}>
                                {u.ativo ? 'Desativar' : 'Ativar'}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Tab Assinatura ── */}
              {detailTab === 'assinatura' && (
                <div className="p-6 space-y-6">
                  {assinatura === undefined ? (
                    <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
                  ) : (
                    <>
                      {/* Formulário de assinatura */}
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">Plano</label>
                          <select value={assinaturaForm.planoId} onChange={e => setAssinaturaForm(f => ({ ...f, planoId: e.target.value }))}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="">Selecione um plano…</option>
                            {planos.filter(p => p.ativo).map(p => (
                              <option key={p.id} value={p.id}>
                                {p.nome} — {p.tipo}
                                {p.precoMensal ? ` · R$ ${(p.precoMensal / 100).toFixed(2)}/mês` : ''}
                                {p.precoAnual ? ` · R$ ${(p.precoAnual / 100).toFixed(2)}/ano` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
                          <select value={assinaturaForm.status} onChange={e => setAssinaturaForm(f => ({ ...f, status: e.target.value }))}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                            {['TRIAL','ATIVA','SUSPENSA','CANCELADA','EXPIRADA'].map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">Expira em (deixe vazio = vitalício)</label>
                          <input type="date" value={assinaturaForm.expiraEm} onChange={e => setAssinaturaForm(f => ({ ...f, expiraEm: e.target.value }))}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Gateway</label>
                            <select value={assinaturaForm.gateway} onChange={e => setAssinaturaForm(f => ({ ...f, gateway: e.target.value }))}
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                              <option value="">Nenhum</option>
                              <option value="stripe">Stripe</option>
                              <option value="asaas">Asaas</option>
                              <option value="mercadopago">Mercado Pago</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Customer ID</label>
                            <input value={assinaturaForm.gatewayCustomerId} onChange={e => setAssinaturaForm(f => ({ ...f, gatewayCustomerId: e.target.value }))}
                              placeholder="cus_…"
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Subscription ID</label>
                            <input value={assinaturaForm.gatewaySubscriptionId} onChange={e => setAssinaturaForm(f => ({ ...f, gatewaySubscriptionId: e.target.value }))}
                              placeholder="sub_…"
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">Observações internas</label>
                          <textarea rows={2} value={assinaturaForm.obs} onChange={e => setAssinaturaForm(f => ({ ...f, obs: e.target.value }))}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                        </div>
                        {assinaturaError && <p className="text-xs text-red-600">{assinaturaError}</p>}
                        {assinaturaSaved && <p className="text-xs text-green-600">Assinatura salva com sucesso.</p>}
                        <button onClick={submitAssinatura} disabled={assinaturaSaving}
                          className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
                          {assinaturaSaving ? 'Salvando…' : assinatura ? 'Salvar Alterações' : 'Criar Assinatura'}
                        </button>

                        {/* Link de pagamento Stripe */}
                        {assinaturaForm.planoId && detailTenant && (() => {
                          const planoSel = planos.find(p => p.id === assinaturaForm.planoId)
                          return planoSel ? <CheckoutButton tenantId={detailTenant.id} plano={planoSel} /> : null
                        })()}
                      </div>

                      {/* Histórico de pagamentos */}
                      {assinatura && assinatura.pagamentos.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Histórico de Pagamentos</p>
                          <div className="space-y-2">
                            {assinatura.pagamentos.map(p => (
                              <div key={p.id} className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-3 py-2">
                                <div>
                                  <span className="font-medium text-slate-800">
                                    {(p.valor / 100).toLocaleString('pt-BR', { style: 'currency', currency: p.moeda })}
                                  </span>
                                  <span className="text-slate-400 ml-2">{p.gateway}</span>
                                  {p.descricao && <span className="text-slate-400 ml-2">· {p.descricao}</span>}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`px-1.5 py-0.5 rounded font-medium ${
                                    p.status === 'APROVADO' ? 'bg-green-100 text-green-700' :
                                    p.status === 'RECUSADO' ? 'bg-red-100 text-red-700' :
                                    p.status === 'REEMBOLSADO' ? 'bg-amber-100 text-amber-700' :
                                    'bg-slate-100 text-slate-600'
                                  }`}>{p.status}</span>
                                  <span className="text-slate-400">{new Date(p.createdAt).toLocaleDateString('pt-BR')}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {assinatura && assinatura.pagamentos.length === 0 && (
                        <p className="text-xs text-slate-400 text-center py-4">Nenhum pagamento registrado.</p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Sub-modal Usuário ── */}
      {userModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !userSaving && setUserModal(null)} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
              <h3 className="text-sm font-bold text-slate-900">
                {userModal.mode === 'create' ? 'Novo Usuário' : `Editar — ${userModal.user?.nome}`}
              </h3>
              <button onClick={() => setUserModal(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Nome completo</label>
                  <input type="text" value={userForm.nome}
                    onChange={(e) => setUserForm((f) => ({ ...f, nome: e.target.value }))}
                    placeholder="Ex: Maria Santos"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">E-mail</label>
                  <input type="email" value={userForm.email}
                    onChange={(e) => setUserForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="maria@drogaria.com"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">CRF <span className="text-slate-400 font-normal">(opcional)</span></label>
                  <input type="text" value={userForm.crf}
                    onChange={(e) => setUserForm((f) => ({ ...f, crf: e.target.value }))}
                    placeholder="CRF-SP-00000"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Senha {userModal.mode === 'edit' && <span className="text-slate-400 font-normal">(deixe em branco para não alterar)</span>}
                  </label>
                  <input type="password" value={userForm.senha}
                    onChange={(e) => setUserForm((f) => ({ ...f, senha: e.target.value }))}
                    placeholder={userModal.mode === 'create' ? 'Mínimo 8 caracteres' : '••••••••'}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">Permissões</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ALL_PERMISSIONS.map((p) => {
                    const active = userForm.permissions.includes(p.value)
                    return (
                      <button key={p.value} type="button" onClick={() => toggleUserPerm(p.value)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium text-left transition-colors ${active ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
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

              {userError && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{userError}</p>}

              <div className="flex gap-2 pt-1">
                <button onClick={() => setUserModal(null)} disabled={userSaving}
                  className="flex-1 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 transition-colors">
                  Cancelar
                </button>
                <button onClick={submitUserForm} disabled={userSaving}
                  className="flex-1 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-60 transition-colors">
                  {userSaving ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Salvando...
                    </span>
                  ) : userModal.mode === 'create' ? 'Criar Usuário' : 'Salvar Alterações'}
                </button>
              </div>
            </div>
          </div>
        </div>
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

/* ─── TenantForm ─────────────────────────────────────────────────────────────── */

function TenantForm({ form, onChange, error, loading, onSubmit, onCancel, submitLabel, cancelLabel = 'Cancelar' }: {
  form: TenantFormState
  onChange: (f: TenantFormState) => void
  error: string
  loading: boolean
  onSubmit: () => void
  onCancel: () => void
  submitLabel: string
  cancelLabel?: string
}) {
  async function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try { onChange({ ...form, logoUrl: await resizeLogo(file) }) } catch {}
    e.target.value = ''
  }

  return (
    <div className="px-6 py-5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">Nome Fantasia</label>
          <input type="text" value={form.nomeFantasia} onChange={(e) => onChange({ ...form, nomeFantasia: e.target.value })}
            placeholder="Ex: Farmácia Central"
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">Razão Social</label>
          <input type="text" value={form.razaoSocial} onChange={(e) => onChange({ ...form, razaoSocial: e.target.value })}
            placeholder="Ex: Farmácia Central Ltda"
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">CNPJ</label>
          <input type="text" value={form.cnpj} onChange={(e) => onChange({ ...form, cnpj: fmtCnpj(e.target.value) })}
            placeholder="00.000.000/0000-00" maxLength={18}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Telefone</label>
          <input type="text" value={form.telefone} onChange={(e) => onChange({ ...form, telefone: fmtTel(e.target.value) })}
            placeholder="(00) 00000-0000" maxLength={15}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">Endereço</label>
          <input type="text" value={form.endereco} onChange={(e) => onChange({ ...form, endereco: e.target.value })}
            placeholder="Rua, número, bairro, cidade — UF"
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Nº Alvará Sanitário</label>
          <input type="text" value={form.alvaraSanitario} onChange={(e) => onChange({ ...form, alvaraSanitario: e.target.value })}
            placeholder="Ex: VISA-SP-2024-00000"
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de Impressão</label>
          <select value={form.tipoImpressao} onChange={(e) => onChange({ ...form, tipoImpressao: e.target.value })}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="BOBINA_80MM">Cupom Térmico 80mm</option>
            <option value="FOLHA_A4">Relatório A4</option>
          </select>
        </div>
      </div>

      {/* Logo */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-2">
          Logo <span className="text-slate-400 font-normal">(opcional — max 320×160px)</span>
        </label>
        <div className="flex items-center gap-3">
          <div className="w-24 h-12 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden flex-shrink-0">
            {form.logoUrl
              ? <img src={form.logoUrl} alt="preview" className="w-full h-full object-contain" />
              : <span className="text-[10px] text-slate-400 text-center px-1 leading-tight">{form.nomeFantasia || 'Sem logo'}</span>
            }
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              {form.logoUrl ? 'Trocar logo' : 'Enviar logo'}
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoFile} />
            </label>
            {form.logoUrl && (
              <button type="button" onClick={() => onChange({ ...form, logoUrl: null })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-100 rounded-lg hover:bg-red-50 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Remover logo
              </button>
            )}
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex items-center gap-2 pt-1">
        <button onClick={onCancel} disabled={loading}
          className="flex-1 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 transition-colors">
          {cancelLabel}
        </button>
        <button onClick={onSubmit} disabled={loading}
          className="flex-1 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-60 transition-colors">
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
