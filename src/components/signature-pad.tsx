'use client'

import { useRef, useCallback } from 'react'
import SignatureCanvas from 'react-signature-canvas'

interface SignaturePadProps {
  label: string
  sublabel?: string
  onChange: (dataUrl: string | null) => void
  disabled?: boolean
}

export function SignaturePad({ label, sublabel, onChange, disabled }: SignaturePadProps) {
  const canvasRef = useRef<SignatureCanvas>(null)

  const handleEnd = useCallback(() => {
    if (!canvasRef.current || canvasRef.current.isEmpty()) {
      onChange(null)
      return
    }
    onChange(canvasRef.current.toDataURL('image/png'))
  }, [onChange])

  const handleClear = useCallback(() => {
    canvasRef.current?.clear()
    onChange(null)
  }, [onChange])

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-700">{label}</p>
          {sublabel && <p className="text-xs text-gray-500">{sublabel}</p>}
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Limpar
          </button>
        )}
      </div>
      <div className="border border-gray-300 rounded-lg bg-white overflow-hidden touch-none">
        <SignatureCanvas
          ref={canvasRef}
          onEnd={handleEnd}
          canvasProps={{
            width: 480,
            height: 160,
            className: 'w-full',
            style: { pointerEvents: disabled ? 'none' : 'auto', opacity: disabled ? 0.5 : 1 },
          }}
          backgroundColor="rgb(255,255,255)"
        />
      </div>
      <p className="text-xs text-gray-400 text-center">
        {disabled ? 'Assinatura registrada' : 'Assine acima com o dedo ou mouse'}
      </p>
    </div>
  )
}
