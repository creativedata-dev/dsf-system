'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
}

function fmtCPF(cpf: string): string {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

interface Cliente {
  id: string
  nome: string
  cpf: string
  dataNascimento: string | null
}

export function CpfSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const digits = query.replace(/\D/g, '')
  const looksLikeCpf = digits.length >= 3 && /^[\d.\-]+$/.test(query)

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); setShowDropdown(false); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/clients/search?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data = await res.json()
        setResults(Array.isArray(data) ? data : data ? [data] : [])
        setShowDropdown(true)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    // Se parece CPF, formata; senão texto livre
    const val = looksLikeCpf || /^[\d.\-]+$/.test(raw) ? formatCPF(raw) : raw
    setQuery(val)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const q = /^[\d.\-]+$/.test(val) ? val.replace(/\D/g, '') : val
      search(q)
    }, 300)
  }

  function handleSelect(cliente: Cliente) {
    setShowDropdown(false)
    setQuery(fmtCPF(cliente.cpf))
    router.push(`/dashboard/clientes?cpf=${cliente.cpf}`)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (digits.length === 11) {
      router.push(`/dashboard/clientes?cpf=${digits}`)
    } else if (results.length === 1) {
      handleSelect(results[0])
    } else if (query.length >= 2) {
      search(looksLikeCpf ? digits : query)
    }
  }

  return (
    <div ref={containerRef} className="relative flex gap-3 w-full max-w-md">
      <form onSubmit={handleSubmit} className="flex gap-3 flex-1">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={handleChange}
            onFocus={() => results.length > 0 && setShowDropdown(true)}
            placeholder="Nome ou CPF do paciente"
            className="w-full pl-4 pr-10 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-400"
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(''); setResults([]); setShowDropdown(false) }}
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
          disabled={query.length < 2}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-700 text-white text-sm font-medium rounded-lg hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading
            ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
            : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          }
          Buscar
        </button>
      </form>

      {/* Dropdown de resultados */}
      {showDropdown && results.length > 0 && (
        <div className="absolute top-full left-0 right-16 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden">
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => handleSelect(c)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-100 last:border-0"
            >
              <div>
                <p className="text-sm font-medium text-slate-900">{c.nome}</p>
                <p className="text-xs text-slate-400">{fmtCPF(c.cpf)}</p>
              </div>
              {c.dataNascimento && (
                <span className="text-xs text-slate-400 shrink-0 ml-3">
                  {new Date(c.dataNascimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {showDropdown && results.length === 0 && query.length >= 2 && !loading && (
        <div className="absolute top-full left-0 right-16 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 px-4 py-3 text-sm text-slate-400">
          Nenhum paciente encontrado
        </div>
      )}
    </div>
  )
}
