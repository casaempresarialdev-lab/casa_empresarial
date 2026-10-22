'use client'

import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'

interface HeaderProps {
  companies?: { id: string; razao_social: string }[]
}

// Menu do usuário fica no rodapé da sidebar (components/layout/user-menu.tsx)
export function Header({ companies = [] }: HeaderProps) {
  const activeCompanyId = useAppStore((s) => s.activeCompanyId)
  const setActiveCompany = useAppStore((s) => s.setActiveCompany)
  const expanded = useAppStore((s) => s.sidebarExpanded)
  const setMobileSidebarOpen = useAppStore((s) => s.setMobileSidebarOpen)

  const activeCompany = companies.find((c) => c.id === activeCompanyId)

  return (
    <header
      className={cn(
        'fixed top-0 right-0 h-16 flex items-center justify-between px-4 md:px-6 border-b z-30 transition-all duration-200',
        'left-0',
        expanded ? 'md:left-[264px]' : 'md:left-[88px]',
      )}
      style={{
        backgroundColor: '#FFFFFF',
        borderColor: 'var(--color-bg-surface)',
      }}
    >
      <div className="flex items-center gap-3">
        {/* Hambúrguer — mobile apenas */}
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

        {/* Seletor de empresa */}
        {companies.length > 1 ? (
          <select
            value={activeCompanyId ?? ''}
            onChange={(e) => setActiveCompany(e.target.value)}
            className="text-sm rounded-lg border px-3 py-1.5 focus:outline-none max-w-[160px] md:max-w-none"
            style={{
              borderColor: 'var(--color-bg-surface)',
              color: 'var(--color-text-secondary)',
            }}
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.razao_social}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-sm font-medium truncate max-w-[140px] md:max-w-none" style={{ color: 'var(--color-text-secondary)' }}>
            {activeCompany?.razao_social ?? ''}
          </span>
        )}
      </div>
    </header>
  )
}
