'use client'

import { useEffect, useState, useCallback } from 'react'

interface PopAdmin {
  id: string
  codigo: string
  titulo: string
  versao: string
  baseLegal: string | null
  vigente: boolean
  origem: 'global' | 'proprio'
  totalQuestoes: number
  concluiuCount: number
  totalUsuarios: number
  createdAt: string
}

interface QuestaoForm {
  ordem: number
  enunciado: string
  opcoes: { letra: string; texto: string }[]
  respostaCorreta: string
  justificativa: string
}

interface PopDetalhe {
  id: string
  codigo: string
  titulo: string
  baseLegal: string | null
  objetivo: string | null
  conteudo: string
  versao: string
  minAcertos: number
  vigente: boolean
  questoes: {
    id: string
    ordem: number
    enunciado: string
    opcoes: { letra: string; texto: string }[]
    respostaCorreta: string
    justificativa: string | null
  }[]
}

interface UsuarioStatus {
  id: string
  nome: string
  email: string
  concluido: boolean
  concluidoEm: string | null
  acertos: number | null
  totalQuestoes: number | null
}

type Aba = 'lista' | 'editar' | 'usuarios' | 'novo'

function novaQuestao(ordem: number): QuestaoForm {
  return {
    ordem,
    enunciado: '',
    opcoes: [
      { letra: 'a', texto: '' },
      { letra: 'b', texto: '' },
      { letra: 'c', texto: '' },
      { letra: 'd', texto: '' },
    ],
    respostaCorreta: 'a',
    justificativa: '',
  }
}

