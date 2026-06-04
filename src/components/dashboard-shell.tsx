'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { NavLink } from '@/components/nav-link'
import { LogoutButton } from '@/components/logout-button'

interface DashboardShellProps {
  children: React.ReactNode
  userName: string
  userEmail: string
  userCrf: string | null
  tenantName: string
  tenantLogoUrl: string | null
  permissions: string[]
}

export function DashboardShell({
  children,
  userName,
  userEmail,
  userCrf,
  tenantName,
  tenantLogoUrl,
  permissions,
}: DashboardShellProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Brand + Tenant */}
      <div className="px-5 py-4 border-b border-slate-100 flex-shrink-0">
        {tenantLogoUrl ? (
          <div className="flex flex-col items-center gap-1">
            <img src={tenantLogoUrl} alt={tenantName} className="h-10 max-w-[160px] object-contain" />
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-blue-700">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 leading-tight">FarmaSign</p>
              <p className="text-xs text-slate-400 truncate">{tenantName}</p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">

        {/* ── Principal ── */}
        <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Principal</p>
        <div className="space-y-0.5 mb-4">
          {(permissions.includes('ANVISA_RELATORIOS') ||
            permissions.includes('DSF_CANCELAR') ||
            permissions.includes('DRIVE_CONFIGURAR') ||
            permissions.includes('SUPER_ADMIN_GLOBAIS')) && (
            <NavLink href="/dashboard" label="Início" icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            } />
          )}

          {permissions.includes('CLIENTE_BUSCAR') && (
            <NavLink href="/dashboard/clientes" label="Emissão DSF" icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            } />
          )}

          {permissions.includes('ANVISA_RELATORIOS') && (
            <NavLink href="/dashboard/anvisa" label="Relatório DSF" icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            } />
          )}

          {(permissions.includes('SUPER_ADMIN_GLOBAIS') ||
            permissions.includes('DRIVE_CONFIGURAR') ||
            permissions.includes('ANVISA_RELATORIOS') ||
            permissions.includes('DSF_CANCELAR')) && (
            <NavLink href="/dashboard/pacientes" label="Clientes" icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            } />
          )}
        </div>

        {/* ── Configuração ── */}
        {(permissions.includes('SUPER_ADMIN_GLOBAIS') ||
          permissions.includes('DRIVE_CONFIGURAR') ||
          permissions.includes('ANVISA_RELATORIOS') ||
          permissions.includes('DSF_CANCELAR')) && (
          <>
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Configuração</p>
            <div className="space-y-0.5">
              {(permissions.includes('SUPER_ADMIN_GLOBAIS') ||
                permissions.includes('DRIVE_CONFIGURAR') ||
                permissions.includes('ANVISA_RELATORIOS') ||
                permissions.includes('DSF_CANCELAR')) && (
                <NavLink href="/dashboard/admin" label="Usuários" icon={
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                } />
              )}

              {permissions.includes('DRIVE_CONFIGURAR') && (
                <NavLink href="/dashboard/configuracoes" label="Google Drive" icon={
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                  </svg>
                } />
              )}

              {permissions.includes('DRIVE_CONFIGURAR') && (
                <NavLink href="/dashboard/admin/procedimentos" label="Procedimentos" icon={
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                } />
              )}

              {permissions.includes('SUPER_ADMIN_GLOBAIS') && (
                <NavLink href="/dashboard/tenants" label="Estabelecimentos" icon={
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                } />
              )}
            </div>
          </>
        )}
      </nav>

      {/* User info + Logout */}
      <div className="px-4 py-3 border-t border-slate-100 flex-shrink-0 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-blue-700">
              {userName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-800 truncate">{userName}</p>
            <p className="text-[11px] text-slate-400 truncate">{userEmail}</p>
            {userCrf && <p className="text-[11px] font-medium text-blue-600">{userCrf}</p>}
          </div>
        </div>
        <LogoutButton />
        <p className="text-[10px] text-slate-300 text-center">
          © {new Date().getFullYear()} SynapseIQ
        </p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-100 lg:flex lg:h-screen lg:overflow-hidden">

      {/* ── Mobile header ── */}
      <header className="sticky top-0 z-30 flex items-center gap-3 bg-white border-b border-slate-200 px-4 py-3 lg:hidden">
        <button
          onClick={() => setOpen(true)}
          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
          aria-label="Abrir menu"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-blue-700 rounded flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <span className="text-sm font-bold text-slate-900">FarmaSign</span>
        </div>
        <span className="ml-auto text-xs text-slate-400 truncate max-w-[140px]">{tenantName}</span>
      </header>

      {/* ── Mobile drawer overlay ── */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-72 bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <span className="text-sm font-bold text-slate-900">Menu</span>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
                aria-label="Fechar menu"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:flex-shrink-0 bg-white border-r border-slate-200">
        {sidebarContent}
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 lg:overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
