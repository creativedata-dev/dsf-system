'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavLinkProps {
  href: string
  label: string
  icon: React.ReactNode
}

export function NavLink({ href, label, icon }: NavLinkProps) {
  const pathname = usePathname()
  const isActive = pathname === href || (href.length > 11 && pathname.startsWith(href))

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        isActive
          ? 'bg-blue-50 text-blue-700'
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
      }`}
    >
      <span className={`flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`}>
        {icon}
      </span>
      {label}
    </Link>
  )
}