export default function ConfiguracoesPoPs() {
  const [pops, setPops] = useState<PopAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [aba, setAba] = useState<Aba>('lista')
  const [popSelecionado, setPopSelecionado] = useState<PopDetalhe | null>(null)
  const [usuariosStatus, setUsuariosStatus] = useState<UsuarioStatus[]>([])
  const [loadingDetalhe, setLoadingDetalhe] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [erroUsuarios, setErroUsuarios] = useState<string | null>(null)

  // Formulário de edição / novo
  const [fCodigo, setFCodigo] = useState('')
  const [fTitulo, setFTitulo] = useState('')
  const [fBaseLegal, setFBaseLegal] = useState('')
  const [fObjetivo, setFObjetivo] = useState('')
  const [fConteudo, setFConteudo] = useState('')
  const [fVersao, setFVersao] = useState('1.0')
  const [fMinAcertos, setFMinAcertos] = useState(2)
  const [fQuestoes, setFQuestoes] = useState<QuestaoForm[]>([novaQuestao(1)])

  const fetchPops = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/pops')
      if (res.ok) setPops(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPops() }, [fetchPops])

  async function abrirEditar(pop: PopAdmin) {
    setLoadingDetalhe(true)
    setMsg(null)
    try {
      const res = await fetch(`/api/admin/pops/${pop.id}`)
      const data: PopDetalhe = await res.json()
      setPopSelecionado(data)
      setFCodigo(data.codigo)
      setFTitulo(data.titulo)
      setFBaseLegal(data.baseLegal ?? '')
      setFObjetivo(data.objetivo ?? '')
      setFConteudo(data.conteudo)
      setFVersao(data.versao)
      setFMinAcertos(data.minAcertos)
      setFQuestoes(data.questoes.map(q => ({
        ordem: q.ordem,
        enunciado: q.enunciado,
        opcoes: q.opcoes,
        respostaCorreta: q.respostaCorreta,
        justificativa: q.justificativa ?? '',
      })))
      setAba('editar')
    } finally {
      setLoadingDetalhe(false)
    }
  }

  async function abrirUsuarios(pop: PopAdmin) {
    setPopSelecionado({ id: pop.id, codigo: pop.codigo, titulo: pop.titulo } as PopDetalhe)
    setUsuariosStatus([])
    setErroUsuarios(null)
    setLoadingDetalhe(true)
    setAba('usuarios')
    try {
      const res = await fetch(`/api/admin/pops/${pop.id}/usuarios`)
      const data = await res.json()
      if (!res.ok) {
        setErroUsuarios(data.error ?? `Erro ${res.status}`)
      } else {
        setUsuariosStatus(data)
      }
    } catch (e) {
      setErroUsuarios('Falha na requisição: ' + String(e))
    } finally {
      setLoadingDetalhe(false)
    }
  }

  function abrirNovo() {
    setPopSelecionado(null)
    setFCodigo('')
    setFTitulo('')
    setFBaseLegal('')
    setFObjetivo('')
    setFConteudo('')
    setFVersao('1.0')
    setFMinAcertos(2)
    setFQuestoes([novaQuestao(1)])
    setMsg(null)
    setAba('novo')
  }

  async function toggleVigente(pop: PopAdmin) {
    await fetch(`/api/admin/pops/${pop.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vigente: !pop.vigente }),
    })
    fetchPops()
  }

  async function salvar() {
    setSalvando(true)
    setMsg(null)
    try {
      const payload = {
        codigo: fCodigo,
        titulo: fTitulo,
        baseLegal: fBaseLegal || null,
        objetivo: fObjetivo || null,
        conteudo: fConteudo,
        versao: fVersao,
        minAcertos: fMinAcertos,
        questoes: fQuestoes,
      }

      let res: Response
      if (aba === 'novo') {
        res = await fetch('/api/admin/pops', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch(`/api/admin/pops/${popSelecionado!.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao salvar')
      setMsg({ tipo: 'ok', texto: aba === 'novo' ? 'POP criado com sucesso.' : 'POP atualizado com sucesso.' })
      fetchPops()
    } catch (e) {
      setMsg({ tipo: 'erro', texto: (e as Error).message })
    } finally {
      setSalvando(false)
    }
  }

  function atualizarQuestao(idx: number, campo: keyof QuestaoForm, valor: string | number) {
    setFQuestoes(prev => prev.map((q, i) => i === idx ? { ...q, [campo]: valor } : q))
  }

  function atualizarOpcao(qIdx: number, letra: string, texto: string) {
    setFQuestoes(prev => prev.map((q, i) =>
      i === qIdx
        ? { ...q, opcoes: q.opcoes.map(o => o.letra === letra ? { ...o, texto } : o) }
        : q
    ))
  }

  function adicionarQuestao() {
    setFQuestoes(prev => [...prev, novaQuestao(prev.length + 1)])
  }

  function removerQuestao(idx: number) {
    setFQuestoes(prev => prev.filter((_, i) => i !== idx).map((q, i) => ({ ...q, ordem: i + 1 })))
  }

  const concluidos = (pop: PopAdmin) => `${pop.concluiuCount}/${pop.totalUsuarios}`

  // ── LISTA ─────────────────────────────────────────────────────────────────────
  if (aba === 'lista') {
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Gestão de POPs</h1>
            <p className="text-sm text-slate-500 mt-0.5">Edite, habilite ou crie procedimentos e acompanhe treinamentos.</p>
          </div>
          <button
            onClick={abrirNovo}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Novo POP
          </button>
        </div>

        {loading ? (
          <div className="text-center py-10 text-slate-400 text-sm">Carregando...</div>
        ) : (
          <div className="space-y-2">
            {pops.map(pop => (
              <div key={pop.id} className={`bg-white rounded-xl border p-4 flex items-center gap-4 ${pop.vigente ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold ${pop.vigente ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-400'}`}>
                  {pop.codigo.replace('POP-', '')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-slate-400">{pop.codigo}</span>
                    {!pop.vigente && (
                      <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-slate-100 text-slate-500">Inativo</span>
                    )}
                    {pop.origem === 'global' && (
                      <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-indigo-50 text-indigo-500">Padrão</span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-slate-800 truncate">{pop.titulo}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    v{pop.versao} · {pop.totalQuestoes} questões · Concluído: {concluidos(pop)} usuários
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => abrirUsuarios(pop)}
                    title="Ver status de treinamento"
                    className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => abrirEditar(pop)}
                    disabled={loadingDetalhe}
                    title="Editar POP"
                    className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => toggleVigente(pop)}
                    title={pop.vigente ? 'Desativar' : 'Ativar'}
                    className={`p-2 rounded-lg transition-colors ${pop.vigente ? 'text-emerald-500 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'}`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      {pop.vigente
                        ? <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        : <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />}
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── STATUS DE USUÁRIOS ────────────────────────────────────────────────────────
  if (aba === 'usuarios') {
    const concluídos = usuariosStatus.filter(u => u.concluido).length
    const pendentes = usuariosStatus.filter(u => !u.concluido).length
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setAba('lista')} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <p className="text-xs text-slate-400 font-medium">{popSelecionado?.codigo}</p>
            <h1 className="text-lg font-bold text-slate-900">{popSelecionado?.titulo}</h1>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
            <p className="text-2xl font-bold text-emerald-600">{concluídos}</p>
            <p className="text-xs text-slate-500 mt-0.5">Concluíram</p>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
            <p className="text-2xl font-bold text-amber-500">{pendentes}</p>
            <p className="text-xs text-slate-500 mt-0.5">Pendentes</p>
          </div>
        </div>

        {erroUsuarios && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 mb-4">
            Erro ao carregar usuários: <strong>{erroUsuarios}</strong>
            {erroUsuarios.includes('403') || erroUsuarios.includes('Permissão') ? ' — faça logout e login novamente para atualizar a sessão.' : ''}
          </div>
        )}

        {loadingDetalhe ? (
          <div className="text-center py-10 text-slate-400 text-sm">Carregando...</div>
        ) : !erroUsuarios && usuariosStatus.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm">Nenhum usuário cadastrado nesta farmácia.</div>
        ) : !erroUsuarios && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Usuário</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 hidden sm:table-cell">Concluído em</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 hidden sm:table-cell">Nota</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {usuariosStatus.map(u => (
                  <tr key={u.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{u.nome}</p>
                      <p className="text-xs text-slate-400">{u.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      {u.concluido ? (
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
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 hidden sm:table-cell">
                      {u.concluidoEm ? new Date(u.concluidoEm).toLocaleString('pt-BR') : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 hidden sm:table-cell">
                      {u.acertos !== null ? `${u.acertos}/${u.totalQuestoes}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  // ── EDITOR (novo ou editar) ───────────────────────────────────────────────────
  const isNovo = aba === 'novo'
  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setAba('lista')} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-slate-900">{isNovo ? 'Novo POP' : `Editar — ${fCodigo}`}</h1>
      </div>

      <div className="space-y-5">
        {/* Dados básicos */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Identificação</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Código</label>
              <input value={fCodigo} onChange={e => setFCodigo(e.target.value)} placeholder="POP-11" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Versão</label>
              <input value={fVersao} onChange={e => setFVersao(e.target.value)} placeholder="1.0" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Título</label>
            <input value={fTitulo} onChange={e => setFTitulo(e.target.value)} placeholder="Nome do procedimento" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Base Legal <span className="text-slate-400 font-normal">(opcional)</span></label>
            <input value={fBaseLegal} onChange={e => setFBaseLegal(e.target.value)} placeholder="Ex: RDC 44/2009, art. 5º" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Objetivo <span className="text-slate-400 font-normal">(opcional)</span></label>
            <input value={fObjetivo} onChange={e => setFObjetivo(e.target.value)} placeholder="Descreva o objetivo deste POP" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Mínimo de acertos no quiz</label>
            <input type="number" min={1} value={fMinAcertos} onChange={e => setFMinAcertos(Number(e.target.value))} className="w-24 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
        </div>

        {/* Conteúdo */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Conteúdo do POP</p>
            <p className="text-xs text-slate-400">Use <code className="bg-slate-100 px-1 rounded">### Título da seção</code> para criar seções.</p>
          </div>
          <textarea
            value={fConteudo}
            onChange={e => setFConteudo(e.target.value)}
            rows={12}
            placeholder={'### Objetivo\n\nDescreva o objetivo...\n\n### Responsável\n\nFarmacêutico responsável...'}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y"
          />
        </div>

        {/* Questões */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Questões do Quiz</p>
            <button onClick={adicionarQuestao} className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Adicionar questão
            </button>
          </div>

          {fQuestoes.map((q, idx) => (
            <div key={idx} className="border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500">Questão {idx + 1}</p>
                {fQuestoes.length > 1 && (
                  <button onClick={() => removerQuestao(idx)} className="text-xs text-red-400 hover:text-red-600 transition-colors">Remover</button>
                )}
              </div>
              <textarea
                value={q.enunciado}
                onChange={e => atualizarQuestao(idx, 'enunciado', e.target.value)}
                rows={2}
                placeholder="Enunciado da questão..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              />
              <div className="space-y-2">
                {q.opcoes.map(op => (
                  <div key={op.letra} className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0">{op.letra.toUpperCase()}</span>
                    <input
                      value={op.texto}
                      onChange={e => atualizarOpcao(idx, op.letra, e.target.value)}
                      placeholder={`Opção ${op.letra.toUpperCase()}`}
                      className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <input
                      type="radio"
                      name={`correta-${idx}`}
                      value={op.letra}
                      checked={q.respostaCorreta === op.letra}
                      onChange={() => atualizarQuestao(idx, 'respostaCorreta', op.letra)}
                      title="Marcar como correta"
                      className="accent-emerald-600"
                    />
                  </div>
                ))}
                <p className="text-xs text-slate-400">Selecione o radio da resposta correta.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Justificativa <span className="font-normal text-slate-400">(opcional)</span></label>
                <input
                  value={q.justificativa}
                  onChange={e => atualizarQuestao(idx, 'justificativa', e.target.value)}
                  placeholder="Explicação da resposta correta..."
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>
          ))}
        </div>

        {msg && (
          <div className={`px-4 py-3 rounded-xl text-sm ${msg.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {msg.texto}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button onClick={() => setAba('lista')} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
            Cancelar
          </button>
          <button onClick={salvar} disabled={salvando} className="px-5 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors">
            {salvando ? 'Salvando...' : isNovo ? 'Criar POP' : 'Salvar alterações'}
          </button>
        </div>
      </div>
    </div>
  )
}
