'use client'

import { useEffect, useState } from 'react'
// icons inline — projeto não usa lucide-react

interface PerfilData {
  id: string
  nome: string
  email: string
  crf: string | null
  permissions: string[]
  createdAt: string
}

const PERMISSION_LABELS: Record<string, string> = {
  ADMIN:              'Administrador',
  FARMACEUTICO:       'Farmacêutico',
  ATENDENTE:          'Atendente',
  TECNICO:            'Técnico',
  VISUALIZADOR:       'Visualizador',
}

export default function PerfilPage() {
  const [perfil, setPerfil]           = useState<PerfilData | null>(null)
  const [nome, setNome]               = useState('')
  const [crf, setCrf]                 = useState('')
  const [dadosMsg, setDadosMsg]       = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [dadosLoading, setDadosLoading] = useState(false)

  const [senhaAtual, setSenhaAtual]   = useState('')
  const [novaSenha, setNovaSenha]     = useState('')
  const [confirmar, setConfirmar]     = useState('')
  const [senhaMsg, setSenhaMsg]       = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [senhaLoading, setSenhaLoading] = useState(false)

  useEffect(() => {
    fetch('/api/perfil')
      .then(r => r.json())
      .then((d: PerfilData) => {
        setPerfil(d)
        setNome(d.nome)
        setCrf(d.crf ?? '')
      })
  }, [])

  async function salvarDados(e: React.FormEvent) {
    e.preventDefault()
    setDadosLoading(true)
    setDadosMsg(null)
    try {
      const res = await fetch('/api/perfil', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, crf }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao salvar')
      setPerfil(prev => prev ? { ...prev, nome: data.nome, crf: data.crf } : prev)
      setDadosMsg({ tipo: 'ok', texto: 'Dados atualizados com sucesso.' })
    } catch (err) {
      setDadosMsg({ tipo: 'erro', texto: (err as Error).message })
    } finally {
      setDadosLoading(false)
    }
  }

  async function alterarSenha(e: React.FormEvent) {
    e.preventDefault()
    setSenhaMsg(null)
    if (novaSenha !== confirmar) {
      setSenhaMsg({ tipo: 'erro', texto: 'Nova senha e confirmação não coincidem.' })
      return
    }
    if (novaSenha.length < 6) {
      setSenhaMsg({ tipo: 'erro', texto: 'Nova senha deve ter ao menos 6 caracteres.' })
      return
    }
    setSenhaLoading(true)
    try {
      const res = await fetch('/api/perfil/senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senhaAtual, novaSenha }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao alterar senha')
      setSenhaMsg({ tipo: 'ok', texto: 'Senha alterada com sucesso.' })
      setSenhaAtual('')
      setNovaSenha('')
      setConfirmar('')
    } catch (err) {
      setSenhaMsg({ tipo: 'erro', texto: (err as Error).message })
    } finally {
      setSenhaLoading(false)
    }
  }

  if (!perfil) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        Carregando…
      </div>
    )
  }

  const initials = perfil.nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('')

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-2xl font-bold text-indigo-600 select-none">
          {initials}
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-800">{perfil.nome}</h1>
          <p className="text-sm text-slate-500">{perfil.email}</p>
          <div className="flex flex-wrap gap-1 mt-1">
            {perfil.permissions.map(p => (
              <span key={p} className="px-2 py-0.5 text-xs font-medium bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100">
                {PERMISSION_LABELS[p] ?? p}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Dados pessoais */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
          <h2 className="font-medium text-slate-700">Dados pessoais</h2>
        </div>
        <form onSubmit={salvarDados} className="px-5 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Nome completo</label>
            <input
              type="text"
              value={nome}
              onChange={e => setNome(e.target.value)}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">E-mail</label>
            <input
              type="email"
              value={perfil.email}
              disabled
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-400 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">CRF <span className="text-slate-400 font-normal">(opcional)</span></label>
            <input
              type="text"
              value={crf}
              onChange={e => setCrf(e.target.value)}
              placeholder="Ex: SP-12345"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {dadosMsg && (
            <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${dadosMsg.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              {dadosMsg.tipo === 'ok'
                ? <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                : <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              {dadosMsg.texto}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={dadosLoading}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              {dadosLoading ? 'Salvando…' : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </div>

      {/* Alterar senha */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          <h2 className="font-medium text-slate-700">Alterar senha</h2>
        </div>
        <form onSubmit={alterarSenha} className="px-5 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Senha atual</label>
            <input
              type="password"
              value={senhaAtual}
              onChange={e => setSenhaAtual(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Nova senha</label>
            <input
              type="password"
              value={novaSenha}
              onChange={e => setNovaSenha(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Confirmar nova senha</label>
            <input
              type="password"
              value={confirmar}
              onChange={e => setConfirmar(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {senhaMsg && (
            <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${senhaMsg.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              {senhaMsg.tipo === 'ok'
                ? <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                : <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              {senhaMsg.texto}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={senhaLoading}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              {senhaLoading ? 'Alterando…' : 'Alterar senha'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
