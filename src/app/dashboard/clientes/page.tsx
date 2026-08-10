'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { DsfSignatureModal } from '@/components/dsf-signature-modal'

/* ─── Types ──────────────────────────────────────────────────────────────────── */

interface ClienteData {
  id: string; nome: string; cpf: string; rg: string | null
  dataNascimento: string; sexo: string; telefone: string
  email: string | null; endereco: string; updatedAt: string
}
interface AddrForm {
  cep: string; logradouro: string; numero: string
  complemento: string; bairro: string; cidade: string; uf: string
}
interface EditForm { nome: string; telefone: string; email: string; rg: string }
interface RegForm { nome: string; dataNascimento: string; sexo: string; telefone: string; email: string; rg: string }
interface InsumoForm { _key: string; nomeProduto: string; lote: string; fabricante: string; validade: string }
interface DsfForm { tipoServico: string; observacoes: string; insumos: InsumoForm[] }
interface DsfHistoryItem {
  id: string; numeroDsf: string; tipoServico: string; tipoServicoLabel: string
  dataEmissao: string; status: 'EMITIDA' | 'CONCLUIDA' | 'CANCELADA'
  driveFileId: string | null; observacoes: string | null
  rtNome: string; rtCrf: string | null
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
  tipoImpressao: 'BOBINA_80MM' | 'FOLHA_A4'
  rtNome: string
  rtCrf: string | null
  clienteNome: string
  clienteCpf: string
  clienteDataNasc: string
  clienteTelefone: string
  clienteEmail: string | null
  tipoServico: string
  tipoServicoLabel: string
  textoOrientacao: string | null
  observacoes: string | null
  insumos: { nomeProduto: string; lote: string; fabricante: string; validade: string }[]
}

type Mode =
  | 'idle' | 'searching' | 'not_found'
  | 'registering' | 'registering_saving'
  | 'viewing' | 'editing' | 'saving'
  | 'emitting' | 'submitting_dsf'
  | 'dsf_generated' | 'dsf_scanning' | 'dsf_uploading' | 'dsf_concluida'

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

