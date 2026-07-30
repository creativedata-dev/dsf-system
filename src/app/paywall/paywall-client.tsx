'use client'

import { useState } from 'react'

interface Plano {
  id: string
  nome: string
  tipo: string
  precoMensal: number | null
  precoAnual: number | null
  limiteUsuarios: number | null
  limiteDsfsMes: number | null
}

function fmtBRL(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function PlanoCard({ plano }: { plano: Plano }) {
  const [cadencia, setCadencia] = useState<'mensal' | 'anual' | 'unico'>(
    plano.tipo === 'VITALICIO' ? 'unico' : 'mensal'
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isVitalicio = plano.tipo === 'VITALICIO'
  const preco = cadencia === 'anual' ? plano.precoAnual : plano.precoMensal
  const precoAnualTotal = plano.precoAnual
  const descontoAnual = plano.precoMensal && plano.precoAnual
    ? Math.round((1 - plano.precoAnual / (plano.precoMensal * 12)) * 100)
    : 0

  async function handleCheckout() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/stripe/checkout-self', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planoId: plano.id, cadencia }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Erro ao gerar link'); return }
      window.location.href = json.url
    } catch { setError('Falha de conexão') }
    finally { setLoading(false) }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
      <div>
        <h3 className="text-lg font-bold text-slate-900">{plano.nome}</h3>
        <div className="flex items-baseline gap-1 mt-2">
          {preco ? (
            <>
              <span className="text-3xl font-bold text-slate-900">{fmtBRL(preco)}</span>
              {!isVitalicio && <span className="text-sm text-slate-500">/{cadencia === 'anual' ? 'mês' : 'mês'}</span>}
            </>
          ) : (
            <span className="text-slate-400 text-sm">Preço não configurado</span>
          )}
        </div>
        {cadencia === 'anual' && precoAnualTotal && (
          <p className="text-xs text-slate-500 mt-0.5">
            Cobrado {fmtBRL(precoAnualTotal)}/ano
            {descontoAnual > 0 && <span className="ml-1 text-green-600 font-medium">· {descontoAnual}% de desconto</span>}
          </p>
        )}
      </div>

      {/* Toggle mensal/anual */}
      {!isVitalicio && plano.precoAnual && (
        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm">
          <button
            onClick={() => setCadencia('mensal')}
            className={`flex-1 py-1.5 font-medium transition-colors ${cadencia === 'mensal' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            Mensal
          </button>
          <button
            onClick={() => setCadencia('anual')}
            className={`flex-1 py-1.5 font-medium transition-colors ${cadencia === 'anual' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            Anual {descontoAnual > 0 && <span className="text-[10px] opacity-80">-{descontoAnual}%</span>}
          </button>
        </div>
      )}

      {/* Limites */}
      <ul className="space-y-1.5 text-sm text-slate-600">
        <li className="flex items-center gap-2">
          <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {plano.limiteUsuarios ? `Até ${plano.limiteUsuarios} usuário${plano.limiteUsuarios > 1 ? 's' : ''}` : 'Usuários ilimitados'}
        </li>
        <li className="flex items-center gap-2">
          <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {plano.limiteDsfsMes ? `${plano.limiteDsfsMes} DSFs/mês` : 'DSFs ilimitados'}
        </li>
        <li className="flex items-center gap-2">
          <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Todos os módulos incluídos
        </li>
      </ul>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        onClick={handleCheckout}
        disabled={loading || !preco}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
      >
        {loading ? 'Aguarde…' : 'Assinar agora'}
      </button>
    </div>
  )
}

export function PaywallClient({ status, planos }: {
  status: string
  planos: Plano[]
}) {
  const isCancelada = status === 'CANCELADA'

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-12">
      {/* Header */}
      <div className="text-center mb-10 max-w-lg">
        <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          {isCancelada ? 'Assinatura cancelada' : 'Período de trial encerrado'}
        </h1>
        <p className="text-slate-500">
          {isCancelada
            ? 'Sua assinatura foi cancelada. Escolha um plano abaixo para reativar o acesso.'
            : 'Seu período de teste chegou ao fim. Continue usando o FarmaSign escolhendo o plano ideal para a sua farmácia.'}
        </p>
      </div>

      {/* Planos */}
      {planos.length > 0 ? (
        <div className={`w-full max-w-4xl grid gap-6 ${planos.length === 1 ? 'max-w-sm' : planos.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
          {planos.map(p => <PlanoCard key={p.id} plano={p} />)}
        </div>
      ) : (
        <div className="bg-slate-50 rounded-2xl p-8 text-center max-w-sm">
          <p className="text-slate-500 text-sm mb-4">Nenhum plano disponível no momento.</p>
          <a
            href="mailto:suporte@farmasign.com.br"
            className="inline-flex px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
          >
            Falar com o suporte
          </a>
        </div>
      )}

      {/* Suporte */}
      <p className="mt-8 text-sm text-slate-400">
        Dúvidas?{' '}
        <a href="mailto:suporte@farmasign.com.br" className="text-blue-600 hover:underline">
          suporte@farmasign.com.br
        </a>
      </p>
    </div>
  )
}
