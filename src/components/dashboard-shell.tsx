'use client'

import { useState, useEffect, useLayoutEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { NavLink } from '@/components/nav-link'
import { LogoutButton } from '@/components/logout-button'
import { hasModulo } from '@/lib/modulos'

const NAVY = '#1E2A3C'
const GREEN = '#28B478'
const GREEN_BG = 'rgba(40,180,120,0.18)'
const INACTIVE = 'rgba(255,255,255,0.55)'
const INACTIVE_HOVER_BG = 'rgba(255,255,255,0.07)'
const SEPARATOR = 'rgba(255,255,255,0.08)'
const SECTION_LABEL = 'rgba(255,255,255,0.3)'

const useClientPathname = () => {
  const pathname = usePathname()
  const [clientPathname, setClientPathname] = useState<string | null>(null)
  useLayoutEffect(() => { setClientPathname(pathname) }, [pathname])
  return clientPathname
}

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
  const [maisOpen, setMaisOpen] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [medOpen, setMedOpen] = useState(false)
  const pathname = usePathname()
  const clientPathname = useClientPathname()

  useEffect(() => { setOpen(false); setMaisOpen(false) }, [pathname])

  useEffect(() => {
    const configRoutes = ['/dashboard/perfil', '/dashboard/geral', '/dashboard/admin', '/dashboard/configuracoes', '/dashboard/anvisa', '/dashboard/pacientes', '/dashboard/admin/procedimentos']
    if (configRoutes.some(r => pathname.startsWith(r))) setConfigOpen(true)
  }, [pathname])

  useEffect(() => {
    if (pathname.startsWith('/dashboard/validade') || pathname.startsWith('/dashboard/fracionamento')) setMedOpen(true)
  }, [pathname])

  // ── Helpers de estilo do sidebar ──────────────────────────────────────────
  function navItemStyle(active: boolean) {
    return {
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '7px 12px', borderRadius: '8px', fontSize: '13.5px', fontWeight: 500,
      cursor: 'pointer', transition: 'background 0.15s, color 0.15s', width: '100%',
      background: active ? GREEN_BG : 'transparent',
      color: active ? GREEN : INACTIVE,
      border: 'none', textDecoration: 'none',
    } as React.CSSProperties
  }

  function NavItem({ href, label, icon, exact = false }: { href: string; label: string; icon: React.ReactNode; exact?: boolean }) {
    const active = clientPathname != null && (exact ? clientPathname === href : clientPathname.startsWith(href))
    return (
      <Link href={href} style={navItemStyle(active)}
        onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = INACTIVE_HOVER_BG }}
        onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
      >
        <span style={{ color: active ? GREEN : INACTIVE, flexShrink: 0 }}>{icon}</span>
        {label}
      </Link>
    )
  }

  // ── Mobile bottom nav ────────────────────────────────────────────────────
  type MobileNavItem = { href: string; label: string; icon: React.ReactNode }

  // Primary (até 2 slots entre Início e Config)
  const bottomPrimary: MobileNavItem[] = []
  if (permissions.includes('CLIENTE_BUSCAR') && hasModulo(modulosHabilitados, 'DSF')) {
    bottomPrimary.push({ href: '/dashboard/clientes', label: 'DSF', icon: <IconFileText size={22} /> })
  }
  if (hasModulo(modulosHabilitados, 'TEMPERATURA')) {
    bottomPrimary.push({ href: '/dashboard/temperatura', label: 'Ambiente', icon: <IconThermo size={22} /> })
  }

  // Sheet "Mais"
  const maisNavItems: MobileNavItem[] = []
  if (hasModulo(modulosHabilitados, 'EQUIPAMENTOS')) {
    maisNavItems.push({ href: '/dashboard/equipamentos', label: 'Equipamentos', icon: <IconWrench size={20} /> })
  }
  if (hasModulo(modulosHabilitados, 'VALIDADE') || hasModulo(modulosHabilitados, 'FRACIONAMENTO')) {
    maisNavItems.push({ href: '/dashboard/validade', label: 'Medicamentos', icon: <IconPill size={20} color="#64748b" /> })
  }
  if (hasModulo(modulosHabilitados, 'POPS')) {
    maisNavItems.push({ href: '/dashboard/pops', label: 'POPs', icon: <IconBook size={20} /> })
  }
  if (hasModulo(modulosHabilitados, 'PAINEL_FISCAL')) {
    maisNavItems.push({ href: '/dashboard/fiscal', label: 'ANVISA', icon: <IconShield size={20} color="#64748b" /> })
  }
  const configRoutes = ['/dashboard/perfil', '/dashboard/geral', '/dashboard/admin', '/dashboard/configuracoes', '/dashboard/anvisa', '/dashboard/pacientes', '/dashboard/admin/procedimentos', '/dashboard/saas', '/dashboard/tenants', '/dashboard/planos', '/dashboard/gateways']
  const isConfigActive = !!(clientPathname && configRoutes.some(r => clientPathname.startsWith(r)))

  const initials = userName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()

  // ── Sidebar content ───────────────────────────────────────────────────────
  const sidebarContent = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: NAVY }}>

      {/* Brand */}
      <div style={{ padding: '18px 16px 14px', borderBottom: `1px solid ${SEPARATOR}`, flexShrink: 0 }}>
        {tenantLogoUrl ? (
          <img src={tenantLogoUrl} alt={tenantName} style={{ height: 36, maxWidth: 160, objectFit: 'contain' }} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <IconShield color="white" size={17} />
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ color: 'white', fontSize: 14, fontWeight: 500, lineHeight: 1.2 }}>FarmaSign</p>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tenantName}</p>
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '14px 10px', overflowY: 'auto' }}>

        <p style={{ padding: '0 12px', marginBottom: 6, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: SECTION_LABEL }}>Principal</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 16 }}>
          <NavItem href="/dashboard" label="Início" icon={<IconHome />} exact />

          {permissions.includes('CLIENTE_BUSCAR') && hasModulo(modulosHabilitados, 'DSF') && (
            <NavItem href="/dashboard/clientes" label="DSF" icon={<IconFileText />} />
          )}

          {hasModulo(modulosHabilitados, 'TEMPERATURA') && (
            <NavItem href="/dashboard/temperatura" label="Ambiente" icon={<IconThermo />} />
          )}

          {hasModulo(modulosHabilitados, 'EQUIPAMENTOS') && (
            <NavItem href="/dashboard/equipamentos" label="Equipamentos" icon={<IconWrench />} />
          )}

          {(hasModulo(modulosHabilitados, 'VALIDADE') || hasModulo(modulosHabilitados, 'FRACIONAMENTO')) && (
            <>
              <button onClick={() => setMedOpen(v => !v)} style={{ ...navItemStyle(false), justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <IconPill color={INACTIVE} />
                  <span>Medicamentos</span>
                </span>
                <svg style={{ width: 12, height: 12, color: INACTIVE, transform: medOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {medOpen && (
                <div style={{ marginLeft: 16, paddingLeft: 12, borderLeft: `1px solid ${SEPARATOR}`, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {hasModulo(modulosHabilitados, 'VALIDADE') && <NavItem href="/dashboard/validade" label="Validade" icon={<IconCalendar />} />}
                  {hasModulo(modulosHabilitados, 'FRACIONAMENTO') && <NavItem href="/dashboard/fracionamento" label="Fracionamento" icon={<IconPill color={INACTIVE} />} />}
                </div>
              )}
            </>
          )}

          {hasModulo(modulosHabilitados, 'POPS') && (
            <NavItem href="/dashboard/pops" label="POPs" icon={<IconBook />} />
          )}

          {hasModulo(modulosHabilitados, 'PAINEL_FISCAL') && (
            <NavItem href="/dashboard/fiscal" label="ANVISA" icon={<IconShield color={INACTIVE} />} />
          )}
        </div>

        {/* Configuração */}
        <button onClick={() => setConfigOpen(v => !v)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', marginBottom: 6, background: 'none', border: 'none', cursor: 'pointer' }}>
          <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: SECTION_LABEL }}>Configuração</span>
          <svg style={{ width: 12, height: 12, color: SECTION_LABEL, transform: configOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {configOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 8 }}>
            <NavItem href="/dashboard/perfil" label="Perfil" icon={<IconUser />} />
            <NavItem href="/dashboard/geral" label="Geral" icon={<IconSettings />} />

            {(permissions.includes('SUPER_ADMIN_GLOBAIS') || permissions.includes('DRIVE_CONFIGURAR') || permissions.includes('ANVISA_RELATORIOS') || permissions.includes('DSF_CANCELAR')) && (
              <NavItem href="/dashboard/admin" label="Usuários" icon={<IconUsers />} />
            )}

            {permissions.includes('DRIVE_CONFIGURAR') && (
              <NavItem href="/dashboard/configuracoes" label="Google Drive" icon={<IconCloud />} />
            )}

            {(permissions.includes('POPS_GERENCIAR') || permissions.includes('SUPER_ADMIN_GLOBAIS')) && (
              <NavItem href="/dashboard/configuracoes/pops" label="Gestão de POPs" icon={<IconFileText />} />
            )}

            {(permissions.includes('ANVISA_RELATORIOS') || permissions.includes('DSF_CANCELAR') || permissions.includes('DRIVE_CONFIGURAR') || permissions.includes('SUPER_ADMIN_GLOBAIS')) && (
              <>
                <p style={{ padding: '6px 12px 2px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(255,255,255,0.2)' }}>DSF</p>
                {permissions.includes('ANVISA_RELATORIOS') && <NavItem href="/dashboard/anvisa" label="Relatório DSF" icon={<IconTable />} />}
                {(permissions.includes('SUPER_ADMIN_GLOBAIS') || permissions.includes('DRIVE_CONFIGURAR') || permissions.includes('ANVISA_RELATORIOS') || permissions.includes('DSF_CANCELAR')) && (
                  <NavItem href="/dashboard/pacientes" label="Clientes" icon={<IconUsers />} />
                )}
                {permissions.includes('DRIVE_CONFIGURAR') && <NavItem href="/dashboard/admin/procedimentos" label="Procedimentos" icon={<IconClipboard />} />}
              </>
            )}
          </div>
        )}

        {/* Super Admin */}
        {permissions.includes('SUPER_ADMIN_GLOBAIS') && (
          <>
            <p style={{ padding: '6px 12px 4px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: SECTION_LABEL, marginTop: 4 }}>Admin</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <NavItem href="/dashboard/saas" label="Dashboard SaaS" icon={<IconChart />} />
              <NavItem href="/dashboard/tenants" label="Estabelecimentos" icon={<IconBuilding />} />
              <NavItem href="/dashboard/planos" label="Planos" icon={<IconTicket />} />
              <NavItem href="/dashboard/gateways" label="Pagamentos" icon={<IconCreditCard />} />
            </div>
          </>
        )}
      </nav>

      {/* Badge assinatura */}
      {assinaturaStatus && assinaturaStatus !== 'ATIVA' && assinaturaStatus !== 'VITALICIO' && (
        <div style={{ margin: '0 10px 8px', padding: '8px 12px', borderRadius: 8, fontSize: 12, background: assinaturaStatus === 'TRIAL' ? 'rgba(251,191,36,0.12)' : 'rgba(239,68,68,0.12)', border: `1px solid ${assinaturaStatus === 'TRIAL' ? 'rgba(251,191,36,0.3)' : 'rgba(239,68,68,0.3)'}`, color: assinaturaStatus === 'TRIAL' ? '#fbbf24' : '#f87171' }}>
          {assinaturaStatus === 'TRIAL' && trialExpiraEm && (
            <><p style={{ fontWeight: 600 }}>Período de teste</p><p suppressHydrationWarning>Expira em {new Date(trialExpiraEm).toLocaleDateString('pt-BR')}</p></>
          )}
          {assinaturaStatus === 'SUSPENSA' && <><p style={{ fontWeight: 600 }}>Assinatura suspensa</p><p>Regularize seu pagamento.</p></>}
          {(assinaturaStatus === 'EXPIRADA' || assinaturaStatus === 'CANCELADA') && (
            diasEmTolerancia != null
              ? <><p style={{ fontWeight: 600 }}>Acesso expira em breve</p><p>Bloqueio em {diasEmTolerancia} dia{diasEmTolerancia !== 1 ? 's' : ''}. Renove seu plano.</p></>
              : <><p style={{ fontWeight: 600 }}>Acesso encerrado</p><p>Renove seu plano para continuar.</p></>
          )}
          {assinaturaStatus === 'SEM_ASSINATURA' && <><p style={{ fontWeight: 600 }}>Sem assinatura</p><p>Entre em contato com o suporte.</p></>}
        </div>
      )}

      {/* Footer */}
      <div style={{ padding: '12px 14px', borderTop: `1px solid ${SEPARATOR}`, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Link href="/dashboard/perfil" style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, textDecoration: 'none' }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ color: 'white', fontSize: 11, fontWeight: 500 }}>{initials}</span>
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</p>
            {userCrf
              ? <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>{userCrf}</p>
              : <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail}</p>
            }
          </div>
        </Link>
        <LogoutButton minimal />
      </div>
    </div>
  )

  return (
    <div className="min-h-screen lg:flex lg:h-screen lg:overflow-hidden" style={{ background: '#F1F5F9' }}>

      {/* Mobile header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 lg:hidden" style={{ height: 56 }}>
        <div className="relative flex items-center h-full px-3">
          {/* Esquerda: hambúrguer */}
          <button onClick={() => setOpen(true)} className="w-11 h-11 flex items-center justify-center rounded-xl text-slate-500 active:bg-slate-100 transition-colors -ml-1" aria-label="Abrir menu">
            <svg width={22} height={22} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Centro: logo (absolutamente centrado) */}
          <div className="absolute inset-x-0 top-0 h-full flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-1.5">
              <div style={{ width: 22, height: 22, borderRadius: 6, background: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconShield color="white" size={12} />
              </div>
              <span style={{ fontSize: 15, fontWeight: 600, color: '#0f172a' }}>FarmaSign</span>
            </div>
          </div>

          {/* Direita: bell + avatar */}
          <div className="ml-auto flex items-center gap-1">
            <button className="w-10 h-10 flex items-center justify-center rounded-full text-slate-500 active:bg-slate-100 transition-colors" aria-label="Alertas">
              <IconBell size={20} />
            </button>
            <Link href="/dashboard/perfil" style={{ width: 32, height: 32, borderRadius: '50%', background: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ color: 'white', fontSize: 12, fontWeight: 600 }}>{initials}</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: '85vw', maxWidth: 280, background: NAVY, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: `1px solid ${SEPARATOR}`, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 24, height: 24, borderRadius: 6, background: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconShield color="white" size={13} />
                </div>
                <span style={{ color: 'white', fontSize: 14, fontWeight: 600 }}>Menu</span>
              </div>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: INACTIVE, cursor: 'pointer', padding: 8, borderRadius: 8 }} aria-label="Fechar menu">
                <svg style={{ width: 18, height: 18 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {sidebarContent}
            </div>
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-60 lg:flex-shrink-0" style={{ background: NAVY }}>
        {sidebarContent}
      </aside>

      {/* Main */}
      <main className="flex-1 lg:overflow-y-auto pb-24 lg:pb-0">
        {diasEmTolerancia != null && (
          <div className="bg-red-600 text-white px-4 py-3 flex items-center gap-3">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm flex-1">
              <span className="font-bold">Não localizamos o seu pagamento.</span>{' '}
              Verifique o pagamento ou{' '}
              <a href="mailto:suporte@farmasign.com.br" className="underline hover:no-underline">fale com nosso suporte</a>.{' '}
              O acesso será bloqueado em{' '}
              <span className="font-bold">{diasEmTolerancia} {diasEmTolerancia === 1 ? 'dia' : 'dias'}</span>.
            </p>
          </div>
        )}
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-20 lg:hidden"
        style={{
          background: NAVY,
          borderTop: `1px solid ${SEPARATOR}`,
          paddingBottom: 'calc(8px + env(safe-area-inset-bottom))',
        }}
      >
        <div className="flex items-stretch" style={{ height: 64 }}>
          <MobileTabItem href="/dashboard" label="Início" active={clientPathname === '/dashboard'} icon={<IconHome size={22} />} />
          {bottomPrimary.map(item => (
            <MobileTabItem key={item.href} href={item.href} label={item.label} active={!!clientPathname && clientPathname.startsWith(item.href)} icon={item.icon} />
          ))}
          <MobileTabItem href="/dashboard/perfil" label="Config." active={isConfigActive} icon={<IconSettings size={22} />} />
          <button
            onClick={() => setMaisOpen(v => !v)}
            className="flex-1 flex flex-col items-center justify-center gap-1 select-none transition-colors relative pt-1"
            style={{ color: maisOpen ? GREEN : 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {maisOpen && (
              <span style={{
                position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                width: 28, height: 2, borderRadius: '0 0 2px 2px', background: GREEN,
              }} />
            )}
            <IconGrid size={22} />
            <span style={{ fontSize: 10, fontWeight: 500 }}>Mais</span>
          </button>
        </div>
      </nav>

      {/* Bottom sheet "Mais" */}
      {maisOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setMaisOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-xl"
            style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div style={{ width: 40, height: 4, borderRadius: 2, background: '#e2e8f0' }} />
            </div>
            <p style={{ padding: '2px 20px 10px', fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Mais módulos
            </p>
            {maisNavItems.length === 0 ? (
              <p style={{ padding: '12px 20px', fontSize: 14, color: '#94a3b8' }}>Nenhum módulo adicional habilitado.</p>
            ) : (
              maisNavItems.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMaisOpen(false)}
                  className="flex items-center gap-3 px-5 active:bg-slate-50 transition-colors"
                  style={{ borderTop: '1px solid #f8fafc', paddingTop: 14, paddingBottom: 14 }}
                >
                  <span style={{ color: '#64748b', flexShrink: 0 }}>{item.icon}</span>
                  <span style={{ fontSize: 15, fontWeight: 500, color: '#1e293b', flex: 1 }}>{item.label}</span>
                  <svg style={{ width: 16, height: 16, color: '#cbd5e1', flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function MobileTabItem({ href, label, active, icon }: { href: string; label: string; active: boolean; icon: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex-1 flex flex-col items-center justify-center gap-1 select-none transition-colors relative pt-1"
      style={{ color: active ? '#28B478' : 'rgba(255,255,255,0.4)' }}
    >
      {active && (
        <span style={{
          position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: 28, height: 2, borderRadius: '0 0 2px 2px', background: '#28B478',
        }} />
      )}
      {icon}
      <span style={{ fontSize: 10, fontWeight: 500 }}>{label}</span>
    </Link>
  )
}

// ── Inline SVG icons ────────────────────────────────────────────────────────

function IconHome({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
}
function IconFileText({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
}
function IconThermo({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14 14.76V3.5a2.5 2.5 0 00-5 0v11.26a4.5 4.5 0 105 0z" /></svg>
}
function IconWrench({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" /></svg>
}
function IconBook({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
}
function IconShield({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
}
function IconPill({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
}
function IconCalendar({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
}
function IconUser({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
}
function IconSettings({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
}
function IconUsers({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
}
function IconCloud({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>
}
function IconTable({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
}
function IconClipboard({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
}
function IconChart({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
}
function IconBuilding({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
}
function IconTicket({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>
}
function IconCreditCard({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
}
function IconBell({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
}
function IconGrid({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
}
