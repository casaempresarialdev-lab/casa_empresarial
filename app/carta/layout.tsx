import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Carta proposta',
  robots: 'noindex',
}

export default function CartaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
