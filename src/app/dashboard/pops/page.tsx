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

type Modo = 'lista' | 'lendo' | 'quiz' | 'resultado'

interface ResultadoData {
  aprovado: boolean
  acertos: number
  totalQuestoes: number
  minAcertos: number
  feedback: FeedbackQuestao[]
  jaConcluidoAntes?: boolean
}

export default function PopsPage() {
  const { data: session } = useSession()
  const [pops, setPops] = useState<PopResumo[]>([])
  const [popAtual, setPopAtual] = useState<PopDetalhe | null>(null)
  const [modo, setModo] = useState<Modo>('lista')
  const [loading, setLoading] = useState(true)
  const [carregandoPop, setCarregandoPop] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [respostas, setRespostas] = useState<Record<string, string>>({})
  const [resultado, setResultado] = useState<ResultadoData | null>(null)
  const [erro, setErro] = useState('')

  const fetchPops = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/pops')
      if (res.ok) {
        const data = await res.json()
        setPops(data)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPops() }, [fetchPops])

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
      const data = await res.json()
      setResultado(data)
      setModo('resultado')
      fetchPops()
    } finally {
      setEnviando(false)
    }
  }

  function voltarLista() {
    setModo('lista')
    setPopAtual(null)
    setRespostas({})
    setResultado(null)
    setErro('')
  }

  // Parse das seções do conteúdo
  function parseSections(conteudo: string) {
    const parts = conteudo.split(/\n### /)
    return parts
      .filter(p => p.trim())
      .map(p => {
        const idx = p.indexOf('\n')
        if (idx === -1) return { titulo: p.trim(), corpo: '' }
        return {
          titulo: p.slice(0, idx).trim(),
          corpo: p.slice(idx + 1).trim(),
        }
      })
  }

  const pendentes = pops.filter(p => !p.concluido).length
  const concluidos = pops.filter(p => p.concluido).length

  // ── Lista de POPs ──
  if (modo === 'lista') {
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-900">POPs e Treinamentos</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Procedimentos Operacionais Padrão — leia cada POP e conclua o quiz para registrar sua ciência.
          </p>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-2xl font-bold text-emerald-600">{concluidos}</p>
            <p className="text-xs text-slate-500 mt-0.5">Concluídos</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-2xl font-bold text-amber-600">{pendentes}</p>
            <p className="text-xs text-slate-500 mt-0.5">Pendentes</p>
          </div>
        </div>

        {pendentes > 0 && (
          <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
            <strong>{pendentes} POP{pendentes > 1 ? 's' : ''} pendente{pendentes > 1 ? 's' : ''}.</strong>{' '}
            Conclua todos os treinamentos para manter a conformidade com a RDC 44/2009.
          </div>
        )}

        {loading ? (
          <div className="text-center py-10 text-slate-400 text-sm">Carregando POPs...</div>
        ) : (
          <div className="space-y-2">
            {pops.map(pop => (
              <button
                key={pop.id}
                onClick={() => abrirPop(pop.id)}
                disabled={carregandoPop}
                className="w-full text-left bg-white rounded-xl border border-slate-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                    pop.concluido
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {pop.codigo.replace('POP-', '')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-slate-400">{pop.codigo}</span>
                      {pop.concluido ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          Concluído
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">
                          Pendente
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-slate-800 mt-0.5 group-hover:text-blue-700 transition-colors">
                      {pop.titulo}
                    </p>
                    {pop.baseLegal && (
                      <p className="text-xs text-slate-400 mt-0.5">{pop.baseLegal}</p>
                    )}
                  </div>
                  <svg className="w-4 h-4 text-slate-300 group-hover:text-blue-400 flex-shrink-0 mt-1 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (!popAtual) return null

  // ── Leitura do POP ──
  if (modo === 'lendo') {
    const sections = parseSections(popAtual.conteudo)

    return (
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
          <button
            onClick={voltarLista}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-400 font-medium">{popAtual.codigo}</p>
            <p className="text-sm font-bold text-slate-900 truncate">{popAtual.titulo}</p>
          </div>
          {popAtual.jaAssinou && (
            <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Concluído
            </span>
          )}
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          {/* Info do POP */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-2">
            {popAtual.baseLegal && (
              <p className="text-xs text-blue-600 font-medium">{popAtual.baseLegal}</p>
            )}
            {popAtual.objetivo && (
              <p className="text-sm text-blue-900">{popAtual.objetivo}</p>
            )}
          </div>

          {/* Seções de conteúdo */}
          {sections.map((section, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
              <h3 className="font-semibold text-slate-900 mb-3 text-sm">{section.titulo}</h3>
              <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                {section.corpo}
              </div>
            </div>
          ))}

          {/* Botão para iniciar quiz */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 text-center space-y-3">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-slate-900 text-sm">Quiz de Verificação</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {popAtual.questoes.length} questões — mínimo {popAtual.minAcertos}/{popAtual.questoes.length} acertos para concluir
              </p>
            </div>
            {popAtual.jaAssinou ? (
              <div className="space-y-2">
                <p className="text-xs text-emerald-600 font-medium">Você já concluiu este POP.</p>
                <button
                  onClick={() => setModo('quiz')}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  Refazer o Quiz
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setRespostas({}); setModo('quiz') }}
                className="w-full py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                Iniciar Quiz
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Quiz ──
  if (modo === 'quiz') {
    const todasRespondidas = Object.keys(respostas).length === popAtual.questoes.length

    return (
      <div className="max-w-2xl mx-auto">
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setModo('lendo')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <p className="text-xs text-slate-400">{popAtual.codigo} — Quiz</p>
            <p className="text-sm font-bold text-slate-900">
              {Object.keys(respostas).length}/{popAtual.questoes.length} respondidas
            </p>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-5">
          {popAtual.questoes.map((q, idx) => (
            <div key={q.id} className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
              <p className="text-xs font-semibold text-slate-400 mb-2">Questão {idx + 1}</p>
              <p className="text-sm font-medium text-slate-900 mb-4 leading-relaxed">{q.enunciado}</p>
              <div className="space-y-2">
                {(q.opcoes as OpcaoQuiz[]).map(op => {
                  const selecionada = respostas[q.id] === op.letra
                  return (
                    <button
                      key={op.letra}
                      onClick={() => setRespostas(prev => ({ ...prev, [q.id]: op.letra }))}
                      className={`w-full text-left flex items-start gap-3 p-3 rounded-lg border text-sm transition-all ${
                        selecionada
                          ? 'border-blue-400 bg-blue-50 text-blue-900'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold mt-0.5 ${
                        selecionada ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-300 text-slate-500'
                      }`}>
                        {op.letra.toUpperCase()}
                      </span>
                      <span className="leading-relaxed">{op.texto}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {erro && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{erro}</p>
          )}

          <button
            onClick={enviarQuiz}
            disabled={!todasRespondidas || enviando}
            className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors ${
              todasRespondidas && !enviando
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            {enviando ? 'Enviando...' : 'Enviar Respostas'}
          </button>
        </div>
      </div>
    )
  }

  // ── Resultado ──
  if (modo === 'resultado' && resultado) {
    return (
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-5">
        {/* Card de resultado */}
        <div className={`rounded-2xl p-6 text-center ${
          resultado.aprovado
            ? 'bg-emerald-50 border-2 border-emerald-200'
            : 'bg-red-50 border-2 border-red-200'
        }`}>
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
            resultado.aprovado ? 'bg-emerald-100' : 'bg-red-100'
          }`}>
            {resultado.aprovado ? (
              <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>
          <p className={`text-xl font-bold mb-1 ${resultado.aprovado ? 'text-emerald-800' : 'text-red-800'}`}>
            {resultado.aprovado ? 'POP Concluído!' : 'Não Aprovado'}
          </p>
          <p className={`text-sm ${resultado.aprovado ? 'text-emerald-600' : 'text-red-600'}`}>
            {resultado.acertos} de {resultado.totalQuestoes} acertos
            {' '}(mínimo: {resultado.minAcertos})
          </p>
          {resultado.aprovado && (
            <p className="text-xs text-emerald-600 mt-2 font-medium">
              Sua conclusão foi registrada com data, hora e IP de origem.
            </p>
          )}
          {!resultado.aprovado && (
            <p className="text-xs text-red-600 mt-2">
              Revise o conteúdo e tente novamente — sem limite de tentativas.
            </p>
          )}
        </div>

        {/* Feedback por questão */}
        {resultado.feedback && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-700">Gabarito comentado:</p>
            {resultado.feedback.map((f, idx) => {
              const questao = popAtual?.questoes.find(q => q.id === f.questaoId)
              const respostaUsuario = respostas[f.questaoId]
              return (
                <div key={f.questaoId} className={`bg-white rounded-xl border p-4 ${
                  f.correto ? 'border-emerald-200' : 'border-red-200'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                      f.correto ? 'bg-emerald-100' : 'bg-red-100'
                    }`}>
                      {f.correto ? (
                        <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-3 h-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">Questão {idx + 1}</span>
                  </div>
                  {questao && (
                    <p className="text-xs text-slate-700 mb-2 leading-relaxed">{questao.enunciado}</p>
                  )}
                  {!f.correto && (
                    <p className="text-xs text-slate-500 mb-1">
                      Sua resposta: <span className="font-semibold text-red-600">{respostaUsuario?.toUpperCase()}</span>
                      {' | '}Correta: <span className="font-semibold text-emerald-600">{f.respostaCorreta.toUpperCase()}</span>
                    </p>
                  )}
                  {f.justificativa && (
                    <p className="text-xs text-slate-600 bg-slate-50 rounded-lg p-2 mt-1 leading-relaxed">
                      {f.justificativa}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Ações */}
        <div className="flex gap-3">
          <button
            onClick={voltarLista}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
          >
            Voltar à Lista
          </button>
          {!resultado.aprovado && (
            <button
              onClick={() => { setRespostas({}); setModo('quiz') }}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              Tentar Novamente
            </button>
          )}
        </div>
      </div>
    )
  }

  return null
}
