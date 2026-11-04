import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Carta proposta',
  robots: 'noindex',
}

export default function CartaLayout({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: '100vh', backgroundColor: '#FAF8F9' }}>{children}</div>
}
