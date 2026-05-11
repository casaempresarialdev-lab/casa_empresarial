'use client'

import { useRouter } from 'next/navigation'
import { useAppStore } from '@/store'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface HeaderProps {
  companies?: { id: string; razao_social: string }[]
  userName?: string
  userAvatar?: string | null
}

export function Header({ companies = [], userName, userAvatar }: HeaderProps) {
  const router = useRouter()
  // Seletores separados — objeto literal causaria re-render infinito
  const activeCompanyId = useAppStore((s) => s.activeCompanyId)
  const setActiveCompany = useAppStore((s) => s.setActiveCompany)
  const expanded = useAppStore((s) => s.sidebarExpanded)
  const setMobileSidebarOpen = useAppStore((s) => s.setMobileSidebarOpen)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const activeCompany = companies.find((c) => c.id === activeCompanyId)

  return (
    <header
      className={cn(
        'fixed top-0 right-0 h-16 flex items-center justify-between px-4 md:px-6 border-b z-30 transition-all duration-200',
        // Mobile: sempre left-0 (sidebar é overlay). Desktop: acompanha sidebar.
        'left-0',
        expanded ? 'md:left-60' : 'md:left-16',
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

      {/* Avatar + Logout */}
      <div className="flex items-center gap-2 md:gap-3">
        <span className="text-sm hidden sm:block" style={{ color: 'var(--color-text-muted)' }}>
          {userName}
        </span>
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
          style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-darker)' }}
        >
          {userAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={userAvatar} alt={userName} className="w-8 h-8 rounded-full object-cover" />
          ) : (
            userName?.charAt(0).toUpperCase() ?? '?'
          )}
        </div>
        <button
          onClick={handleLogout}
          className="text-xs px-2 md:px-3 py-1.5 rounded-lg border transition-colors hover:bg-gray-50"
          style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-muted)' }}
          title="Sair do sistema"
        >
          Sair
        </button>
      </div>
    </header>
  )
}
