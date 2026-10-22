'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import { useAppStore } from '@/store'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface UserMenuProps {
  userName?: string
  userAvatar?: string | null
  companyName?: string | null
  /** Sidebar retraída no desktop: mostra só o avatar */
  compact?: boolean
  onNavigate?: () => void
}

export function UserMenu({ userName, userAvatar, companyName, compact, onNavigate }: UserMenuProps) {
  const router = useRouter()
  const setActiveCompany = useAppStore((s) => s.setActiveCompany)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  async function handleLogout() {
    const supabase = createClient()
    setActiveCompany(null)
    document.cookie = 'active_company_id=; path=/; max-age=0; SameSite=Lax'
    document.cookie = 'active_company_role=; path=/; max-age=0; SameSite=Lax'
    document.cookie = 'my_employee_id=; path=/; max-age=0; SameSite=Lax'
    await supabase.auth.signOut()
    router.push('/login')
  }

  function closeAll() {
    setMenuOpen(false)
    onNavigate?.()
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setMenuOpen((v) => !v)}
        className={cn(
          'w-full flex items-center gap-3 rounded-xl p-2 hover:bg-gray-50 transition-colors text-left',
          compact && 'md:justify-center',
        )}
        aria-label="Menu do usuário"
        title={compact ? userName : undefined}
      >
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 overflow-hidden"
          style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-darker)' }}
        >
          {userAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={userAvatar} alt={userName} className="w-9 h-9 rounded-full object-cover" />
          ) : (
            userName?.charAt(0).toUpperCase() ?? '?'
          )}
        </div>
        <div className={cn('flex-1 min-w-0', compact && 'md:hidden')}>
          <p className="text-sm font-semibold truncate" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
            {userName}
          </p>
          {companyName && (
            <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
              {companyName}
            </p>
          )}
        </div>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className={cn('shrink-0 transition-transform duration-200', menuOpen && 'rotate-180', compact && 'md:hidden')}
          style={{ color: 'var(--color-text-muted)' }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Dropdown — abre para cima */}
      {menuOpen && (
        <div
          className="absolute left-0 bottom-full mb-2 w-52 rounded-xl border shadow-lg py-1 z-50"
          style={{ backgroundColor: '#FFFFFF', borderColor: 'var(--color-bg-surface)' }}
        >
          <nav className="py-1">
            <Link
              href="/configuracoes"
              onClick={closeAll}
              className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <span>⚙️</span> Configurações
            </Link>
            <Link
              href="/meu-plano"
              onClick={closeAll}
              className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <span>⭐</span> Meu Plano
            </Link>
            <Link
              href="/admin/usuarios"
              onClick={closeAll}
              className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <span>👥</span> Usuários
            </Link>
          </nav>

          <div className="border-t py-1" style={{ borderColor: 'var(--color-bg-surface)' }}>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-red-50 transition-colors text-left"
              style={{ color: 'var(--color-error)' }}
            >
              <span>🚪</span> Sair
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
