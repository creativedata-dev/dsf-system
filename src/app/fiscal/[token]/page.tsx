'use client'
import { useEffect, useState, use } from 'react'

const SECAO_LABELS: Record<string, string> = {
  TEMPERATURA: 'Temperatura e Umidade',
  EQUIPAMENTOS: 'Equipamentos e Calibração',
  POPS: 'POPs e Treinamentos',
  VALIDADE: 'Controle de Validade',
}

function fmtData(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}
function fmtNum(n: number) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })
}

interface FiscalData {
  tenant: { nome: string; cnpj: string; endereco: string; alvara: string }
  dataInicio: string
  dataFim: string
  secoes: string[]
  geradoEm: string
  temperatura?: { dataLeitura: string; periodo: string; ambienteNome: string; temperaturaGraus: number; umidadePercent: number | null; nomeUsuario: string; alertaDisparado: boolean }[]
  equipamentos?: { nome: string; marcaModelo: string; numeroSerie: string | null; status: string; dataUltimaCalibracao: string; dataProximaCalibracao: string; numeroCertificado: string | null; laboratorio: string | null }[]
  pops?: { codigo: string; titulo: string; versao: string; totalUsuarios: number; assinaturas: { nomeUsuario: string; aprovado: boolean; acertos: number; totalQuestoes: number; createdAt: string }[] }[]
  validade?: { nomeProduto: string; fabricante: string; lote: string; validade: string; quantidade: number; unidade: string; status: string; descarte: { numeroAuto: string; motivo: string; dataDescarte: string; responsavel: string } | null }[]
}

