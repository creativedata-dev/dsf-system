'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'

interface OpcaoQuiz {
  letra: string
  texto: string
}

interface Questao {
  id: string
  ordem: number
  enunciado: string
  opcoes: OpcaoQuiz[]
}

interface FeedbackQuestao {
  questaoId: string
  correto: boolean
  respostaCorreta: string
  justificativa: string | null
}

interface PopResumo {
  id: string
  codigo: string
  titulo: string
  versao: string
  baseLegal: string | null
  objetivo: string | null
  minAcertos: number
  concluido: boolean
  totalQuestoes: number
}

interface PopDetalhe extends PopResumo {
  conteudo: string
  questoes: Questao[]
  jaAssinou: boolean
  ultimaTentativa: {
    acertos: number
    totalQuestoes: number
    aprovado: boolean
    createdAt: string
  } | null
}

type Modo = 'lista' | 'lendo' | 'quiz' | 'termo' | 'resultado'

interface ResultadoData {
  aprovado: boolean
  acertos: number
  totalQuestoes: number
  minAcertos: number
  feedback: FeedbackQuestao[]
  jaConcluidoAntes?: boolean
}

interface EquipeData {
  usuarios: { id: string; nome: string; email: string }[]
  pops: { id: string; codigo: string; titulo: string }[]
  concluidos: string[] // "usuarioId:documentoId"
}

