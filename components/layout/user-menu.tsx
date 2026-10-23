'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import { useAppStore } from '@/store'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui/icon'

interface UserMenuProps {
  userName?: string
  userAvatar?: string | null
  companies?: { id: string; razao_social: string }[]
  /** Sidebar retraída no desktop: mostra só o avatar */
  compact?: boolean
  onNavigate?: () => void
}

export function UserMenu({ userName, userAvatar, companies = [], compact, onNavigate }: UserMenuProps) {
  const router = useRouter()
  const activeCompanyId = useAppStore((s) => s.activeCompanyId)
  const setActiveCompany = useAppStore((s) => s.setActiveCompany)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const companyName = (companies.find((c) => c.id === activeCompanyId) ?? companies[0])?.razao_social

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
          {/* Troca de empresa — só para quem tem mais de uma */}
          {companies.length > 1 && (
            <div className="border-b py-1" style={{ borderColor: 'var(--color-bg-surface)' }}>
              <p className="px-4 pt-1.5 pb-1 text-[11px] font-semibold tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                EMPRESAS
              </p>
              {companies.map((c) => {
                const active = c.id === activeCompanyId
                return (
                  <button
                    key={c.id}
                    onClick={() => { setActiveCompany(c.id); setMenuOpen(false) }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50 transition-colors text-left"
                    style={{ color: active ? 'var(--color-primary-darker)' : 'var(--color-sidebar-text)', fontWeight: active ? 600 : 400 }}
                  >
                    <span className="flex-1 truncate">{c.razao_social}</span>
                    {active && <span aria-hidden="true">✓</span>}
                  </button>
                )
              })}
            </div>
          )}

          <nav className="py-1">
            <Link
              href="/configuracoes"
              onClick={closeAll}
              className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
              style={{ color: 'var(--color-sidebar-text)' }}
            >
              <Icon name="settings" size={16} /> Configurações
            </Link>
            <Link
              href="/meu-plano"
              onClick={closeAll}
              className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
              style={{ color: 'var(--color-sidebar-text)' }}
            >
              <Icon name="star" size={16} /> Meu Plano
            </Link>
            <Link
              href="/admin/usuarios"
              onClick={closeAll}
              className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
              style={{ color: 'var(--color-sidebar-text)' }}
            >
              <Icon name="users" size={16} /> Usuários
            </Link>
          </nav>

          <div className="border-t py-1" style={{ borderColor: 'var(--color-bg-surface)' }}>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-[var(--color-brand-light)] transition-colors text-left"
              style={{ color: 'var(--color-brand)' }}
            >
              <Icon name="logout" size={16} /> Sair
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
