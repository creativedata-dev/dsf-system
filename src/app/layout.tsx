import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { Providers } from '@/components/providers'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })

export const metadata: Metadata = {
  title: 'DSF System — Gestão de Serviços Farmacêuticos',
  description: 'Emissão e gestão de Declarações de Serviços Farmacêuticos conforme ANVISA RDC 44/2009',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full bg-slate-50 text-slate-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
