'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, useEffect } from 'react'
import Link from 'next/link'
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
  const activeCompanyId = useAppStore((s) => s.activeCompanyId)
  const setActiveCompany = useAppStore((s) => s.setActiveCompany)
  const expanded = useAppStore((s) => s.sidebarExpanded)
  const setMobileSidebarOpen = useAppStore((s) => s.setMobileSidebarOpen)

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
    await supabase.auth.signOut()
    router.push('/login')
  }

  const activeCompany = companies.find((c) => c.id === activeCompanyId)

  return (
    <header
      className={cn(
        'fixed top-0 right-0 h-16 flex items-center justify-between px-4 md:px-6 border-b z-30 transition-all duration-200',
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

      {/* Avatar com dropdown */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2 md:gap-3 rounded-xl px-2 py-1.5 hover:bg-gray-50 transition-colors"
          aria-label="Menu do usuário"
        >
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
          {/* Chevron */}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className={cn('transition-transform duration-200', menuOpen && 'rotate-180')}
            style={{ color: 'var(--color-text-muted)' }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* Dropdown */}
        {menuOpen && (
          <div
            className="absolute right-0 top-full mt-2 w-52 rounded-xl border shadow-lg py-1 z-50"
            style={{ backgroundColor: '#FFFFFF', borderColor: 'var(--color-bg-surface)' }}
          >
            {/* Info do usuário */}
            <div className="px-4 py-2.5 border-b" style={{ borderColor: 'var(--color-bg-surface)' }}>
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                {userName}
              </p>
            </div>

            {/* Links */}
            <nav className="py-1">
              <Link
                href="/empresa"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                <span>🏠</span> Minha Empresa
              </Link>
              <Link
                href="/meu-plano"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                <span>⭐</span> Meu Plano
              </Link>
              <Link
                href="/admin/usuarios"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                <span>👥</span> Usuários
              </Link>
            </nav>

            {/* Separador + Sair */}
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
    </header>
  )
}
