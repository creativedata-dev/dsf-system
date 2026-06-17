'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { PushNotificacoes } from '@/components/push-notificacoes'

interface DriveStatus {
  connected: boolean
  connectedSince: string | null
  lastSync: string | null
  folderId: string | null
}

type BannerType = 'success' | 'error' | 'warning'

export default function ConfiguracoesPage() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<DriveStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState(false)
  const [banner, setBanner] = useState<{ type: BannerType; msg: string } | null>(null)

  /* ── Banner baseado no retorno do OAuth ──────────────────────────────────────── */
  useEffect(() => {
    const p = searchParams.get('drive')
    if (p === 'conectado')
      setBanner({ type: 'success', msg: 'Google Drive conectado com sucesso! Os próximos PDFs já serão salvos automaticamente na nuvem.' })
    else if (p === 'sem_refresh_token')
      setBanner({ type: 'error', msg: 'Token de renovação não recebido. Revogue o acesso em myaccount.google.com → Segurança → Acesso de terceiros e tente novamente.' })
    else if (p === 'erro')
      setBanner({ type: 'error', msg: 'Falha ao conectar o Google Drive. Tente novamente ou verifique as permissões do OAuth no Google Cloud Console.' })
    else if (p === 'cancelado')
      setBanner({ type: 'warning', msg: 'Autorização cancelada. O Google Drive não foi conectado.' })
  }, [searchParams])

  /* ── Carrega status do Drive ─────────────────────────────────────────────────── */
  useEffect(() => {
    fetch('/api/integrations/google-drive/status')
      .then(r => r.json())
      .then((data: DriveStatus) => setStatus(data))
      .catch(() => setStatus({ connected: false, connectedSince: null, lastSync: null, folderId: null }))
      .finally(() => setLoading(false))
  }, [])

  /* ── Desconectar ─────────────────────────────────────────────────────────────── */
  async function handleDisconnect() {
    if (!confirm('Tem certeza? Novos PDFs não serão enviados ao Drive. Os arquivos já salvos não serão afetados.')) return
    setDisconnecting(true)
    try {
      const res = await fetch('/api/integrations/google-drive/disconnect', { method: 'POST' })
      if (!res.ok) throw new Error()
      setStatus({ connected: false, connectedSince: null, lastSync: null, folderId: null })
      setBanner({ type: 'warning', msg: 'Google Drive desconectado. Novos PDFs não serão enviados à nuvem.' })
    } catch {
      setBanner({ type: 'error', msg: 'Erro ao desconectar. Tente novamente.' })
    } finally {
      setDisconnecting(false)
    }
  }

  /* ── Render ──────────────────────────────────────────────────────────────────── */
  return (
    <div className="p-4 sm:p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Configurações</h1>
        <p className="text-sm text-slate-500 mt-0.5">Conecte o Google Drive para arquivamento automático das DSFs assinadas</p>
      </div>

      {/* Banner de resultado OAuth */}
      {banner && (
        <div className={`flex items-start gap-3 rounded-xl px-4 py-3 mb-5 text-sm border ${
          banner.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
          banner.type === 'error'   ? 'bg-red-50 border-red-200 text-red-800' :
                                      'bg-amber-50 border-amber-200 text-amber-800'
        }`}>
          {banner.type === 'success' ? (
            <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : banner.type === 'error' ? (
            <svg className="w-5 h-5 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          )}
          <span className="flex-1">{banner.msg}</span>
          <button onClick={() => setBanner(null)} className="shrink-0 opacity-50 hover:opacity-100 transition-opacity">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Seção de Integrações */}
      <section>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Integrações</p>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 flex items-center justify-center">
              <svg className="w-5 h-5 animate-spin text-slate-300" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            </div>
          ) : status?.connected ? (
            <Connected
              status={status}
              disconnecting={disconnecting}
              onDisconnect={handleDisconnect}
            />
          ) : (
            <Disconnected />
          )}
        </div>
      </section>

      <PushNotificacoes />
    </div>
  )
}

/* ── Estado: conectado ───────────────────────────────────────────────────────── */

function Connected({
  status,
  disconnecting,
  onDisconnect,
}: {
  status: DriveStatus
  disconnecting: boolean
  onDisconnect: () => void
}) {
  return (
    <div>
      <div className="px-5 py-5 flex items-start gap-4">
        <DriveIcon className="w-10 h-10 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-semibold text-slate-800">Google Drive</p>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              Conectado
            </span>
          </div>
          <p className="text-sm text-slate-500 mb-2">
            Os PDFs das DSFs assinadas são arquivados automaticamente na nuvem da farmácia.
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            {status.connectedSince && (
              <p className="text-[11px] text-slate-400">
                Conectado em:&nbsp;
                <span className="text-slate-600 font-medium">
                  {new Date(status.connectedSince).toLocaleDateString('pt-BR')}
                </span>
              </p>
            )}
            {status.lastSync && (
              <p className="text-[11px] text-slate-400">
                Última atividade:&nbsp;
                <span className="text-slate-600 font-medium">
                  {new Date(status.lastSync).toLocaleString('pt-BR')}
                </span>
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="px-5 pb-5 flex flex-col sm:flex-row gap-3 border-t border-slate-100 pt-4">
        <a
          href="/api/integrations/google-drive"
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-600 text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          Reconectar / Trocar Conta
        </a>
        <button
          type="button"
          onClick={onDisconnect}
          disabled={disconnecting}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 hover:bg-red-100 disabled:opacity-40 text-red-700 text-sm font-medium rounded-lg transition-colors"
        >
          {disconnecting ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          )}
          {disconnecting ? 'Desconectando...' : 'Remover Integração'}
        </button>
      </div>
    </div>
  )
}

/* ── Estado: desconectado ────────────────────────────────────────────────────── */

function Disconnected() {
  return (
    <div className="px-5 py-8">
      <div className="flex flex-col items-center text-center max-w-sm mx-auto">
        <DriveIcon className="w-14 h-14 mb-4" />
        <div className="flex items-center gap-2 mb-2">
          <p className="font-semibold text-slate-800">Google Drive</p>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
            Desconectado
          </span>
        </div>
        <p className="text-sm text-slate-500 mb-6 leading-relaxed">
          Vincule o Google Drive da farmácia para que os PDFs das DSFs assinadas sejam arquivados automaticamente na nuvem — sem nenhum upload manual.
        </p>
        <a
          href="/api/integrations/google-drive"
          className="inline-flex items-center gap-3 px-6 py-3 bg-blue-700 hover:bg-blue-800 text-white font-semibold text-sm rounded-xl transition-colors shadow-sm w-full justify-center"
        >
          <DriveIcon className="w-5 h-5 brightness-0 invert" />
          Conectar Google Drive da Farmácia
        </a>
        <p className="text-[11px] text-slate-400 mt-3">
          Apenas o escopo de criação de arquivos será solicitado (<code>drive.file</code>).
        </p>
      </div>
    </div>
  )
}

/* ── Ícone Google Drive ───────────────────────────────────────────────────────── */

function DriveIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
      <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 2.55.65 4.95 1.8 7.05l4.8-13.7z" fill="#0066DA" />
      <path d="M43.65 25L29.9 1.2c-1.35.8-2.5 1.9-3.3 3.3L.95 50.55c0 2.55.65 4.95 1.8 7.05L27.4 57.2 43.65 25z" fill="#00AC47" />
      <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c1.15-2.1 1.8-4.5 1.8-7.05H59.65l5.9 12.65L73.55 76.8z" fill="#EA4335" />
      <path d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.45-4.5 1.2L43.65 25z" fill="#00832D" />
      <path d="M59.65 57.2H27.4L13.65 81c1.35.8 2.9 1.2 4.5 1.2h50.1c1.6 0 3.15-.45 4.5-1.2L59.65 57.2z" fill="#2684FC" />
      <path d="M73.4 26.35l-13.2-22.85c-1.35-.8-2.9-1.2-4.5-1.2h-12l14.5 25.1L73.4 26.35z" fill="#FFBA00" />
      <path d="M73.4 26.35L59.65 57.2h26.7l.05-.05c1.15-2.1 1.8-4.5 1.8-7.05L73.4 26.35z" fill="#FF6D00" />
    </svg>
  )
}