export default function FiscalPublicPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [data, setData] = useState<FiscalData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [baixando, setBaixando] = useState(false)

  useEffect(() => {
    fetch(`/api/fiscal/${token}`)
      .then(async res => {
        if (!res.ok) {
          const e = await res.json()
          setError(e.error ?? 'Erro ao carregar')
        } else {
          setData(await res.json())
        }
      })
      .catch(() => setError('Erro de conexão'))
      .finally(() => setLoading(false))
  }, [token])

  const baixarPdf = async () => {
    if (!data) return
    setBaixando(true)
    try {
      const res = await fetch(`/api/fiscal/${token}/pdf`)
      if (!res.ok) { alert('Erro ao gerar PDF'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `conformidade-${data.tenant.cnpj}-${data.dataInicio}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setBaixando(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-500">Carregando...</p>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white border border-red-200 rounded-xl p-8 max-w-sm text-center space-y-3">
        <div className="text-4xl">🔒</div>
        <h1 className="font-bold text-gray-900">Link Inválido</h1>
        <p className="text-gray-600 text-sm">{error}</p>
        <p className="text-xs text-gray-400">Links de acesso ao Painel do Fiscal expiram em 30 minutos e são de uso único.</p>
      </div>
    </div>
  )

  if (!data) return null

  const fmtCnpj = (c: string) => c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-blue-800 text-white">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-blue-200 text-xs font-medium uppercase tracking-wide mb-1">Pacote de Conformidade — FarmaSign</div>
              <h1 className="text-xl font-bold">{data.tenant.nome}</h1>
              <p className="text-blue-200 text-sm mt-1">CNPJ: {fmtCnpj(data.tenant.cnpj)}</p>
              <p className="text-blue-200 text-sm">{data.tenant.endereco}</p>
              <p className="text-blue-200 text-sm">Alvará: {data.tenant.alvara}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-blue-100 text-sm font-medium">Período de referência</p>
              <p className="text-white font-bold">{fmtData(data.dataInicio)} a {fmtData(data.dataFim)}</p>
              <p className="text-blue-300 text-xs mt-1">Documento eletrônico — RDC 44/2009</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {data.secoes.map(s => (
              <span key={s} className="inline-flex items-center px-2.5 py-1 rounded-full bg-blue-700 text-blue-100 text-xs">
                {SECAO_LABELS[s]}
              </span>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Seção Temperatura */}
        {data.temperatura && (
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              🌡️ Controle de Temperatura e Umidade
            </h2>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex gap-6 text-sm">
                <span>Total: <strong>{data.temperatura.length}</strong> leituras</span>
                <span className="text-red-600">Alertas: <strong>{data.temperatura.filter(r => r.alertaDisparado).length}</strong></span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500 uppercase tracking-wide">
                    <tr>
                      {['Data', 'Período', 'Ambiente', 'Temp', 'Umid', 'Responsável', 'Status'].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.temperatura.map((r, i) => (
                      <tr key={i} className={r.alertaDisparado ? 'bg-red-50' : undefined}>
                        <td className="px-3 py-2">{fmtData(r.dataLeitura)}</td>
                        <td className="px-3 py-2">{r.periodo}</td>
                        <td className="px-3 py-2">{r.ambienteNome}</td>
                        <td className="px-3 py-2 font-mono">{r.temperaturaGraus}°C</td>
                        <td className="px-3 py-2 font-mono">{r.umidadePercent != null ? `${r.umidadePercent}%` : '—'}</td>
                        <td className="px-3 py-2">{r.nomeUsuario}</td>
                        <td className="px-3 py-2">
                          <span className={`font-medium ${r.alertaDisparado ? 'text-red-600' : 'text-green-600'}`}>
                            {r.alertaDisparado ? 'ALERTA' : 'OK'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* Seção Equipamentos */}
        {data.equipamentos && (
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              🔧 Equipamentos e Calibração
            </h2>
            <div className="space-y-3">
              {data.equipamentos.map((e, i) => {
                const cor = e.status === 'VENCIDO' ? 'border-red-300 bg-red-50' : e.status === 'VENCENDO' ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white'
                const badgeCor = e.status === 'VENCIDO' ? 'bg-red-100 text-red-700' : e.status === 'VENCENDO' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                return (
                  <div key={i} className={`border rounded-xl p-4 ${cor}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-gray-900">{e.nome}</p>
                        <p className="text-sm text-gray-600">{e.marcaModelo}{e.numeroSerie ? ` — Série: ${e.numeroSerie}` : ''}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Última calibração: {fmtData(e.dataUltimaCalibracao)} | Próxima: {fmtData(e.dataProximaCalibracao)}
                        </p>
                        {e.numeroCertificado && (
                          <p className="text-xs text-gray-500">Cert: {e.numeroCertificado} | Lab: {e.laboratorio ?? '—'}</p>
                        )}
                      </div>
                      <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${badgeCor}`}>{e.status}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Seção POPs */}
        {data.pops && (
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              📋 POPs e Treinamentos
            </h2>
            <div className="space-y-4">
              {data.pops.map((pop, i) => {
                const concluidos = pop.assinaturas.filter(a => a.aprovado).length
                const pct = pop.totalUsuarios > 0 ? Math.round((concluidos / pop.totalUsuarios) * 100) : 0
                return (
                  <div key={i} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <div className={`px-4 py-3 border-b flex items-center justify-between ${pct < 100 ? 'bg-amber-50 border-amber-100' : 'bg-green-50 border-green-100'}`}>
                      <div>
                        <span className="font-semibold text-gray-900">{pop.codigo} — {pop.titulo}</span>
                        <span className="ml-2 text-xs text-gray-500">v{pop.versao}</span>
                      </div>
                      <span className={`text-sm font-bold ${pct < 100 ? 'text-amber-700' : 'text-green-700'}`}>
                        {concluidos}/{pop.totalUsuarios} ({pct}%)
                      </span>
                    </div>
                    {pop.assinaturas.length > 0 && (
                      <div className="divide-y divide-gray-100">
                        {pop.assinaturas.map((ass, j) => (
                          <div key={j} className="px-4 py-2 flex items-center justify-between text-sm">
                            <span className="text-gray-700">{ass.nomeUsuario}</span>
                            <div className="flex items-center gap-3 text-xs text-gray-500">
                              <span className={`font-medium ${ass.aprovado ? 'text-green-600' : 'text-red-600'}`}>
                                {ass.aprovado ? '✓' : '✗'} {ass.acertos}/{ass.totalQuestoes}
                              </span>
                              <span>{fmtData(ass.createdAt)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Seção Validade */}
        {data.validade && (
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              📅 Controle de Validade
            </h2>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex gap-6 text-sm">
                <span>Total: <strong>{data.validade.length}</strong> lotes</span>
                <span className="text-amber-600">Quarentena: <strong>{data.validade.filter(l => l.status === 'QUARENTENA').length}</strong></span>
                <span className="text-gray-500">Descartados: <strong>{data.validade.filter(l => l.status === 'DESCARTADO').length}</strong></span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500 uppercase tracking-wide">
                    <tr>
                      {['Produto', 'Lote', 'Validade', 'Qtd', 'Status'].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.validade.map((l, i) => {
                      const statusCor = l.status === 'DESCARTADO' ? 'text-gray-400' : l.status === 'QUARENTENA' ? 'text-amber-600 font-semibold' : 'text-green-600 font-semibold'
                      return (
                        <tr key={i} className={l.status === 'QUARENTENA' ? 'bg-amber-50' : undefined}>
                          <td className="px-3 py-2">{l.nomeProduto}</td>
                          <td className="px-3 py-2 font-mono">{l.lote}</td>
                          <td className="px-3 py-2">{fmtData(l.validade)}</td>
                          <td className="px-3 py-2">{fmtNum(l.quantidade)} {l.unidade}</td>
                          <td className={`px-3 py-2 ${statusCor}`}>{l.status}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Autos de descarte */}
            {data.validade.filter(l => l.descarte).length > 0 && (
              <div className="mt-4 bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b bg-gray-50">
                  <h3 className="font-semibold text-gray-900 text-sm">Autos de Descarte</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {data.validade.filter(l => l.descarte).map((l, i) => (
                    <div key={i} className="px-4 py-3 text-sm">
                      <span className="font-medium">{l.nomeProduto}</span>
                      <span className="text-gray-500"> (Lote {l.lote})</span>
                      <span className="text-gray-500 ml-2">— Auto nº {l.descarte!.numeroAuto}</span>
                      <span className="text-gray-500 ml-2">— {l.descarte!.motivo}</span>
                      <span className="text-gray-500 ml-2">— {fmtData(l.descarte!.dataDescarte)}</span>
                      <span className="text-gray-500 ml-2">— Resp: {l.descarte!.responsavel}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Footer */}
        <footer className="border-t border-gray-200 pt-6 text-xs text-gray-400 text-center space-y-1">
          <p>Documento gerado pelo sistema FarmaSign em conformidade com a RDC 44/2009 / ANVISA</p>
          <p>Este documento é autêntico e foi acessado via link de uso único em {new Date(data.geradoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
        </footer>
      </main>
    </div>
  )
}
