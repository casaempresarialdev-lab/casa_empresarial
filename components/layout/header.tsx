'use client'

import { useAppStore } from '@/store'

interface HeaderProps {
  companies?: { id: string; razao_social: string }[]
  userName?: string
  userAvatar?: string | null
}

export function Header({ companies = [], userName, userAvatar }: HeaderProps) {
  // Seletores separados — objeto literal causaria re-render infinito
  const activeCompanyId = useAppStore((s) => s.activeCompanyId)
  const setActiveCompany = useAppStore((s) => s.setActiveCompany)
  const expanded = useAppStore((s) => s.sidebarExpanded)

  const activeCompany = companies.find((c) => c.id === activeCompanyId)

  return (
    <header
      className="fixed top-0 right-0 h-16 flex items-center justify-between px-6 border-b z-30 transition-all duration-200"
      style={{
        left: expanded ? 'var(--sidebar-width-expanded)' : 'var(--sidebar-width-collapsed)',
        backgroundColor: '#FFFFFF',
        borderColor: 'var(--color-bg-surface)',
      }}
    >
      {/* Seletor de empresa */}
      <div className="flex items-center gap-2">
        {companies.length > 1 ? (
          <select
            value={activeCompanyId ?? ''}
            onChange={(e) => setActiveCompany(e.target.value)}
            className="text-sm rounded-lg border px-3 py-1.5 focus:outline-none"
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
          <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            {activeCompany?.razao_social ?? ''}
          </span>
        )}
      </div>

      {/* Avatar do usuário */}
      <div className="flex items-center gap-3">
        <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {userName}
        </span>
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold"
          style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-darker)' }}
        >
          {userAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={userAvatar} alt={userName} className="w-8 h-8 rounded-full object-cover" />
          ) : (
            userName?.charAt(0).toUpperCase() ?? '?'
          )}
        </div>
      </div>
    </header>
  )
}
