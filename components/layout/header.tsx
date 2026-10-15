'use client'

import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'

export function Header() {
  const expanded = useAppStore((s) => s.sidebarExpanded)
  const setMobileSidebarOpen = useAppStore((s) => s.setMobileSidebarOpen)

  return (
    <header
      className={cn(
        'fixed top-0 right-0 h-16 flex items-center px-4 md:px-6 border-b z-30 transition-all duration-200',
        'left-0',
        expanded ? 'md:left-60' : 'md:left-16',
      )}
      style={{
        backgroundColor: '#FFFFFF',
        borderColor: 'var(--color-bg-surface)',
      }}
    >
      {/* Hambúrguer — mobile apenas (abre o menu lateral, que no artefato da
          Carol concentra tudo: navegação, empresa ativa e avatar) */}
      <button
        className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
        onClick={() => setMobileSidebarOpen(true)}
        aria-label="Abrir menu"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
    </header>
  )
}
