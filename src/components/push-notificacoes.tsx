'use client'

import { useEffect, useState, useCallback } from 'react'

interface ConfigAlerta {
  horaLimiteTemp: string
  diasAntecedEquip: number
  alertaTemp: boolean
  alertaEquip: boolean
  alertaValidade: boolean
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export function PushNotificacoes() {
  const [supported, setSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  const [config, setConfig] = useState<ConfigAlerta>({
    horaLimiteTemp: '18:00',
    diasAntecedEquip: 30,
    alertaTemp: true,
    alertaEquip: true,
    alertaValidade: true,
  })
  const [configLoading, setConfigLoading] = useState(false)
  const [configMsg, setConfigMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [testLoading, setTestLoading] = useState(false)

  const checkSubscription = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    setSubscribed(!!sub)
  }, [])

  useEffect(() => {
    setSupported('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window)
    setPermission(Notification.permission)
    checkSubscription()

    fetch('/api/notificacoes/config')
      .then(r => r.json())
      .then((d: ConfigAlerta) => setConfig(d))
      .catch(() => null)
  }, [checkSubscription])

  async function handleSubscribe() {
    setLoading(true)
    setMsg(null)
    try {
      let perm = Notification.permission
      if (perm === 'default') {
        perm = await Notification.requestPermission()
        setPermission(perm)
      }
      if (perm !== 'granted') {
        setMsg({ tipo: 'erro', texto: 'Permissão negada. Habilite notificações nas configurações do navegador.' })
        return
      }

      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      })

      const json = sub.toJSON()
      await fetch('/api/notificacoes/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      })

      setSubscribed(true)
      setMsg({ tipo: 'ok', texto: 'Notificações ativadas neste dispositivo.' })
    } catch (err) {
      setMsg({ tipo: 'erro', texto: (err as Error).message })
    } finally {
      setLoading(false)
    }
  }

  async function handleUnsubscribe() {
    setLoading(true)
    setMsg(null)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/notificacoes/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setSubscribed(false)
      setMsg({ tipo: 'ok', texto: 'Notificações desativadas neste dispositivo.' })
    } catch (err) {
      setMsg({ tipo: 'erro', texto: (err as Error).message })
    } finally {
      setLoading(false)
    }
  }

  async function sendTest(tipo: string) {
    setTestLoading(true)
    setMsg(null)
    try {
      const res = await fetch('/api/notificacoes/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo }),
      })
      const data = await res.json() as { enviadas?: number; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Erro')
      setMsg({ tipo: 'ok', texto: `Notificação de teste enviada (${data.enviadas} dispositivo(s)).` })
    } catch (err) {
      setMsg({ tipo: 'erro', texto: (err as Error).message })
    } finally {
      setTestLoading(false)
    }
  }

  async function saveConfig(e: React.FormEvent) {
    e.preventDefault()
    setConfigLoading(true)
    setConfigMsg(null)
    try {
      const res = await fetch('/api/notificacoes/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!res.ok) throw new Error('Erro ao salvar')
      setConfigMsg({ tipo: 'ok', texto: 'Configurações salvas.' })
    } catch (err) {
      setConfigMsg({ tipo: 'erro', texto: (err as Error).message })
    } finally {
      setConfigLoading(false)
    }
  }

  if (!supported) return null

  return (
    <section className="mt-8">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Notificações</p>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Ativação */}
        <div className="px-5 py-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-semibold text-slate-800">Push Notifications</p>
              {subscribed ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                  Ativo
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-slate-50 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                  Inativo
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500">
              Receba alertas no dispositivo quando temperaturas não forem registradas, laudos estiverem vencendo ou lotes próximos ao vencimento.
            </p>

            {msg && (
              <div className={`mt-3 flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${msg.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                {msg.texto}
              </div>
            )}
          </div>
        </div>

        <div className="px-5 pb-5 border-t border-slate-100 pt-4 flex flex-wrap gap-2">
          {subscribed ? (
            <>
            <button
              type="button"
              onClick={handleUnsubscribe}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 hover:bg-red-100 disabled:opacity-40 text-red-700 text-sm font-medium rounded-lg transition-colors"
            >
              {loading ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
              )}
              Desativar neste dispositivo
            </button>
            <button
              type="button"
              onClick={() => sendTest('temperatura')}
              disabled={testLoading}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 disabled:opacity-40 text-slate-600 text-sm font-medium rounded-lg transition-colors"
            >
              {testLoading ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              )}
              Enviar notificação de teste
            </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleSubscribe}
              disabled={loading || permission === 'denied'}
              className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {loading ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
              )}
              {permission === 'denied' ? 'Permissão bloqueada no navegador' : 'Ativar notificações neste dispositivo'}
            </button>
          )}
        </div>

        {/* Config de alertas */}
        {subscribed && (
          <div className="border-t border-slate-100">
            <form onSubmit={saveConfig} className="px-5 py-5 space-y-4">
              <p className="text-sm font-medium text-slate-700">Configurar alertas</p>

              <div className="space-y-3">
                <label className="flex items-center justify-between gap-4 cursor-pointer">
                  <span className="text-sm text-slate-600">Temperatura não registrada</span>
                  <input
                    type="checkbox"
                    checked={config.alertaTemp}
                    onChange={e => setConfig(c => ({ ...c, alertaTemp: e.target.checked }))}
                    className="w-4 h-4 accent-violet-600"
                  />
                </label>

                {config.alertaTemp && (
                  <div className="ml-0 flex items-center gap-3">
                    <label className="text-xs text-slate-500 whitespace-nowrap">Alertar após</label>
                    <input
                      type="time"
                      value={config.horaLimiteTemp}
                      onChange={e => setConfig(c => ({ ...c, horaLimiteTemp: e.target.value }))}
                      className="px-2 py-1 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                    />
                    <span className="text-xs text-slate-400">se leitura não realizada</span>
                  </div>
                )}

                <label className="flex items-center justify-between gap-4 cursor-pointer">
                  <span className="text-sm text-slate-600">Calibração de equipamentos vencendo</span>
                  <input
                    type="checkbox"
                    checked={config.alertaEquip}
                    onChange={e => setConfig(c => ({ ...c, alertaEquip: e.target.checked }))}
                    className="w-4 h-4 accent-violet-600"
                  />
                </label>

                <label className="flex items-center justify-between gap-4 cursor-pointer">
                  <span className="text-sm text-slate-600">Lotes próximos ao vencimento</span>
                  <input
                    type="checkbox"
                    checked={config.alertaValidade}
                    onChange={e => setConfig(c => ({ ...c, alertaValidade: e.target.checked }))}
                    className="w-4 h-4 accent-violet-600"
                  />
                </label>
              </div>

              {configMsg && (
                <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${configMsg.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                  {configMsg.texto}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={configLoading}
                  className="px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 disabled:opacity-60 transition-colors"
                >
                  {configLoading ? 'Salvando…' : 'Salvar configurações'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </section>
  )
}
