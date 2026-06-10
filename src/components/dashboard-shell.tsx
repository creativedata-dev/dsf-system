'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { NavLink } from '@/components/nav-link'
import { LogoutButton } from '@/components/logout-button'
import { hasModulo } from '@/lib/modulos'

interface DashboardShellProps {
  children: React.ReactNode
  userName: string
  userEmail: string
  userCrf: string | null
  tenantName: string
  tenantLogoUrl: string | null
  permissions: string[]
  modulosHabilitados?: string[]
  assinaturaStatus?: string | null
  assinaturaExpiraEm?: string | null
  trialExpiraEm?: string | null
  diasEmTolerancia?: number | null
}

export function DashboardShell({
  children,
  userName,
  userEmail,
  userCrf,
  tenantName,
  tenantLogoUrl,
  permissions,
  modulosHabilitados = [],
  assinaturaStatus,
  assinaturaExpiraEm,
  trialExpiraEm,
  diasEmTolerancia,
}: DashboardShellProps) {
  const [open, setOpen] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [medOpen, setMedOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => { setOpen(false) }, [pathname])

  useEffect(() => {
    const configRoutes = ['/dashboard/perfil', '/dashboard/geral', '/dashboard/admin', '/dashboard/configuracoes', '/dashboard/anvisa', '/dashboard/pacientes', '/dashboard/admin/procedimentos']
    if (configRoutes.some(r => pathname.startsWith(r))) setConfigOpen(true)
  }, [pathname])

  useEffect(() => {
    if (pathname.startsWith('/dashboard/validade') || pathname.startsWith('/dashboard/fracionamento')) setMedOpen(true)
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
          <NavLink href="/dashboard" label="Início" icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          } />

          {permissions.includes('CLIENTE_BUSCAR') && hasModulo(modulosHabilitados, 'DSF') && (
            <NavLink href="/dashboard/clientes" label="DSF" icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            } />
          )}

          {hasModulo(modulosHabilitados, 'TEMPERATURA') && (
            <NavLink href="/dashboard/temperatura" label="Ambiente" icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 14.76V3.5a2.5 2.5 0 00-5 0v11.26a4.5 4.5 0 105 0z" />
              </svg>
            } />
          )}

          {hasModulo(modulosHabilitados, 'EQUIPAMENTOS') && (
            <NavLink href="/dashboard/equipamentos" label="Equipamentos" icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
              </svg>
            } />
          )}

          {(hasModulo(modulosHabilitados, 'VALIDADE') || hasModulo(modulosHabilitados, 'FRACIONAMENTO')) && (
            <>
              <button
                onClick={() => setMedOpen(v => !v)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors group"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
                <span className="flex-1 text-left">Medicamentos</span>
                <svg className={`w-3 h-3 text-slate-400 transition-transform ${medOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {medOpen && (
                <div className="ml-4 pl-3 border-l border-slate-200 space-y-0.5">
                  {hasModulo(modulosHabilitados, 'VALIDADE') && (
                    <NavLink href="/dashboard/validade" label="Validade" icon={
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    } />
                  )}
                  {hasModulo(modulosHabilitados, 'FRACIONAMENTO') && (
                    <NavLink href="/dashboard/fracionamento" label="Fracionamento" icon={
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                    } />
                  )}
                </div>
              )}
            </>
          )}

          {hasModulo(modulosHabilitados, 'POPS') && (
            <NavLink href="/dashboard/pops" label="POPs" icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            } />
          )}

          {hasModulo(modulosHabilitados, 'PAINEL_FISCAL') && (
            <NavLink href="/dashboard/fiscal" label="ANVISA" icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            } />
          )}
        </div>

        {/* ── Configuração (colapsável) ── */}
        <button
          onClick={() => setConfigOpen(v => !v)}
          className="w-full flex items-center justify-between px-3 mb-1.5 group"
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 group-hover:text-slate-600 transition-colors">Configuração</span>
          <svg className={`w-3 h-3 text-slate-300 group-hover:text-slate-500 transition-all ${configOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {configOpen && (
          <>
            <div className="space-y-0.5 mb-2">
              <NavLink href="/dashboard/perfil" label="Perfil" icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              } />

              <NavLink href="/dashboard/geral" label="Geral" icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              } />

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

              {(permissions.includes('POPS_GERENCIAR') || permissions.includes('SUPER_ADMIN_GLOBAIS')) && (
                <NavLink href="/dashboard/configuracoes/pops" label="Gestão de POPs" icon={
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                } />
              )}
            </div>

            {/* DSF subseção */}
            {(permissions.includes('ANVISA_RELATORIOS') ||
              permissions.includes('DSF_CANCELAR') ||
              permissions.includes('DRIVE_CONFIGURAR') ||
              permissions.includes('SUPER_ADMIN_GLOBAIS')) && (
              <>
                <p className="px-3 mb-1 mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-300">DSF</p>
                <div className="space-y-0.5 mb-3">
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

                  {permissions.includes('DRIVE_CONFIGURAR') && (
                    <NavLink href="/dashboard/admin/procedimentos" label="Procedimentos" icon={
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                    } />
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* ── Super Admin ── */}
        {permissions.includes('SUPER_ADMIN_GLOBAIS') && (
          <>
            <p className="px-3 mb-1.5 mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-300">Admin</p>
            <div className="space-y-0.5">
              <NavLink href="/dashboard/saas" label="Dashboard SaaS" icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              } />
              <NavLink href="/dashboard/tenants" label="Estabelecimentos" icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              } />
              <NavLink href="/dashboard/planos" label="Planos" icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
              } />
              <NavLink href="/dashboard/gateways" label="Pagamentos" icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              } />
            </div>
          </>
        )}
      </nav>

      {/* Badge de assinatura */}
      {assinaturaStatus && assinaturaStatus !== 'ATIVA' && assinaturaStatus !== 'VITALICIO' && (
        <div className={`mx-3 mb-2 px-3 py-2 rounded-lg text-xs ${
          assinaturaStatus === 'TRIAL'
            ? 'bg-amber-50 border border-amber-200 text-amber-800'
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {assinaturaStatus === 'TRIAL' && trialExpiraEm && (
            <>
              <p className="font-semibold">Período de teste</p>
              <p>Expira em {new Date(trialExpiraEm).toLocaleDateString('pt-BR')}</p>
            </>
          )}
          {assinaturaStatus === 'SUSPENSA' && (
            <>
              <p className="font-semibold">Assinatura suspensa</p>
              <p>Regularize seu pagamento.</p>
            </>
          )}
          {(assinaturaStatus === 'EXPIRADA' || assinaturaStatus === 'CANCELADA') && (
            <>
              <p className="font-semibold">Acesso encerrado</p>
              <p>Entre em contato com o suporte.</p>
            </>
          )}
          {assinaturaStatus === 'SEM_ASSINATURA' && (
            <>
              <p className="font-semibold">Sem assinatura</p>
              <p>Entre em contato com o suporte.</p>
            </>
          )}
        </div>
      )}

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
        {diasEmTolerancia != null && (
          <div className="bg-red-600 text-white px-4 py-3 flex items-center gap-3">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm flex-1">
              <span className="font-bold">Não localizamos o seu pagamento.</span>
              {' '}Verifique o pagamento ou{' '}
              <a href="mailto:suporte@farmasign.com.br" className="underline hover:no-underline">fale com nosso suporte</a>.
              {' '}O acesso será bloqueado em{' '}
              <span className="font-bold">{diasEmTolerancia} {diasEmTolerancia === 1 ? 'dia' : 'dias'}</span>.
            </p>
          </div>
        )}
        {children}
      </main>
    </div>
  )
}
