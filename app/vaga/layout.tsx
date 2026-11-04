import type { Metadata } from 'next'
import { Toaster } from '@/components/ui/toaster'

export const metadata: Metadata = {
  title: 'Candidatura',
  robots: 'noindex',
}

export default function VagaPublicaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#FAF8F9' }}>
      {children}
      <Toaster />
    </div>
  )
}
