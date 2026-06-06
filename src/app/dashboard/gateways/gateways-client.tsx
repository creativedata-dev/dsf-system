'use client'

import { useState, useEffect, useCallback } from 'react'

interface GatewayData {
  gateway: string
  label: string
  ativo: boolean
  modoTeste: boolean
  publicKey: string | null
  secretKeyMasked: string | null
  webhookConfigured: boolean
  createdAt: string | null
  updatedAt: string | null
}

const GATEWAY_ICONS: Record<string, string> = {
  stripe:      '💳',
  asaas:       '🏦',
  mercadopago: '🛒',
}

const WEBHOOK_URLS: Record<string, string> = {
  stripe:      '/api/webhooks/stripe',
  asaas:       '/api/webhooks/asaas',
  mercadopago: '/api/webhooks/mercadopago',
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${ok ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-green-500' : 'bg-slate-400'}`} />
      {label}
    </span>
  )
}

function GatewayModal({
  gw, onClose, onSaved,
}: {
  gw: GatewayData
  onClose: () => void
  onSaved: () => void
}) {
  const [secretKey, setSecretKey] = useState('')
  const [webhookSecret, setWebhookSecret] = useState('')
  const [publicKey, setPublicKey] = useState(gw.publicKey ?? '')
  const [ativo, setAtivo] = useState(gw.ativo)
  const [modoTeste, setModoTeste] = useState(gw.modoTeste)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  async function handleSave() {
    setSaving(true); setError(''); setSaved(false)
    try {
      const body: Record<string, unknown> = { gateway: gw.gateway, ativo, modoTeste, publicKey: publicKey || null }
      if (secretKey) body.secretKey = secretKey
      if (webhookSecret) body.webhookSecret = webhookSecret

      const res = await fetch('/api/admin/gateways', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Erro ao salvar'); return }
      setSaved(true)
      setTimeout(() => { onSaved(); onClose() }, 800)
    } catch { setError('Falha de conexão') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !saving && onClose()} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-xl">{GATEWAY_ICONS[gw.gateway]}</span>
            <h3 className="font-bold text-slate-900">{gw.label}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${modoTeste ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
              {modoTeste ? 'Teste' : 'Produção'}
            </span>
          </div>
          <button onClick={onClose} disabled={saving} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Ativo + modo */}
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} className="w-4 h-4 accent-green-600" />
              <span className="text-sm text-slate-700">Ativo</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={modoTeste} onChange={e => setModoTeste(e.target.checked)} className="w-4 h-4 accent-amber-500" />
              <span className="text-sm text-slate-700">Modo teste</span>
            </label>
          </div>

          {/* Chave secreta */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Secret Key {gw.secretKeyMasked && <span className="text-slate-400 font-normal">({gw.secretKeyMasked})</span>}
            </label>
            <input
              type="password" value={secretKey} onChange={e => setSecretKey(e.target.value)}
              placeholder={gw.secretKeyMasked ? 'Nova chave (deixe vazio para manter)' : gw.gateway === 'stripe' ? 'sk_test_...' : 'Chave secreta'}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Chave pública (Stripe) */}
          {gw.gateway === 'stripe' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Publishable Key</label>
              <input
                value={publicKey} onChange={e => setPublicKey(e.target.value)}
                placeholder="pk_test_..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Webhook secret */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Webhook Secret {gw.webhookConfigured && <span className="text-green-600 font-normal">✓ configurado</span>}
            </label>
            <input
              type="password" value={webhookSecret} onChange={e => setWebhookSecret(e.target.value)}
              placeholder={gw.webhookConfigured ? 'Novo secret (deixe vazio para manter)' : gw.gateway === 'stripe' ? 'whsec_...' : 'Webhook secret'}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-400 mt-1">
              URL do webhook:{' '}
              <code className="bg-slate-100 px-1 rounded text-[10px]">
                {baseUrl}{WEBHOOK_URLS[gw.gateway]}
              </code>
            </p>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
          {saved && <p className="text-xs text-green-600">Salvo com sucesso!</p>}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex gap-3 justify-end">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function GatewaysClient() {
  const [gateways, setGateways] = useState<GatewayData[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<GatewayData | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/gateways')
      if (res.ok) setGateways((await res.json()).gateways)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Meios de Pagamento</h1>
        <p className="text-sm text-slate-500 mt-1">Configure as credenciais dos gateways de pagamento.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {gateways.map(gw => (
            <div key={gw.gateway} className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-start justify-between gap-4">
                {/* Info */}
                <div className="flex items-start gap-3">
                  <span className="text-2xl mt-0.5">{GATEWAY_ICONS[gw.gateway]}</span>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-900">{gw.label}</p>
                      <StatusBadge ok={gw.ativo} label={gw.ativo ? 'Ativo' : 'Inativo'} />
                      {gw.ativo && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${gw.modoTeste ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                          {gw.modoTeste ? '🧪 Teste' : '🚀 Produção'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className={`text-xs flex items-center gap-1 ${gw.secretKeyMasked ? 'text-green-600' : 'text-slate-400'}`}>
                        {gw.secretKeyMasked ? `🔑 ${gw.secretKeyMasked}` : '🔑 Chave não configurada'}
                      </span>
                      <span className={`text-xs flex items-center gap-1 ${gw.webhookConfigured ? 'text-green-600' : 'text-slate-400'}`}>
                        {gw.webhookConfigured ? '🔔 Webhook configurado' : '🔔 Webhook não configurado'}
                      </span>
                      {gw.updatedAt && (
                        <span className="text-[10px] text-slate-300">
                          Atualizado {new Date(gw.updatedAt).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Ações */}
                <button
                  onClick={() => setModal(gw)}
                  className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Configurar
                </button>
              </div>

              {/* Instrução webhook */}
              {gw.ativo && (
                <div className="mt-3 pt-3 border-t border-slate-50">
                  <p className="text-xs text-slate-500">
                    URL do webhook:{' '}
                    <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-mono">
                      https://app.farmasign.com.br{WEBHOOK_URLS[gw.gateway]}
                    </code>
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modal && (
        <GatewayModal
          gw={modal}
          onClose={() => setModal(null)}
          onSaved={load}
        />
      )}
    </div>
  )
}
