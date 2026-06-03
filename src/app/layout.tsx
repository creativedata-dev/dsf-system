import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { Providers } from '@/components/providers'
import { PwaRegister } from '@/components/pwa-register'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })

export const metadata: Metadata = {
  title: 'FarmaSign — Gestão de Serviços Farmacêuticos',
  description: 'Emissão e gestão de Declarações de Serviços Farmacêuticos conforme ANVISA RDC 44/2009',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'FarmaSign',
  },
  formatDetection: { telephone: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${geist.variable} h-full antialiased`}>
      <head>
        <meta name="theme-color" content="#16a34a" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
      </head>
      <body className="min-h-full bg-slate-50 text-slate-900">
        <PwaRegister />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