function fmtCpf(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
}
function fmtTel(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  return d.length <= 10
    ? d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2')
    : d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2')
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
}
function fmtCpfDisplay(cpf: string) {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

/* ─── Constants ──────────────────────────────────────────────────────────────── */

const BLANK_ADDR: AddrForm = { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '' }
const BLANK_INSUMO = (): InsumoForm => ({ _key: crypto.randomUUID(), nomeProduto: '', lote: '', fabricante: '', validade: '' })
const BLANK_REG: RegForm = { nome: '', dataNascimento: '', sexo: '', telefone: '', email: '', rg: '' }

/* ─── Page ───────────────────────────────────────────────────────────────────── */

interface HistoricoItem {
  id: string; numeroDsf: string; tipoServico: string; tipoServicoLabel: string
  dataEmissao: string; status: 'EMITIDA' | 'CONCLUIDA' | 'CANCELADA'
  clienteId: string; clienteNome: string; clienteCpf: string; clienteEmail: string | null
  rtNome: string; rtCrf: string | null
  driveFileId: string | null
}

type Tab = 'clientes' | 'historico'

export default function ClientesPage() {
  const searchParams = useSearchParams()

  const [activeTab, setActiveTab] = useState<Tab>('clientes')
  const [historico, setHistorico] = useState<HistoricoItem[]>([])
  const [historicoLoading, setHistoricoLoading] = useState(false)
  const [historicoError, setHistoricoError] = useState<string | null>(null)
  const [historicoTotal, setHistoricoTotal] = useState(0)

  const [mode, setMode] = useState<Mode>('idle')
  const [cpfInput, setCpfInput] = useState('')
  const [searchedCpf, setSearchedCpf] = useState('')

  /* autocomplete */
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<{ id: string; nome: string; cpf: string; dataNascimento: string | null }[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const searchContainerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [cliente, setCliente] = useState<ClienteData | null>(null)
  const [receiptDsf, setReceiptDsf] = useState<ReceiptDsf | null>(null)
  const [showSignModal, setShowSignModal] = useState(false)
  const [signResult, setSignResult] = useState<{ hash: string; timestamp: string; emailEnviado: boolean } | null>(null)
  const [historicoSignDsfId, setHistoricoSignDsfId] = useState<string | null>(null)
  const [dsfHistory, setDsfHistory] = useState<DsfHistoryItem[]>([])
  const [dsfHistoryLoading, setDsfHistoryLoading] = useState(false)

  /* camera / capture */
  const [isMobile, setIsMobile] = useState(false)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [cameraError, setCameraError] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [addr, setAddr] = useState<AddrForm>(BLANK_ADDR)
  const [cepLoading, setCepLoading] = useState(false)
  const [cepError, setCepError] = useState('')

  const [editForm, setEditForm] = useState<EditForm>({ nome: '', telefone: '', email: '', rg: '' })
  const [saveError, setSaveError] = useState('')

  const [regForm, setRegForm] = useState<RegForm>(BLANK_REG)
  const [regCpf, setRegCpf] = useState('')
  const [regLgpd, setRegLgpd] = useState(false)
  const [regError, setRegError] = useState('')

  const [dsfForm, setDsfForm] = useState<DsfForm>({ tipoServico: '', observacoes: '', insumos: [] })
  const [dsfError, setDsfError] = useState('')
  const [procedimentoOptions, setProcedimentoOptions] = useState<{ value: string; label: string }[]>([])

  /* ── Load active procedures for this tenant ─────────────────────────────────── */

  useEffect(() => {
    fetch('/api/procedimentos')
      .then((r) => r.json())
      .then((d) => { if (d.options) setProcedimentoOptions(d.options) })
      .catch(() => {})
  }, [])

  /* ── Detect mobile/touch device ─────────────────────────────────────────────── */

  useEffect(() => {
    setIsMobile(window.matchMedia('(pointer: coarse)').matches)
  }, [])

  /* ── Camera effect (start/stop based on mode) ───────────────────────────────── */

  useEffect(() => {
    if (mode !== 'dsf_scanning') {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      return
    }
    setCapturedImage(null)
    setCameraError('')

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 2560 } },
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }
      } catch {
        setCameraError('Não foi possível acessar a câmera. Verifique as permissões do navegador.')
      }
    }
    startCamera()

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
    }
  }, [mode])

  /* ── Auto-search from query param (redirect from CpfSearch widget) ─────────── */

  useEffect(() => {
    const cpfParam = searchParams.get('cpf')
    if (!cpfParam || cpfParam.length < 11) return
    const digits = cpfParam.replace(/\D/g, '')
    if (digits.length !== 11) return
    const formatted = digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
    setCpfInput(formatted)
    setSearchQuery(formatted)
    runSearch(digits)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── Autocomplete ───────────────────────────────────────────────────────────── */

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) { setSuggestions([]); setShowSuggestions(false); return }
    setSuggestLoading(true)
    try {
      const res = await fetch(`/api/clients/search?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data = await res.json()
        setSuggestions(Array.isArray(data) ? data : data ? [data] : [])
        setShowSuggestions(true)
      }
    } finally {
      setSuggestLoading(false)
    }
  }, [])

  function handleSearchQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    const looksLikeCpf = /^[\d.\-]+$/.test(raw)
    const val = looksLikeCpf ? fmtCpf(raw) : raw
    setSearchQuery(val)
    setCpfInput(looksLikeCpf ? val : '')
    if (mode !== 'idle') setMode('idle')

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const q = looksLikeCpf ? val.replace(/\D/g, '') : val
      fetchSuggestions(q)
    }, 300)
  }

  function handleSuggestionSelect(s: { id: string; nome: string; cpf: string }) {
    setShowSuggestions(false)
    const formatted = fmtCpf(s.cpf)
    setSearchQuery(formatted)
    setCpfInput(formatted)
    runSearch(s.cpf)
  }

  /* ── Search ─────────────────────────────────────────────────────────────────── */

  async function runSearch(digits: string) {
    setMode('searching')
    try {
      const res = await fetch(`/api/clients/search?cpf=${digits}`)
      if (res.status === 404) {
        setSearchedCpf(digits)
        setMode('not_found')
        return
      }
      if (!res.ok) throw new Error()
      const data: ClienteData = await res.json()
      setCliente(data)
      setMode('viewing')
      setDsfHistory([])
      setDsfHistoryLoading(true)
      fetch(`/api/clients/${data.id}/dsfs`)
        .then((r) => r.json())
        .then((j) => setDsfHistory(j.dsfs ?? []))
        .catch(() => {})
        .finally(() => setDsfHistoryLoading(false))
    } catch {
      setMode('idle')
    }
  }

  async function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setShowSuggestions(false)
    const digits = searchQuery.replace(/\D/g, '')
    if (digits.length === 11) {
      await runSearch(digits)
    } else if (suggestions.length === 1) {
      handleSuggestionSelect(suggestions[0])
    }
  }

  /* ── Register ───────────────────────────────────────────────────────────────── */

  function openRegister(cpfDigits?: string) {
    setRegForm(BLANK_REG)
    setRegCpf(cpfDigits ?? searchedCpf)
    setAddr(BLANK_ADDR)
    setCepError('')
    setRegError('')
    setRegLgpd(false)
    setMode('registering')
  }

  async function handleSubmitReg() {
    setRegError('')
    const cpfFinal = regCpf || searchedCpf
    if (!cpfFinal || cpfFinal.replace(/\D/g, '').length !== 11) {
      setRegError('CPF inválido.'); return
    }
    const dnParts = regForm.dataNascimento ? regForm.dataNascimento.split('-') : []
    const dnOk = dnParts.length === 3 && dnParts[0] && dnParts[1] && dnParts[2]
    if (!regForm.nome.trim() || !dnOk || !regForm.sexo || !regForm.telefone.trim()) {
      setRegError('Preencha todos os campos obrigatórios.'); return
    }
    if (!addr.logradouro.trim() || !addr.numero.trim() || !addr.bairro.trim() || !addr.cidade.trim() || !addr.uf.trim()) {
      setRegError('Preencha o endereço completo.'); return
    }
    if (!regLgpd) {
      setRegError('O consentimento LGPD é obrigatório.'); return
    }
    setMode('registering_saving')
    try {
      const res = await fetch('/api/clients/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cpf: cpfFinal.replace(/\D/g, ''),
          nome: regForm.nome,
          dataNascimento: regForm.dataNascimento,
          sexo: regForm.sexo,
          telefone: regForm.telefone,
          email: regForm.email || undefined,
          rg: regForm.rg || undefined,
          endereco: addr,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        setRegError(err.error ?? 'Erro ao cadastrar.')
        setMode('registering')
        return
      }
      const data: ClienteData = await res.json()
      setCliente(data)
      setMode('viewing')
    } catch {
      setRegError('Erro de conexão. Tente novamente.')
      setMode('registering')
    }
  }

  /* ── Edit ───────────────────────────────────────────────────────────────────── */

  function openEdit() {
    if (!cliente) return
    setEditForm({ nome: cliente.nome, telefone: cliente.telefone, email: cliente.email ?? '', rg: cliente.rg ?? '' })
    setAddr(BLANK_ADDR)
    setCepError('')
    setSaveError('')
    setMode('editing')
  }

  async function handleSaveEdit() {
    if (!cliente) return
    setSaveError('')
    const endOk = addr.cep && addr.logradouro && addr.numero && addr.bairro && addr.cidade && addr.uf
    setMode('saving')
    try {
      const res = await fetch('/api/clients/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: cliente.id,
          nome: editForm.nome,
          telefone: editForm.telefone,
          email: editForm.email || undefined,
          rg: editForm.rg || undefined,
          endereco: endOk ? addr : cliente.endereco,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        setSaveError(err.error ?? 'Erro ao salvar.')
        setMode('editing')
        return
      }
      const data: ClienteData = await res.json()
      setCliente(data)
      setMode('viewing')
    } catch {
      setSaveError('Erro de conexão.')
      setMode('editing')
    }
  }

  /* ── ViaCEP ─────────────────────────────────────────────────────────────────── */

  async function handleCepLookup() {
    const cep = addr.cep.replace(/\D/g, '')
    if (cep.length !== 8) return
    setCepLoading(true)
    setCepError('')
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
      const data = await res.json()
      if (data.erro) { setCepError('CEP não encontrado.'); return }
      setAddr(p => ({ ...p, logradouro: data.logradouro ?? '', bairro: data.bairro ?? '', cidade: data.localidade ?? '', uf: data.uf ?? '' }))
    } catch { setCepError('Erro ao consultar o CEP.') }
    finally { setCepLoading(false) }
  }

  /* ── DSF ────────────────────────────────────────────────────────────────────── */

  function openEmit() {
    setDsfForm({ tipoServico: '', observacoes: '', insumos: [] })
    setDsfError('')
    setMode('emitting')
  }

  async function handleSubmitDsf() {
    if (!cliente) return
    setDsfError('')
    if (!dsfForm.tipoServico) { setDsfError('Selecione o tipo de serviço.'); return }
    const incompleto = dsfForm.insumos.find(i => !i.nomeProduto.trim() || !i.lote.trim() || !i.fabricante.trim() || !i.validade)
    if (incompleto) { setDsfError('Preencha todos os campos de cada insumo.'); return }
    setMode('submitting_dsf')
    try {
      const res = await fetch('/api/dsf/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteId: cliente.id,
          tipoServico: dsfForm.tipoServico,
          observacoes: dsfForm.observacoes || undefined,
          insumos: dsfForm.insumos.map(({ _key: _k, ...i }) => i),
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        setDsfError(err.error ?? 'Erro ao emitir DSF.')
        setMode('emitting')
        return
      }
      const data: ReceiptDsf = await res.json()
      setReceiptDsf(data)
      setMode('dsf_generated')
    } catch {
      setDsfError('Erro de conexão.')
      setMode('emitting')
    }
  }

  /* ── File select (desktop drag & drop / file input) ────────────────────────── */

  function handleFileSelect(file: File) {
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') return
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      if (result) setCapturedImage(result)
    }
    reader.readAsDataURL(file)
  }

  /* ── Camera utilities ───────────────────────────────────────────────────────── */

  function capturePhoto() {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    setCapturedImage(canvas.toDataURL('image/jpeg', 0.9))
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }

  async function handleUploadSigned() {
    if (!receiptDsf || !capturedImage) return
    setUploadError('')
    setMode('dsf_uploading')
    try {
      const res = await fetch('/api/dsf/upload-signed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dsfId: receiptDsf.id, fileBase64: capturedImage }),
      })
      if (!res.ok) {
        const err = await res.json()
        setUploadError(err.error ?? 'Erro ao enviar imagem.')
        setMode('dsf_scanning')
        return
      }
      setMode('dsf_concluida')
    } catch {
      setUploadError('Erro de conexão. Tente novamente.')
      setMode('dsf_scanning')
    }
  }

  /* ── Render ─────────────────────────────────────────────────────────────────── */

  return (
    <div className="p-4 sm:p-8 max-w-2xl mx-auto">

      <div className="mb-4">
        <h1 className="text-xl font-bold text-slate-900">DSF</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-xl p-1 w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('clientes')}
          style={activeTab === 'clientes' ? { background: '#28B478', color: '#fff' } : {}}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'clientes' ? '' : 'text-slate-600 hover:text-slate-900'}`}
        >
          Clientes
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('historico')
            if (historico.length === 0 && !historicoLoading) {
              setHistoricoLoading(true)
              setHistoricoError(null)
              fetch('/api/dsf/list?page=1')
                .then(r => r.json())
                .then(d => {
                  if (d.error) setHistoricoError(d.error)
                  else { setHistorico(d.dsfs); setHistoricoTotal(d.total) }
                })
                .catch(() => setHistoricoError('Erro ao carregar histórico.'))
                .finally(() => setHistoricoLoading(false))
            }
          }}
          style={activeTab === 'historico' ? { background: '#28B478', color: '#fff' } : {}}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'historico' ? '' : 'text-slate-600 hover:text-slate-900'}`}
        >
          Histórico
        </button>
      </div>

      {/* ── ABA CLIENTES ── */}
      {activeTab === 'clientes' && (<>

      {/* Search — nome ou CPF com autocomplete */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 mb-5">
        <div ref={searchContainerRef} className="relative">
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchQueryChange}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                placeholder="Nome ou CPF do paciente"
                className="w-full pl-4 pr-9 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoComplete="off"
              />
              {searchQuery && (
                <button type="button" onClick={() => { setSearchQuery(''); setCpfInput(''); setSuggestions([]); setShowSuggestions(false); setMode('idle') }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={mode === 'searching' || (searchQuery.replace(/\D/g, '').length !== 11 && suggestions.length !== 1 && suggestions.length === 0)}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-700 text-white text-sm font-medium rounded-lg hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {mode === 'searching' || suggestLoading
                ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
                : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              }
              Buscar
            </button>
          </form>

          {/* Dropdown de sugestões */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-[88px] mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleSuggestionSelect(s)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-100 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">{s.nome}</p>
                    <p className="text-xs text-slate-400 font-mono">{fmtCpfDisplay(s.cpf)}</p>
                  </div>
                  {s.dataNascimento && (
                    <span className="text-xs text-slate-400 shrink-0 ml-3">
                      {new Date(s.dataNascimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {showSuggestions && suggestions.length === 0 && searchQuery.length >= 2 && !suggestLoading && (
            <div className="absolute top-full left-0 right-[88px] mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 px-4 py-3 text-sm text-slate-400">
              Nenhum paciente encontrado
            </div>
          )}
        </div>

        <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={() => openRegister('')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Novo Cliente
          </button>
        </div>
      </div>

      {/* ── NOT FOUND ── */}
      {mode === 'not_found' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-700">CPF não cadastrado</p>
          <p className="text-xs text-slate-400 mt-1 font-mono">{fmtCpfDisplay(searchedCpf)}</p>
          <button
            type="button"
            onClick={() => openRegister()}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Cadastrar novo cliente
          </button>
        </div>
      )}

      {/* ── REGISTER FORM ── */}
      {(mode === 'registering' || mode === 'registering_saving') && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800">Novo cadastro de paciente</p>
              {regCpf
                ? <p className="text-xs text-slate-400 font-mono mt-0.5">{fmtCpfDisplay(regCpf)}</p>
                : <input
                    type="text"
                    value={regCpf}
                    placeholder="CPF do paciente *"
                    maxLength={14}
                    onChange={e => setRegCpf(fmtCpf(e.target.value))}
                    disabled={mode === 'registering_saving'}
                    className="mt-1 w-48 px-2 py-1 text-xs font-mono border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
              }
            </div>
            <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded-full font-medium ml-3">Novo</span>
          </div>

          <div className="p-5 space-y-5">
            {regError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2.5 text-sm">
                <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                {regError}
              </div>
            )}

            {/* Dados Pessoais */}
            <section>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Dados Pessoais</p>
              <div className="space-y-3">
                <F label="Nome completo *">
                  <input type="text" value={regForm.nome} onChange={e => setRegForm(p => ({ ...p, nome: e.target.value }))}
                    className={inp} placeholder="Nome como no documento" disabled={mode === 'registering_saving'} />
                </F>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <F label="Data de nascimento *">
                    <div className="grid grid-cols-3 gap-1.5">
                      {(() => {
                        const parts = regForm.dataNascimento ? regForm.dataNascimento.split('-') : ['', '', '']
                        const selY = parts[0] || ''
                        const selM = parts[1] || ''
                        const selD = parts[2] || ''
                        const anoAtual = new Date().getFullYear()
                        function setDMY(part: 'y'|'m'|'d', val: string) {
                          setRegForm(p => {
                            const pp = p.dataNascimento ? p.dataNascimento.split('-') : ['', '', '']
                            const ny = part === 'y' ? val : (pp[0] || '')
                            const nm = part === 'm' ? val : (pp[1] || '')
                            const nd = part === 'd' ? val : (pp[2] || '')
                            return { ...p, dataNascimento: `${ny}-${nm}-${nd}` }
                          })
                        }
                        return <>
                          <select value={selD} onChange={e => setDMY('d', e.target.value)}
                            className={`${inp} appearance-none`} disabled={mode === 'registering_saving'}>
                            <option value="">Dia</option>
                            {Array.from({length:31},(_,i)=>i+1).map(n=>(
                              <option key={n} value={String(n).padStart(2,'0')}>{n}</option>
                            ))}
                          </select>
                          <select value={selM} onChange={e => setDMY('m', e.target.value)}
                            className={`${inp} appearance-none`} disabled={mode === 'registering_saving'}>
                            <option value="">Mês</option>
                            {['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'].map((n,i)=>(
                              <option key={i} value={String(i+1).padStart(2,'0')}>{n}</option>
                            ))}
                          </select>
                          <select value={selY} onChange={e => setDMY('y', e.target.value)}
                            className={`${inp} appearance-none`} disabled={mode === 'registering_saving'}>
                            <option value="">Ano</option>
                            {Array.from({length: anoAtual - 1899},(_,i)=> anoAtual - i).map(n=>(
                              <option key={n} value={String(n)}>{n}</option>
                            ))}
                          </select>
                        </>
                      })()}
                    </div>
                  </F>
                  <F label="Sexo *">
                    <select value={regForm.sexo} onChange={e => setRegForm(p => ({ ...p, sexo: e.target.value }))}
                      className={`${inp} appearance-none`} disabled={mode === 'registering_saving'}>
                      <option value="">Selecione...</option>
                      <option value="M">Masculino</option>
                      <option value="F">Feminino</option>
                      <option value="Outro">Outro / Não informado</option>
                    </select>
                  </F>
                </div>
              </div>
            </section>

            {/* Contato e Documento */}
            <section>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Contato e Documento</p>
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <F label="Telefone *">
                    <input type="text" value={regForm.telefone}
                      onChange={e => setRegForm(p => ({ ...p, telefone: fmtTel(e.target.value) }))}
                      className={inp} placeholder="(00) 00000-0000" maxLength={15} disabled={mode === 'registering_saving'} />
                  </F>
                  <F label="E-mail">
                    <input type="email" value={regForm.email}
                      onChange={e => setRegForm(p => ({ ...p, email: e.target.value }))}
                      className={inp} placeholder="opcional" disabled={mode === 'registering_saving'} />
                  </F>
                </div>
                <F label="RG">
                  <input type="text" value={regForm.rg}
                    onChange={e => setRegForm(p => ({ ...p, rg: e.target.value }))}
                    className={inp} placeholder="opcional" disabled={mode === 'registering_saving'} />
                </F>
              </div>
            </section>

            {/* Endereço */}
            <section>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Endereço *</p>
              <div className="space-y-3">
                <F label="CEP">
                  <div className="flex gap-2">
                    <input type="text" value={addr.cep}
                      onChange={e => setAddr(p => ({ ...p, cep: e.target.value.replace(/\D/g, '').slice(0, 8) }))}
                      onBlur={handleCepLookup} placeholder="00000000"
                      className={`${inp} flex-1`} maxLength={8} disabled={mode === 'registering_saving'} />
                    <button type="button" onClick={handleCepLookup}
                      disabled={addr.cep.length !== 8 || cepLoading || mode === 'registering_saving'}
                      className="px-3 py-2.5 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40">
                      {cepLoading
                        ? <svg className="w-4 h-4 animate-spin text-slate-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
                        : <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>}
                    </button>
                  </div>
                  {cepError && <p className="text-xs text-red-600 mt-1">{cepError}</p>}
                </F>
                <F label="Logradouro *">
                  <input type="text" value={addr.logradouro}
                    onChange={e => setAddr(p => ({ ...p, logradouro: e.target.value }))}
                    className={inp} disabled={mode === 'registering_saving'} />
                </F>
                <div className="grid grid-cols-2 gap-3">
                  <F label="Número *">
                    <input type="text" value={addr.numero}
                      onChange={e => setAddr(p => ({ ...p, numero: e.target.value }))}
                      className={inp} disabled={mode === 'registering_saving'} />
                  </F>
                  <F label="Complemento">
                    <input type="text" value={addr.complemento}
                      onChange={e => setAddr(p => ({ ...p, complemento: e.target.value }))}
                      placeholder="Apto, sala..." className={inp} disabled={mode === 'registering_saving'} />
                  </F>
                </div>
                <F label="Bairro *">
                  <input type="text" value={addr.bairro}
                    onChange={e => setAddr(p => ({ ...p, bairro: e.target.value }))}
                    className={inp} disabled={mode === 'registering_saving'} />
                </F>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <F label="Cidade *">
                      <input type="text" value={addr.cidade}
                        onChange={e => setAddr(p => ({ ...p, cidade: e.target.value }))}
                        className={inp} disabled={mode === 'registering_saving'} />
                    </F>
                  </div>
                  <F label="UF *">
                    <input type="text" value={addr.uf}
                      onChange={e => setAddr(p => ({ ...p, uf: e.target.value.toUpperCase().slice(0, 2) }))}
                      className={inp} disabled={mode === 'registering_saving'} />
                  </F>
                </div>
              </div>
            </section>

            {/* LGPD */}
            <div className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
              <input id="lgpd" type="checkbox" checked={regLgpd}
                onChange={e => setRegLgpd(e.target.checked)}
                disabled={mode === 'registering_saving'}
                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-700 focus:ring-blue-500 flex-shrink-0" />
              <label htmlFor="lgpd" className="text-xs text-slate-600 leading-relaxed cursor-pointer">
                <span className="font-semibold text-slate-800">Consentimento LGPD *</span> — Declaro que o cliente forneceu consentimento livre e expresso para o tratamento de seus dados pessoais e de saúde para fins de emissão da DSF, em conformidade com a Lei 13.709/2018 (LGPD).
              </label>
            </div>
          </div>

          <div className="px-5 pb-5 flex flex-col sm:flex-row gap-3">
            <button type="button" onClick={handleSubmitReg}
              disabled={mode === 'registering_saving'}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors">
              {mode === 'registering_saving'
                ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
                : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3M13.5 21H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v7" /></svg>}
              {mode === 'registering_saving' ? 'Cadastrando...' : 'Cadastrar Paciente'}
            </button>
            <button type="button" onClick={() => setMode('not_found')}
              disabled={mode === 'registering_saving'}
              className="flex-1 flex items-center justify-center px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-40 text-slate-600 text-sm font-medium rounded-lg transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── VIEWING ── */}
      {mode === 'viewing' && cliente && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-blue-700 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/15 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-base">{cliente.nome.charAt(0).toUpperCase()}</span>
              </div>
              <div>
                <p className="text-white font-semibold">{cliente.nome}</p>
                <p className="text-blue-200 text-xs font-mono mt-0.5">{fmtCpfDisplay(cliente.cpf)}</p>
              </div>
            </div>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <DF label="Data de Nascimento" value={fmtDate(cliente.dataNascimento)} />
              <DF label="Sexo" value={cliente.sexo} />
              <DF label="Telefone" value={cliente.telefone} />
              <DF label="E-mail" value={cliente.email ?? '—'} />
              {cliente.rg && <DF label="RG" value={cliente.rg} />}
              <div className="sm:col-span-2"><DF label="Endereço" value={cliente.endereco} /></div>
            </div>
            <p className="text-[11px] text-slate-400 mt-4">Última atualização: {new Date(cliente.updatedAt).toLocaleString('pt-BR')}</p>
          </div>
          <div className="px-5 pb-5 flex flex-col sm:flex-row gap-3">
            <button type="button" onClick={openEmit}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
              Confirmar Dados e Iniciar DSF
            </button>
            <button type="button" onClick={openEdit}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
              Atualizar Dados
            </button>
          </div>
        </div>
      )}

      {/* ── DSF HISTORY (no viewing) ── */}
      {mode === 'viewing' && cliente && (dsfHistoryLoading || dsfHistory.length > 0) && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">Histórico de DSFs</p>
            {dsfHistoryLoading && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
            {!dsfHistoryLoading && <span className="text-xs text-slate-400">{dsfHistory.length} registro{dsfHistory.length !== 1 ? 's' : ''}</span>}
          </div>

          {dsfHistoryLoading ? (
            <div className="px-5 py-6 text-center text-xs text-slate-400">Carregando...</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {dsfHistory.map((dsf) => (
                <div key={dsf.id} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-semibold text-slate-700">{dsf.numeroDsf}</span>
                        <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                          dsf.status === 'CONCLUIDA' ? 'bg-green-100 text-green-700'
                          : dsf.status === 'CANCELADA' ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-700'
                        }`}>
                          {dsf.status === 'CONCLUIDA' ? 'Concluída' : dsf.status === 'CANCELADA' ? 'Cancelada' : 'Emitida'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">{dsf.tipoServicoLabel}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {new Date(dsf.dataEmissao).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' })}
                        {' · '}RT: {dsf.rtNome}{dsf.rtCrf ? ` (${dsf.rtCrf})` : ''}
                      </p>
                      {dsf.observacoes && (
                        <p className="text-[11px] text-slate-400 mt-0.5 italic truncate max-w-xs">{dsf.observacoes}</p>
                      )}
                    </div>
                    {dsf.driveFileId && (
                      <a
                        href={`https://drive.google.com/file/d/${dsf.driveFileId}/view`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        PDF
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── EDITING ── */}
      {(mode === 'editing' || mode === 'saving') && cliente && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800">Atualizar dados</p>
              <p className="text-xs text-slate-400 font-mono mt-0.5">{fmtCpfDisplay(cliente.cpf)}</p>
            </div>
            <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 rounded-full font-medium">Editando</span>
          </div>
          <div className="p-5 space-y-5">
            {saveError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2.5 text-sm">
                <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                {saveError}
              </div>
            )}
            <section>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Dados pessoais</p>
              <div className="space-y-3">
                <F label="Nome completo *">
                  <input type="text" value={editForm.nome} onChange={e => setEditForm(p => ({ ...p, nome: e.target.value }))} className={inp} disabled={mode === 'saving'} />
                </F>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <F label="Telefone *">
                    <input type="text" value={editForm.telefone} onChange={e => setEditForm(p => ({ ...p, telefone: fmtTel(e.target.value) }))} className={inp} maxLength={15} disabled={mode === 'saving'} />
                  </F>
                  <F label="E-mail">
                    <input type="email" value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} className={inp} disabled={mode === 'saving'} />
                  </F>
                </div>
                <F label="RG">
                  <input type="text" value={editForm.rg} onChange={e => setEditForm(p => ({ ...p, rg: e.target.value }))} className={inp} disabled={mode === 'saving'} />
                </F>
              </div>
            </section>
            <section>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Endereço</p>
              <p className="text-xs text-slate-400 mb-3">Atual: <span className="text-slate-600">{cliente.endereco}</span></p>
              <div className="space-y-3">
                <F label="CEP">
                  <div className="flex gap-2">
                    <input type="text" value={addr.cep} onChange={e => setAddr(p => ({ ...p, cep: e.target.value.replace(/\D/g, '').slice(0, 8) }))} onBlur={handleCepLookup} placeholder="00000000" className={`${inp} flex-1`} maxLength={8} disabled={mode === 'saving'} />
                    <button type="button" onClick={handleCepLookup} disabled={addr.cep.length !== 8 || cepLoading || mode === 'saving'} className="px-3 py-2.5 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40">
                      {cepLoading ? <svg className="w-4 h-4 animate-spin text-slate-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg> : <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>}
                    </button>
                  </div>
                  {cepError && <p className="text-xs text-red-600 mt-1">{cepError}</p>}
                </F>
                <F label="Logradouro"><input type="text" value={addr.logradouro} onChange={e => setAddr(p => ({ ...p, logradouro: e.target.value }))} className={inp} disabled={mode === 'saving'} /></F>
                <div className="grid grid-cols-2 gap-3">
                  <F label="Número *"><input type="text" value={addr.numero} onChange={e => setAddr(p => ({ ...p, numero: e.target.value }))} className={inp} disabled={mode === 'saving'} /></F>
                  <F label="Complemento"><input type="text" value={addr.complemento} onChange={e => setAddr(p => ({ ...p, complemento: e.target.value }))} placeholder="Apto..." className={inp} disabled={mode === 'saving'} /></F>
                </div>
                <F label="Bairro"><input type="text" value={addr.bairro} onChange={e => setAddr(p => ({ ...p, bairro: e.target.value }))} className={inp} disabled={mode === 'saving'} /></F>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2"><F label="Cidade"><input type="text" value={addr.cidade} onChange={e => setAddr(p => ({ ...p, cidade: e.target.value }))} className={inp} disabled={mode === 'saving'} /></F></div>
                  <F label="UF"><input type="text" value={addr.uf} onChange={e => setAddr(p => ({ ...p, uf: e.target.value.toUpperCase().slice(0, 2) }))} className={inp} disabled={mode === 'saving'} /></F>
                </div>
              </div>
            </section>
          </div>
          <div className="px-5 pb-5 flex flex-col sm:flex-row gap-3">
            <button type="button" onClick={handleSaveEdit} disabled={mode === 'saving' || !editForm.nome.trim() || !editForm.telefone.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors">
              {mode === 'saving' ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg> : null}
              {mode === 'saving' ? 'Salvando...' : 'Salvar Alterações'}
            </button>
            <button type="button" onClick={() => setMode('viewing')} disabled={mode === 'saving'}
              className="flex-1 flex items-center justify-center px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-40 text-slate-600 text-sm font-medium rounded-lg transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── EMIT DSF ── */}
      {(mode === 'emitting' || mode === 'submitting_dsf') && cliente && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-emerald-600 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-white/15 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </div>
              <div>
                <p className="text-white font-semibold text-sm">Nova DSF</p>
                <p className="text-emerald-100 text-xs mt-0.5">{cliente.nome} · {fmtCpfDisplay(cliente.cpf)}</p>
              </div>
            </div>
          </div>
          <div className="p-4 sm:p-5 space-y-5">
            {dsfError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2.5 text-sm">
                <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                {dsfError}
              </div>
            )}
            <F label="Tipo de Serviço *">
              <select value={dsfForm.tipoServico} onChange={e => setDsfForm(p => ({ ...p, tipoServico: e.target.value }))}
                disabled={mode === 'submitting_dsf'} className={`${inp} appearance-none`}>
                <option value="">Selecione o serviço prestado...</option>
                {procedimentoOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </F>
            <F label="Evolução Farmacêutica e Conduta Proposta">
              <textarea value={dsfForm.observacoes} onChange={e => setDsfForm(p => ({ ...p, observacoes: e.target.value }))}
                disabled={mode === 'submitting_dsf'} rows={3}
                placeholder="Achados clínicos, histórico relevante ou recomendações..."
                className={`${inp} resize-none`} />
            </F>
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Insumos Utilizados
                    <span className="ml-1.5 normal-case font-normal text-slate-400 tracking-normal">(Opcional para aferição de parâmetros)</span>
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Materiais e reagentes do atendimento</p>
                </div>
                <button type="button" onClick={() => setDsfForm(p => ({ ...p, insumos: [...p.insumos, BLANK_INSUMO()] }))}
                  disabled={mode === 'submitting_dsf'}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50 disabled:opacity-40 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                  Adicionar
                </button>
              </div>
              <div className="space-y-3">
                {dsfForm.insumos.length === 0 && (
                  <div className="border border-dashed border-slate-200 rounded-xl p-4 text-center text-xs text-slate-400">
                    Nenhum insumo adicionado — clique em &ldquo;Adicionar&rdquo; se o procedimento utilizar materiais.
                  </div>
                )}
                {dsfForm.insumos.map((ins, idx) => (
                  <div key={ins._key} className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Insumo {idx + 1}</span>
                      {dsfForm.insumos.length > 1 && (
                        <button type="button" onClick={() => setDsfForm(p => ({ ...p, insumos: p.insumos.filter(i => i._key !== ins._key) }))}
                          disabled={mode === 'submitting_dsf'} className="text-slate-300 hover:text-red-500 transition-colors disabled:opacity-40">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      )}
                    </div>
                    <div className="space-y-2">
                      <input type="text" value={ins.nomeProduto} onChange={e => setDsfForm(p => ({ ...p, insumos: p.insumos.map(i => i._key === ins._key ? { ...i, nomeProduto: e.target.value } : i) }))}
                        placeholder="Nome do produto / reagente" className={inp} disabled={mode === 'submitting_dsf'} />
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" value={ins.lote} onChange={e => setDsfForm(p => ({ ...p, insumos: p.insumos.map(i => i._key === ins._key ? { ...i, lote: e.target.value } : i) }))}
                          placeholder="Lote" className={inp} disabled={mode === 'submitting_dsf'} />
                        <input type="text" value={ins.fabricante} onChange={e => setDsfForm(p => ({ ...p, insumos: p.insumos.map(i => i._key === ins._key ? { ...i, fabricante: e.target.value } : i) }))}
                          placeholder="Fabricante" className={inp} disabled={mode === 'submitting_dsf'} />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Validade *</label>
                        <input type="date" value={ins.validade} onChange={e => setDsfForm(p => ({ ...p, insumos: p.insumos.map(i => i._key === ins._key ? { ...i, validade: e.target.value } : i) }))}
                          className={inp} disabled={mode === 'submitting_dsf'} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
              <svg className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
              <p className="text-xs text-amber-700">Este procedimento constitui monitoramento/triagem e <strong>não substitui</strong> o diagnóstico médico. Conforme ANVISA RDC 44/2009.</p>
            </div>
          </div>
          <div className="px-4 sm:px-5 pb-5 flex flex-col sm:flex-row gap-3">
            <button type="button" onClick={handleSubmitDsf} disabled={mode === 'submitting_dsf' || !dsfForm.tipoServico}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors">
              {mode === 'submitting_dsf' ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
              {mode === 'submitting_dsf' ? 'Emitindo DSF...' : 'Emitir DSF'}
            </button>
            <button type="button" onClick={() => setMode('viewing')} disabled={mode === 'submitting_dsf'}
              className="flex-1 flex items-center justify-center px-4 py-3 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-40 text-slate-600 text-sm font-medium rounded-xl transition-colors">
              Voltar aos Dados
            </button>
          </div>
        </div>
      )}

      {/* ── DSF GENERATED — Documento + ações ── */}
      {mode === 'dsf_generated' && receiptDsf && (
        <div className="space-y-4">
          {/* Ações */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button type="button" onClick={() => window.print()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.056 48.056 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" /></svg>
              {receiptDsf.tipoImpressao === 'FOLHA_A4' ? 'Imprimir Folha A4' : 'Imprimir Cupom DSF'}
            </button>
            <button type="button" onClick={() => setShowSignModal(true)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
              Assinar Digitalmente
            </button>
            <button type="button" onClick={() => { setCapturedImage(null); setMode('dsf_scanning') }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" /></svg>
              {isMobile ? 'Fotografar Cupom Assinado' : 'Anexar Cupom Assinado'}
            </button>
          </div>

          {signResult && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800 space-y-1">
              <p className="font-semibold">DSF assinada digitalmente</p>
              <p className="text-xs text-green-600 font-mono break-all">SHA-256: {signResult.hash}</p>
              <p className="text-xs text-green-600">Assinado em: {new Date(signResult.timestamp).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
              {signResult.emailEnviado && <p className="text-xs text-green-600">Email enviado para o paciente.</p>}
            </div>
          )}

          {receiptDsf.tipoImpressao === 'FOLHA_A4' ? (
            /* ── Layout A4 — Relatório clínico ── */
            <div className="dsf-doc bg-white rounded-2xl border border-slate-200 shadow-sm p-8 max-w-[210mm] mx-auto text-slate-900 text-sm leading-relaxed">
              {/* Cabeçalho */}
              <div className="flex items-start justify-between mb-6 pb-4 border-b-2 border-slate-800">
                <div>
                  {receiptDsf.drogariaLogoUrl
                    ? <img src={receiptDsf.drogariaLogoUrl} alt="Logo" className="h-14 object-contain mb-2" />
                    : <p className="text-xl font-extrabold uppercase tracking-wide">{receiptDsf.drogariaNome}</p>
                  }
                  <p className="text-xs text-slate-500">CNPJ: {receiptDsf.drogariaCnpj}</p>
                  {receiptDsf.drogariaTelefone && <p className="text-xs text-slate-500">Tel: {receiptDsf.drogariaTelefone}</p>}
                </div>
                <div className="text-right">
                  <p className="font-bold text-base uppercase">Declaração de Serviço Farmacêutico</p>
                  <p className="text-slate-500 font-mono text-sm">{receiptDsf.numeroDsf}</p>
                  <p className="text-slate-500 text-xs">{new Date(receiptDsf.dataEmissao).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>

              {/* Profissional e Paciente */}
              <div className="grid grid-cols-2 gap-6 mb-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Responsável Técnico</p>
                  <p className="font-semibold">{receiptDsf.rtNome}</p>
                  {receiptDsf.rtCrf && <p className="text-slate-500 text-xs">CRF: {receiptDsf.rtCrf}</p>}
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Paciente</p>
                  <p className="font-semibold">{receiptDsf.clienteNome}</p>
                  <p className="text-slate-500 text-xs">CPF: {fmtCpfDisplay(receiptDsf.clienteCpf)} | Nasc: {fmtDate(receiptDsf.clienteDataNasc)}</p>
                  <p className="text-slate-500 text-xs">Fone: {receiptDsf.clienteTelefone}</p>
                </div>
              </div>

              <div className="border-t border-slate-200 my-4" />

              {/* Serviço */}
              <div className="mb-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Serviço Prestado</p>
                <p className="font-semibold text-base">{receiptDsf.tipoServicoLabel}</p>
                {receiptDsf.textoOrientacao && (
                  <p className="whitespace-pre-wrap text-sm text-slate-600 mt-1 bg-slate-50 rounded p-2">{receiptDsf.textoOrientacao}</p>
                )}
              </div>

              {receiptDsf.observacoes && (
                <div className="mb-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Evolução Farmacêutica e Conduta Proposta</p>
                  <p className="whitespace-pre-wrap bg-slate-50 rounded-lg p-3 text-sm">{receiptDsf.observacoes}</p>
                </div>
              )}

              {receiptDsf.insumos.length > 0 && (
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
                      {receiptDsf.insumos.map((ins, i) => (
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

              {/* Assinaturas */}
              <div className="grid grid-cols-2 gap-8 mt-8">
                <div>
                  <div className="border-b border-slate-900 mb-2 mt-12" />
                  <p className="text-xs text-center">{receiptDsf.rtNome}{receiptDsf.rtCrf ? ` — CRF ${receiptDsf.rtCrf}` : ''}</p>
                  <p className="text-[11px] text-center text-slate-500">Profissional Responsável (CRF/UF)</p>
                </div>
                <div>
                  <div className="border-b border-slate-900 mb-2 mt-12" />
                  <p className="text-xs text-center">{receiptDsf.clienteNome}</p>
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
            /* ── Layout Bobina 80mm — Cupom térmico ── */
            <div className="thermal-receipt bg-white rounded-2xl border border-slate-200 shadow-sm p-5 font-mono text-xs text-slate-900 max-w-[320px] mx-auto leading-relaxed">
              <div className="text-center mb-3">
                {receiptDsf.drogariaLogoUrl
                  ? <img src={receiptDsf.drogariaLogoUrl} alt="Logo" className="h-12 mx-auto object-contain mb-1" />
                  : <p className="font-bold text-sm uppercase tracking-wide">{receiptDsf.drogariaNome}</p>
                }
                {receiptDsf.drogariaLogoUrl && <p className="font-bold text-xs uppercase">{receiptDsf.drogariaNome}</p>}
                <p className="text-slate-500">CNPJ: {receiptDsf.drogariaCnpj}</p>
                {receiptDsf.drogariaTelefone && <p className="text-slate-500">Tel: {receiptDsf.drogariaTelefone}</p>}
              </div>

              <div className="border-t border-dashed border-slate-300 my-2" />

              <div className="text-center mb-2">
                <p className="font-bold text-sm">DECLARAÇÃO DE SERVIÇO FARMACÊUTICO</p>
                <p className="text-slate-500 font-bold">{receiptDsf.numeroDsf}</p>
                <p className="text-slate-500">{new Date(receiptDsf.dataEmissao).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
              </div>

              <div className="border-t border-dashed border-slate-300 my-2" />

              <p className="font-bold uppercase mb-1">Responsável Técnico</p>
              <p>{receiptDsf.rtNome}</p>
              {receiptDsf.rtCrf && <p className="text-slate-500">CRF: {receiptDsf.rtCrf}</p>}

              <div className="border-t border-dashed border-slate-300 my-2" />

              <p className="font-bold uppercase mb-1">Paciente</p>
              <p>{receiptDsf.clienteNome}</p>
              <p className="text-slate-500">CPF: {fmtCpfDisplay(receiptDsf.clienteCpf)}</p>
              <p className="text-slate-500">Nasc: {fmtDate(receiptDsf.clienteDataNasc)}</p>
              <p className="text-slate-500">Fone: {receiptDsf.clienteTelefone}</p>

              <div className="border-t border-dashed border-slate-300 my-2" />

              <p className="font-bold uppercase mb-1">Serviço Prestado</p>
              <p className="font-semibold">{receiptDsf.tipoServicoLabel}</p>
              {receiptDsf.textoOrientacao && (
                <p className="whitespace-pre-wrap text-slate-600 text-xs mt-1">{receiptDsf.textoOrientacao}</p>
              )}

              {receiptDsf.insumos.length > 0 && (
                <>
                  <div className="border-t border-dashed border-slate-300 my-2" />
                  <p className="font-bold uppercase mb-1">Insumos Utilizados</p>
                  {receiptDsf.insumos.map((ins, i) => (
                    <div key={i} className="mb-1">
                      <p className="font-medium">{ins.nomeProduto}</p>
                      <p className="text-slate-500">Lote: {ins.lote} | Fab: {ins.fabricante}</p>
                      <p className="text-slate-500">Val: {fmtDate(ins.validade)}</p>
                    </div>
                  ))}
                </>
              )}

              {receiptDsf.observacoes && (
                <>
                  <div className="border-t border-dashed border-slate-300 my-2" />
                  <p className="font-bold uppercase mb-1">Evolução Farmacêutica</p>
                  <p className="whitespace-pre-wrap">{receiptDsf.observacoes}</p>
                </>
              )}

              <div className="border-t border-dashed border-slate-300 my-2" />

              <div className="mt-4 mb-2">
                <p className="font-bold uppercase mb-1">Profissional Responsável (CRF/UF)</p>
                <div className="border-b border-slate-900 mt-8 mb-1" />
                <p>{receiptDsf.rtNome}{receiptDsf.rtCrf ? ` — CRF ${receiptDsf.rtCrf}` : ''}</p>
              </div>

              <div className="mt-4 mb-2">
                <p className="font-bold uppercase mb-1">Paciente / Usuário do Serviço</p>
                <div className="border-b border-slate-900 mt-8 mb-1" />
                <p>{receiptDsf.clienteNome}</p>
              </div>

              <div className="border-t border-dashed border-slate-300 my-3 text-center">
                <p className="text-[10px] text-slate-500 leading-tight mt-2">
                  Esta declaração constitui um registro de monitoramento de parâmetros fisiológicos/bioquímicos e triagem em saúde. Não possui fins de diagnóstico definitivo e não substitui a consulta médica ou a avaliação por profissional de saúde habilitado.
                </p>
                <p className="text-[10px] text-slate-500 leading-tight mt-1">ANVISA RDC 44/2009 | LGPD Lei 13.709/2018</p>
              </div>
            </div>
          )}

          {/* CSS de impressão dinâmico */}
          {receiptDsf.tipoImpressao === 'FOLHA_A4' ? (
            <style>{`
              @media print {
                body * { visibility: hidden; }
                .dsf-doc, .dsf-doc * { visibility: visible; }
                .dsf-doc {
                  position: absolute; left: 0; top: 0;
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
                  position: absolute; left: 0; top: 0;
                  width: 72mm; max-width: 72mm;
                  padding: 3mm; margin: 0;
                  font-family: 'Courier New', Courier, monospace;
                  font-size: 9pt; line-height: 1.4;
                  color: #000; background: #fff;
                  border: none; border-radius: 0; box-shadow: none;
                }
                @page { size: 80mm auto; margin: 4mm; }
              }
            `}</style>
          )}
        </div>
      )}

      {/* ── DSF SCANNING — Câmera (mobile) ou Drag & Drop (desktop) ── */}
      {(mode === 'dsf_scanning' || mode === 'dsf_uploading') && (
        <div className="bg-slate-900 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between border-b border-slate-700">
            <div>
              <p className="text-white text-sm font-semibold">
                {isMobile ? 'Fotografar Cupom Assinado' : 'Anexar Cupom Assinado'}
              </p>
              <p className="text-slate-400 text-xs mt-0.5">
                {isMobile ? 'Enquadre o cupom impresso e assinado' : 'Arraste a imagem ou clique para selecionar o arquivo'}
              </p>
            </div>
            <button type="button" onClick={() => setMode('dsf_generated')} disabled={mode === 'dsf_uploading'}
              className="text-slate-400 hover:text-white transition-colors disabled:opacity-40">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {uploadError && (
            <div className="mx-4 mt-3 flex items-center gap-2 bg-red-900/50 border border-red-700 text-red-300 rounded-lg px-3 py-2 text-xs">
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
              {uploadError}
            </div>
          )}

          {capturedImage ? (
            /* Preview da imagem ou PDF selecionado */
            <div className="p-4 space-y-3">
              {capturedImage.startsWith('data:application/pdf')
                ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-10 bg-slate-800 rounded-xl">
                    <svg className="w-14 h-14 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    <p className="text-white text-sm font-medium">PDF pronto para envio</p>
                  </div>
                )
                : <img src={capturedImage} alt="Cupom capturado" className="w-full rounded-xl object-contain max-h-[60vh]" />
              }
              <div className="flex gap-3">
                <button type="button" onClick={() => { setCapturedImage(null) }}
                  disabled={mode === 'dsf_uploading'}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white text-sm font-medium rounded-xl transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                  {isMobile ? 'Tirar Outra' : 'Trocar Arquivo'}
                </button>
                <button type="button" onClick={handleUploadSigned}
                  disabled={mode === 'dsf_uploading'}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors">
                  {mode === 'dsf_uploading'
                    ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
                    : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                  }
                  {mode === 'dsf_uploading' ? 'Enviando...' : 'Enviar e Finalizar'}
                </button>
              </div>
            </div>
          ) : isMobile ? (
            /* Feed da câmera com máscara guia — mobile */
            <div className="relative">
              {cameraError ? (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-3">
                  <svg className="w-10 h-10 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" /></svg>
                  <p className="text-slate-400 text-sm">{cameraError}</p>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    playsInline muted autoPlay
                    className="w-full object-cover"
                    style={{ maxHeight: '65vh' }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div
                      className="border-2 border-white/80 rounded-sm relative"
                      style={{
                        width: receiptDsf?.tipoImpressao === 'FOLHA_A4' ? '70%' : '52%',
                        aspectRatio: receiptDsf?.tipoImpressao === 'FOLHA_A4' ? '0.71' : '0.38',
                        boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
                      }}
                    >
                      <span className="absolute -top-px -left-px w-4 h-4 border-t-2 border-l-2 border-emerald-400" />
                      <span className="absolute -top-px -right-px w-4 h-4 border-t-2 border-r-2 border-emerald-400" />
                      <span className="absolute -bottom-px -left-px w-4 h-4 border-b-2 border-l-2 border-emerald-400" />
                      <span className="absolute -bottom-px -right-px w-4 h-4 border-b-2 border-r-2 border-emerald-400" />
                    </div>
                  </div>
                  <p className="absolute bottom-16 left-0 right-0 text-center text-xs text-white/70 px-4">
                    Enquadre o cupom assinado dentro da área marcada
                  </p>
                </>
              )}
              <div className="p-4">
                <button type="button" onClick={capturePhoto} disabled={!!cameraError}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-white text-slate-900 text-sm font-bold rounded-xl disabled:opacity-40 active:scale-95 transition-all">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" /></svg>
                  Capturar Imagem
                </button>
              </div>
            </div>
          ) : (
            /* Drag & Drop — desktop */
            <div className="p-6">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }}
              />
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
                className={`w-full border-2 border-dashed rounded-2xl p-10 flex flex-col items-center gap-4 transition-colors ${isDragOver ? 'border-emerald-400 bg-emerald-900/20' : 'border-slate-600 hover:border-slate-400 hover:bg-slate-800/50'}`}
              >
                <svg className={`w-12 h-12 ${isDragOver ? 'text-emerald-400' : 'text-slate-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <div className="text-center">
                  <p className="text-white font-semibold text-sm">Arraste a foto ou PDF do cupom assinado aqui</p>
                  <p className="text-slate-400 text-xs mt-1">ou clique para selecionar — JPG, PNG, PDF</p>
                </div>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── DSF CONCLUÍDA ── */}
      {mode === 'dsf_concluida' && receiptDsf && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Cabeçalho verde */}
          <div className="bg-emerald-600 px-6 py-8 flex flex-col items-center text-center">
            <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mb-3">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-white font-bold text-lg leading-tight">DSF Concluída!</p>
            <p className="text-emerald-100 text-sm mt-1">Documento arquivado com sucesso no Google Drive</p>
            <p className="text-white font-mono font-semibold text-base mt-3 bg-white/10 px-4 py-1.5 rounded-full">
              {receiptDsf.numeroDsf}
            </p>
          </div>

          {/* Resumo */}
          <div className="px-6 py-5 space-y-3">
            <Row label="Paciente" value={receiptDsf.clienteNome} />
            <Row label="CPF" value={fmtCpfDisplay(receiptDsf.clienteCpf)} />
            <Row label="Serviço" value={receiptDsf.tipoServicoLabel} />
            <Row label="Responsável Técnico" value={`${receiptDsf.rtNome}${receiptDsf.rtCrf ? ` — ${receiptDsf.rtCrf}` : ''}`} />
            <Row label="Data" value={new Date(receiptDsf.dataEmissao).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} />
          </div>

          {/* Ações */}
          <div className="px-6 pb-6 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => { setReceiptDsf(null); setCapturedImage(null); setMode('viewing') }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-xl transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Ver Cadastro do Paciente
            </button>
            <button
              type="button"
              onClick={() => { setCliente(null); setReceiptDsf(null); setCapturedImage(null); setCpfInput(''); setMode('idle') }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Novo Atendimento
            </button>
          </div>
        </div>
      )}

      </>)}

      {/* ── ABA HISTÓRICO ── */}
      {activeTab === 'historico' && (
        <div>
          {historicoLoading && (
            <div className="text-center py-12 text-slate-400 text-sm">Carregando histórico...</div>
          )}
          {historicoError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{historicoError}</div>
          )}
          {!historicoLoading && !historicoError && historico.length === 0 && (
            <div className="text-center py-12 text-slate-400 text-sm">Nenhuma DSF encontrada.</div>
          )}
          {!historicoLoading && historico.length > 0 && (
            <>
              <p className="text-xs text-slate-500 mb-3">{historicoTotal} DSF{historicoTotal !== 1 ? 's' : ''} no total — exibindo as 20 mais recentes</p>
              <div className="space-y-2">
                {historico.map(dsf => (
                  <div key={dsf.id} className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-semibold text-slate-700">{dsf.numeroDsf}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          dsf.status === 'CONCLUIDA' ? 'bg-emerald-100 text-emerald-700' :
                          dsf.status === 'CANCELADA' ? 'bg-red-100 text-red-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {dsf.status === 'CONCLUIDA' ? 'Assinada' : dsf.status === 'CANCELADA' ? 'Cancelada' : 'Pendente'}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-800 mt-0.5 truncate">{dsf.clienteNome}</p>
                      <p className="text-xs text-slate-500">{dsf.tipoServicoLabel}</p>
                      <div className="flex gap-2 mt-2">
                        {dsf.status === 'EMITIDA' && (
                          <button
                            type="button"
                            onClick={() => {
                              setReceiptDsf({
                                id: dsf.id,
                                numeroDsf: dsf.numeroDsf,
                                clienteNome: dsf.clienteNome,
                                clienteEmail: dsf.clienteEmail,
                                rtNome: dsf.rtNome,
                                rtCrf: dsf.rtCrf,
                              } as ReceiptDsf)
                              setHistoricoSignDsfId(dsf.id)
                              setShowSignModal(true)
                            }}
                            className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
                          >
                            Concluir
                          </button>
                        )}
                        {dsf.status === 'CONCLUIDA' && dsf.driveFileId && (
                          <a
                            href={`https://drive.google.com/file/d/${dsf.driveFileId}/view`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                          >
                            Ver PDF
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-slate-500">{new Date(dsf.dataEmissao).toLocaleDateString('pt-BR')}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{dsf.rtNome}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {showSignModal && receiptDsf && (
        <DsfSignatureModal
          dsfId={receiptDsf.id}
          numeroDsf={receiptDsf.numeroDsf}
          clienteNome={receiptDsf.clienteNome}
          clienteEmail={receiptDsf.clienteEmail}
          rtNome={receiptDsf.rtNome}
          rtCrf={receiptDsf.rtCrf}
          onClose={() => { setShowSignModal(false); setHistoricoSignDsfId(null) }}
          onSuccess={(result) => {
            setShowSignModal(false)
            if (historicoSignDsfId) {
              setHistoricoSignDsfId(null)
              setHistoricoLoading(true)
              fetch('/api/dsf/list?page=1')
                .then(r => r.json())
                .then(d => { if (!d.error) { setHistorico(d.dsfs); setHistoricoTotal(d.total) } })
                .finally(() => setHistoricoLoading(false))
            } else {
              setSignResult(result)
              setMode('dsf_concluida')
            }
          }}
        />
      )}

    </div>
  )
}

/* ─── Micro-components ───────────────────────────────────────────────────────── */

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-slate-500 flex-shrink-0">{label}</span>
      <span className="text-slate-800 font-medium text-right">{value}</span>
    </div>
  )
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  )
}

function DF({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-slate-800 mt-0.5">{value}</p>
    </div>
  )
}

const inp = 'w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500 transition'