function IconCheck({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}
function IconX({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}
function IconArrowLeft({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  )
}
function IconArrowRight({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}

export default function PopsPage() {
  const { data: session } = useSession()
  const isGestor = session?.user?.permissions?.includes('POPS_GERENCIAR') ||
                   session?.user?.permissions?.includes('SUPER_ADMIN_GLOBAIS')

  const [pops, setPops] = useState<PopResumo[]>([])
  const [popAtual, setPopAtual] = useState<PopDetalhe | null>(null)
  const [modo, setModo] = useState<Modo>('lista')
  const [loading, setLoading] = useState(true)
  const [carregandoPop, setCarregandoPop] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [aceitandoTermo, setAceitandoTermo] = useState(false)
  const [respostas, setRespostas] = useState<Record<string, string>>({})
  const [resultado, setResultado] = useState<ResultadoData | null>(null)
  const [erro, setErro] = useState('')
  const [termoAceitoEm, setTermoAceitoEm] = useState<string | null>(null)

  const [abaLista, setAbaLista] = useState<'meu' | 'equipe'>('equipe')
  const [equipe, setEquipe] = useState<EquipeData | null>(null)
  const [loadingEquipe, setLoadingEquipe] = useState(false)

  const fetchPops = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/pops')
      if (res.ok) setPops(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchEquipe = useCallback(async () => {
    setLoadingEquipe(true)
    try {
      const res = await fetch('/api/admin/pops/equipe')
      if (res.ok) setEquipe(await res.json())
    } finally {
      setLoadingEquipe(false)
    }
  }, [])

  useEffect(() => { fetchPops() }, [fetchPops])
  useEffect(() => { if (isGestor && !equipe) fetchEquipe() }, [isGestor, equipe, fetchEquipe])

  async function abrirPop(id: string) {
    setCarregandoPop(true)
    setErro('')
    try {
      const res = await fetch(`/api/pops/${id}`)
      if (!res.ok) { setErro('Erro ao carregar POP'); return }
      const data: PopDetalhe = await res.json()
      setPopAtual(data)
      setRespostas({})
      setResultado(null)
      setTermoAceitoEm(null)
      setModo('lendo')
    } finally {
      setCarregandoPop(false)
    }
  }

  async function enviarQuiz() {
    if (!popAtual) return
    const totalQ = popAtual.questoes.length
    if (Object.keys(respostas).length < totalQ) {
      setErro(`Responda todas as ${totalQ} questões antes de enviar.`)
      return
    }
    setEnviando(true)
    setErro('')
    try {
      const res = await fetch(`/api/pops/${popAtual.id}/concluir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ respostas }),
      })
      const data: ResultadoData = await res.json()
      setResultado(data)
      if (data.aprovado && !data.jaConcluidoAntes) {
        setModo('termo')
      } else {
        setModo('resultado')
        fetchPops()
      }
    } finally {
      setEnviando(false)
    }
  }

  async function aceitarTermo() {
    if (!popAtual) return
    setAceitandoTermo(true)
    try {
      const res = await fetch(`/api/pops/${popAtual.id}/aceitar-termo`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setTermoAceitoEm(data.termoAceitoEm)
        setModo('resultado')
        fetchPops()
      } else {
        setErro(data.error ?? 'Erro ao registrar termo')
        setModo('resultado')
      }
    } finally {
      setAceitandoTermo(false)
    }
  }

  function voltarLista() {
    setModo('lista')
    setPopAtual(null)
    setRespostas({})
    setResultado(null)
    setErro('')
    setTermoAceitoEm(null)
  }

  function parseSections(conteudo: string) {
    return conteudo
      .split(/\n### /)
      .filter(p => p.trim())
      .map(p => {
        const idx = p.indexOf('\n')
        if (idx === -1) return { titulo: p.trim(), corpo: '' }
        return { titulo: p.slice(0, idx).trim(), corpo: p.slice(idx + 1).trim() }
      })
  }

  const pendentes = pops.filter(p => !p.concluido).length
  const concluidos = pops.filter(p => p.concluido).length

  // ── Lista de POPs ─────────────────────────────────────────────────────────────
  if (modo === 'lista') {
    const totalPops = pops.length
    const pct = totalPops > 0 ? Math.round((concluidos / totalPops) * 100) : 0

    return (
      <div className="p-4 sm:p-6 max-w-5xl mx-auto">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-slate-900">POPs e Treinamentos</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Leia cada POP e conclua o quiz para registrar sua ciência.
          </p>
        </div>

        {/* Tabs — só para gestores */}
        {isGestor && (
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-5 w-fit">
            <button
              onClick={() => setAbaLista('equipe')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${abaLista === 'equipe' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Equipe
            </button>
            <button
              onClick={() => setAbaLista('meu')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${abaLista === 'meu' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Meu Treinamento
            </button>
          </div>
        )}

        {/* ── ABA EQUIPE ── */}
        {abaLista === 'equipe' && isGestor && (() => {
          if (loadingEquipe || !equipe) {
            return <div className="text-center py-16 text-slate-400 text-sm">Carregando...</div>
          }

          const done = new Set(equipe.concluidos)
          const nTotal = equipe.pops.length
          const nUsuarios = equipe.usuarios.length

          // % geral da equipe
          const totalConcluidosGeral = equipe.usuarios.reduce(
            (sum, u) => sum + equipe.pops.filter(p => done.has(`${u.id}:${p.id}`)).length, 0
          )
          const pctGeral = nTotal * nUsuarios > 0
            ? Math.round((totalConcluidosGeral / (nTotal * nUsuarios)) * 100)
            : 0

          return (
            <div className="space-y-5">
              {/* Barra de progresso geral */}
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-slate-700">Progresso geral da equipe</p>
                  <span className={`text-sm font-bold ${pctGeral === 100 ? 'text-emerald-600' : pctGeral > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                    {pctGeral}%
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${pctGeral === 100 ? 'bg-emerald-500' : 'bg-amber-400'}`}
                    style={{ width: `${pctGeral}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1.5">
                  {totalConcluidosGeral} de {nTotal * nUsuarios} treinamentos concluídos
                </p>
              </div>

              {/* Lista de funcionários: Nome | status */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status por funcionário</p>
                </div>
                <div className="divide-y divide-slate-100">
                  {equipe.usuarios.map(u => {
                    const n = equipe.pops.filter(p => done.has(`${u.id}:${p.id}`)).length
                    const uPct = nTotal > 0 ? Math.round((n / nTotal) * 100) : 0
                    const status = n === nTotal
                      ? { label: 'Concluído', cls: 'bg-emerald-100 text-emerald-700' }
                      : n > 0
                      ? { label: `Parcial ${n}/${nTotal}`, cls: 'bg-amber-100 text-amber-700' }
                      : { label: 'Não iniciou', cls: 'bg-slate-100 text-slate-500' }
                    return (
                      <div key={u.id} className="flex items-center gap-4 px-4 py-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">
                          {u.nome.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{u.nome}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-[120px]">
                              <div
                                className={`h-full rounded-full ${n === nTotal ? 'bg-emerald-500' : n > 0 ? 'bg-amber-400' : 'bg-slate-200'}`}
                                style={{ width: `${uPct}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-400">{n}/{nTotal}</span>
                          </div>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${status.cls}`}>
                          {status.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })()}

        {/* ── ABA MEU TREINAMENTO ── */}
        {abaLista === 'meu' && <>
        {/* Barra de progresso pessoal */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-slate-700">Meu progresso</p>
            <span className={`text-sm font-bold ${pct === 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {pct}%
            </span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : 'bg-amber-400'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-1.5">
            {concluidos} de {totalPops} POPs concluídos
          </p>
        </div>

        {/* Alerta de pendentes */}
        {pendentes > 0 && (
          <div className="mb-5 flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
            <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 00-3.42 0z" />
            </svg>
            <p className="text-sm text-amber-800">
              <strong>{pendentes} POP{pendentes > 1 ? 's' : ''} pendente{pendentes > 1 ? 's' : ''}.</strong>{' '}
              Conclua todos os treinamentos para manter a conformidade com a RDC 44/2009.
            </p>
          </div>
        )}

        {loading ? (
          <div className="text-center py-10 text-slate-400 text-sm">Carregando POPs...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pops.map(pop => (
              <button
                key={pop.id}
                onClick={() => abrirPop(pop.id)}
                disabled={carregandoPop}
                className={`text-left bg-white rounded-xl border p-4 hover:shadow-md transition-all group flex flex-col gap-3 ${
                  pop.concluido ? 'border-emerald-200 hover:border-emerald-300' : 'border-slate-200 hover:border-blue-300'
                }`}
              >
                <div className={`h-1 -mx-4 -mt-4 rounded-t-xl ${pop.concluido ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <div className="flex items-start justify-between gap-2">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold ${
                    pop.concluido ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {pop.codigo.replace('POP-', '')}
                  </div>
                  {pop.concluido ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 shrink-0">
                      <IconCheck className="w-3 h-3" />Concluído
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 shrink-0">
                      Pendente
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-slate-400 mb-0.5">{pop.codigo}</p>
                  <p className="text-sm font-semibold text-slate-800 group-hover:text-blue-700 transition-colors leading-snug">{pop.titulo}</p>
                  {pop.baseLegal && <p className="text-xs text-slate-400 mt-1">{pop.baseLegal}</p>}
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>{pop.totalQuestoes} questões</span>
                  <IconArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-400 transition-colors" />
                </div>
              </button>
            ))}
          </div>
        )}
        </>}
      </div>
    )
  }

  if (!popAtual) return null

  // ── Leitura do POP ────────────────────────────────────────────────────────────
  if (modo === 'lendo') {
    const sections = parseSections(popAtual.conteudo)
    return (
      <div className="max-w-3xl mx-auto">
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
          <button onClick={voltarLista} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <IconArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-400 font-medium">{popAtual.codigo}</p>
            <p className="text-sm font-bold text-slate-900 truncate">{popAtual.titulo}</p>
          </div>
          {popAtual.jaAssinou && (
            <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">
              <IconCheck className="w-3 h-3" />
              Concluído
            </span>
          )}
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          {(popAtual.baseLegal || popAtual.objetivo) && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-1">
              {popAtual.baseLegal && <p className="text-xs text-blue-600 font-medium">{popAtual.baseLegal}</p>}
              {popAtual.objetivo && <p className="text-sm text-blue-900">{popAtual.objetivo}</p>}
            </div>
          )}

          {sections.map((section, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
              <h3 className="font-semibold text-slate-900 mb-3 text-sm">{section.titulo}</h3>
              <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{section.corpo}</div>
            </div>
          ))}

          <div className="bg-white rounded-xl border border-slate-200 p-5 text-center space-y-3">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-slate-900 text-sm">Quiz de Verificação</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {popAtual.questoes.length} questões — mínimo {popAtual.minAcertos}/{popAtual.questoes.length} acertos
              </p>
            </div>
            {popAtual.jaAssinou ? (
              <div className="space-y-2">
                <p className="text-xs text-emerald-600 font-medium">Você já concluiu este POP.</p>
                <button onClick={() => setModo('quiz')} className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors">
                  Refazer o Quiz
                </button>
              </div>
            ) : (
              <button onClick={() => { setRespostas({}); setModo('quiz') }} className="w-full py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors">
                Iniciar Quiz
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Quiz ──────────────────────────────────────────────────────────────────────
  if (modo === 'quiz') {
    const todasRespondidas = Object.keys(respostas).length === popAtual.questoes.length
    return (
      <div className="max-w-2xl mx-auto">
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setModo('lendo')} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <IconArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <p className="text-xs text-slate-400">{popAtual.codigo} — Quiz</p>
            <p className="text-sm font-bold text-slate-900">{Object.keys(respostas).length}/{popAtual.questoes.length} respondidas</p>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-5">
          {popAtual.questoes.map((q, idx) => (
            <div key={q.id} className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
              <p className="text-xs font-semibold text-slate-400 mb-2">Questão {idx + 1}</p>
              <p className="text-sm font-medium text-slate-900 mb-4 leading-relaxed">{q.enunciado}</p>
              <div className="space-y-2">
                {(q.opcoes as OpcaoQuiz[]).map(op => {
                  const sel = respostas[q.id] === op.letra
                  return (
                    <button
                      key={op.letra}
                      onClick={() => setRespostas(prev => ({ ...prev, [q.id]: op.letra }))}
                      className={`w-full text-left flex items-start gap-3 p-3 rounded-lg border text-sm transition-all ${
                        sel ? 'border-blue-400 bg-blue-50 text-blue-900' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold mt-0.5 ${
                        sel ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-300 text-slate-500'
                      }`}>{op.letra.toUpperCase()}</span>
                      <span className="leading-relaxed">{op.texto}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {erro && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{erro}</p>}

          <button
            onClick={enviarQuiz}
            disabled={!todasRespondidas || enviando}
            className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors ${
              todasRespondidas && !enviando ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            {enviando ? 'Enviando...' : 'Enviar Respostas'}
          </button>
        </div>
      </div>
    )
  }

  // ── Termo de Ciência ──────────────────────────────────────────────────────────
  if (modo === 'termo' && resultado) {
    return (
      <div className="max-w-xl mx-auto p-4 sm:p-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Header verde */}
          <div className="bg-emerald-50 border-b border-emerald-100 px-6 py-5 text-center">
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <IconCheck className="w-7 h-7 text-emerald-600" />
            </div>
            <p className="text-lg font-bold text-emerald-800">Parabéns! Você foi aprovado.</p>
            <p className="text-sm text-emerald-600 mt-1">
              {resultado.acertos} de {resultado.totalQuestoes} acertos
            </p>
          </div>

          {/* Termo */}
          <div className="px-6 py-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Termo de Ciência</h2>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700 leading-relaxed space-y-3">
              <p>
                Declaro que li e compreendi integralmente o conteúdo do procedimento{' '}
                <strong>{popAtual?.codigo} — {popAtual?.titulo}</strong>,
                incluindo todas as suas orientações, normas e responsabilidades.
              </p>
              <p>
                Estou ciente de que devo cumprir o disposto neste POP no exercício das minhas atividades,
                em conformidade com a legislação sanitária vigente (RDC 44/2009 e demais normas aplicáveis).
              </p>
              <p>
                Este registro constitui minha assinatura eletrônica de ciência, com validade legal nos termos
                da Lei nº 14.063/2020.
              </p>
            </div>

            {erro && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{erro}</p>}

            <button
              onClick={aceitarTermo}
              disabled={aceitandoTermo}
              className="w-full py-3 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 transition-colors"
            >
              {aceitandoTermo ? 'Registrando...' : 'Estou de acordo — Registrar Ciência'}
            </button>

            <button onClick={voltarLista} className="w-full py-2 rounded-xl text-sm text-slate-500 hover:text-slate-700 transition-colors">
              Voltar à lista
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Resultado ─────────────────────────────────────────────────────────────────
  if (modo === 'resultado' && resultado) {
    return (
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-5">
        <div className={`rounded-2xl p-6 text-center ${resultado.aprovado ? 'bg-emerald-50 border-2 border-emerald-200' : 'bg-red-50 border-2 border-red-200'}`}>
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${resultado.aprovado ? 'bg-emerald-100' : 'bg-red-100'}`}>
            {resultado.aprovado
              ? <IconCheck className="w-8 h-8 text-emerald-600" />
              : <IconX className="w-8 h-8 text-red-500" />}
          </div>
          <p className={`text-xl font-bold mb-1 ${resultado.aprovado ? 'text-emerald-800' : 'text-red-800'}`}>
            {resultado.aprovado ? 'POP Concluído!' : 'Não Aprovado'}
          </p>
          <p className={`text-sm ${resultado.aprovado ? 'text-emerald-600' : 'text-red-600'}`}>
            {resultado.acertos} de {resultado.totalQuestoes} acertos (mínimo: {resultado.minAcertos})
          </p>
          {resultado.aprovado && termoAceitoEm && (
            <p className="text-xs text-emerald-600 mt-2 font-medium">
              Ciência registrada em {new Date(termoAceitoEm).toLocaleString('pt-BR')}
            </p>
          )}
          {!resultado.aprovado && (
            <p className="text-xs text-red-600 mt-2">Revise o conteúdo e tente novamente.</p>
          )}
        </div>

        {resultado.feedback && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-700">Gabarito comentado:</p>
            {resultado.feedback.map((f, idx) => {
              const questao = popAtual?.questoes.find(q => q.id === f.questaoId)
              return (
                <div key={f.questaoId} className={`bg-white rounded-xl border p-4 ${f.correto ? 'border-emerald-200' : 'border-red-200'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${f.correto ? 'bg-emerald-100' : 'bg-red-100'}`}>
                      {f.correto
                        ? <IconCheck className="w-3 h-3 text-emerald-600" />
                        : <IconX className="w-3 h-3 text-red-500" />}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">Questão {idx + 1}</span>
                  </div>
                  {questao && <p className="text-xs text-slate-700 mb-2 leading-relaxed">{questao.enunciado}</p>}
                  {!f.correto && (
                    <p className="text-xs text-slate-500 mb-1">
                      Sua resposta: <span className="font-semibold text-red-600">{respostas[f.questaoId]?.toUpperCase()}</span>
                      {' | '}Correta: <span className="font-semibold text-emerald-600">{f.respostaCorreta.toUpperCase()}</span>
                    </p>
                  )}
                  {f.justificativa && (
                    <p className="text-xs text-slate-600 bg-slate-50 rounded-lg p-2 mt-1 leading-relaxed">{f.justificativa}</p>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={voltarLista} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors">
            Voltar à Lista
          </button>
          {!resultado.aprovado && (
            <button onClick={() => { setRespostas({}); setModo('quiz') }} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors">
              Tentar Novamente
            </button>
          )}
        </div>
      </div>
    )
  }

  return null
}
