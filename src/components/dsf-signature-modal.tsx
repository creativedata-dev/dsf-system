'use client'

import { useState, useCallback } from 'react'
import { SignaturePad } from './signature-pad'

interface DsfSignatureModalProps {
  dsfId: string
  numeroDsf: string
  clienteNome: string
  clienteEmail: string | null
  rtNome: string
  rtCrf: string | null
  onClose: () => void
  onSuccess: (result: { hash: string; timestamp: string; emailEnviado: boolean }) => void
}

type Step = 'paciente' | 'rt' | 'confirmar'

export function DsfSignatureModal({
  dsfId,
  numeroDsf,
  clienteNome,
  clienteEmail,
  rtNome,
  rtCrf,
  onClose,
  onSuccess,
}: DsfSignatureModalProps) {
  const [step, setStep] = useState<Step>('paciente')
  const [assinaturaPaciente, setAssinaturaPaciente] = useState<string | null>(null)
  const [assinaturaRt, setAssinaturaRt] = useState<string | null>(null)
  const [enviarEmail, setEnviarEmail] = useState(!!clienteEmail)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const handlePacienteChange = useCallback((url: string | null) => {
    setAssinaturaPaciente(url)
  }, [])

  const handleRtChange = useCallback((url: string | null) => {
    setAssinaturaRt(url)
  }, [])

  async function handleConfirmar() {
    setLoading(true)
    setErro(null)
    try {
      const res = await fetch('/api/dsf/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dsfId,
          assinaturaPacienteBase64: assinaturaPaciente ?? undefined,
          assinaturaRtBase64: assinaturaRt ?? undefined,
          enviarEmail: enviarEmail && !!clienteEmail,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao finalizar')
      onSuccess({ hash: data.hash, timestamp: data.timestamp, emailEnviado: data.emailEnviado })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao finalizar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col gap-0 overflow-hidden">
        {/* Header */}
        <div className="bg-blue-700 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-white font-semibold text-lg">Assinatura Digital</h2>
            <p className="text-blue-200 text-sm">{numeroDsf}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white text-2xl leading-none"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        {/* Stepper */}
        <div className="flex border-b border-gray-100">
          {(['paciente', 'rt', 'confirmar'] as Step[]).map((s, i) => (
            <div
              key={s}
              className={`flex-1 py-2 text-center text-xs font-medium border-b-2 transition-colors ${
                step === s
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-400'
              }`}
            >
              {i + 1}. {s === 'paciente' ? 'Paciente' : s === 'rt' ? 'Farmacêutico' : 'Confirmar'}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-4">
          {step === 'paciente' && (
            <>
              <p className="text-sm text-gray-600">
                Solicite ao paciente que assine abaixo. <span className="text-gray-400">(opcional)</span>
              </p>
              <SignaturePad
                label={`Assinatura do paciente`}
                sublabel={clienteNome}
                onChange={handlePacienteChange}
              />
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setStep('rt')}
                  className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
                >
                  Pular
                </button>
                <button
                  onClick={() => setStep('rt')}
                  className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                >
                  Próximo
                </button>
              </div>
            </>
          )}

          {step === 'rt' && (
            <>
              <p className="text-sm text-gray-600">
                Farmacêutico responsável — assine abaixo. <span className="text-gray-400">(opcional)</span>
              </p>
              <SignaturePad
                label={`Assinatura do RT`}
                sublabel={`${rtNome}${rtCrf ? ` · CRF ${rtCrf}` : ''}`}
                onChange={handleRtChange}
              />
              <div className="flex justify-between gap-3 pt-2">
                <button
                  onClick={() => setStep('paciente')}
                  className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
                >
                  Voltar
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={() => setStep('confirmar')}
                    className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
                  >
                    Pular
                  </button>
                  <button
                    onClick={() => setStep('confirmar')}
                    className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                  >
                    Próximo
                  </button>
                </div>
              </div>
            </>
          )}

          {step === 'confirmar' && (
            <>
              <div className="flex flex-col gap-2 text-sm text-gray-700">
                <p className="font-medium">Resumo:</p>
                <ul className="list-disc list-inside text-gray-600 space-y-1">
                  <li>Assinatura do paciente: {assinaturaPaciente ? '✓ Capturada' : '— Não informada'}</li>
                  <li>Assinatura do farmacêutico: {assinaturaRt ? '✓ Capturada' : '— Não informada'}</li>
                </ul>
                <p className="text-xs text-gray-400 mt-1">
                  O PDF será gerado com hash SHA-256 e timestamp UTC para comprovação de autenticidade.
                </p>
              </div>

              {clienteEmail && (
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enviarEmail}
                    onChange={e => setEnviarEmail(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600"
                  />
                  <span className="text-sm text-gray-700">
                    Enviar PDF por email para <strong>{clienteEmail}</strong>
                  </span>
                </label>
              )}

              {erro && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{erro}</p>
              )}

              <div className="flex justify-between gap-3 pt-2">
                <button
                  onClick={() => setStep('rt')}
                  className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
                  disabled={loading}
                >
                  Voltar
                </button>
                <button
                  onClick={handleConfirmar}
                  disabled={loading}
                  className="px-6 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {loading ? 'Finalizando...' : 'Confirmar e Finalizar'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
