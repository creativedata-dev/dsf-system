'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
}

export function CpfSearch() {
  const [cpf, setCpf] = useState('')
  const router = useRouter()

  const digits = cpf.replace(/\D/g, '')

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (digits.length < 11) return
    router.push(`/dashboard/clientes?cpf=${digits}`)
  }

  return (
    <form onSubmit={handleSearch} className="flex gap-3">
      <div className="relative flex-1 max-w-xs">
        <input
          type="text"
          value={cpf}
          onChange={(e) => setCpf(formatCPF(e.target.value))}
          placeholder="000.000.000-00"
          className="w-full pl-4 pr-10 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-400"
          maxLength={14}
          autoComplete="off"
        />
        {cpf && (
          <button
            type="button"
            onClick={() => setCpf('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      <button
        type="submit"
        disabled={digits.length < 11}
        className="flex items-center gap-2 px-4 py-2.5 bg-blue-700 text-white text-sm font-medium rounded-lg hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        Buscar
      </button>
    </form>
  )
}
