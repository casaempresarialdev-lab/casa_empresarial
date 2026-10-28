'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import { useAppStore } from '@/store'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui/icon'

// Papel do usuário na empresa (mesmos nomes da tela Usuários)
const ROLE_LABELS: Record<string, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  member: 'Membro',
  accountant: 'Contador',
  colaborador: 'Colaborador',
}

interface UserMenuProps {
  userName?: string
  userEmail?: string | null
  userAvatar?: string | null
  companies?: { id: string; razao_social: string; role?: string }[]
  /** Sidebar retraída no desktop: mostra só o avatar */
  compact?: boolean
  onNavigate?: () => void
}

export function UserMenu({ userName, userEmail, userAvatar, companies = [], compact, onNavigate }: UserMenuProps) {
  const router = useRouter()
  const activeCompanyId = useAppStore((s) => s.activeCompanyId)
  const setActiveCompany = useAppStore((s) => s.setActiveCompany)
  const [menuOpen, setMenuOpen] = useState(false)
  const [companiesOpen, setCompaniesOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const activeCompany = companies.find((c) => c.id === activeCompanyId) ?? companies[0]
  const companyName = activeCompany?.razao_social
  const roleLabel = activeCompany?.role ? ROLE_LABELS[activeCompany.role] ?? activeCompany.role : null

  // Ao fechar o menu, a lista de empresas também fecha
  useEffect(() => { if (!menuOpen) setCompaniesOpen(false) }, [menuOpen])

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

      {/* Dropdown — abre para cima: usuário, empresa, atalhos e sair */}
      {menuOpen && (
        <div
          className="absolute left-0 bottom-full mb-2 w-72 rounded-xl border shadow-lg z-50"
          style={{ backgroundColor: '#FFFFFF', borderColor: 'var(--color-bg-surface)' }}
        >
          {/* Usuário: foto, nome, papel na empresa ativa e e-mail */}
          <div className="flex items-center gap-3 px-4 pt-4 pb-3">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center text-base font-semibold shrink-0 overflow-hidden"
              style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-darker)' }}
            >
              {userAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={userAvatar} alt={userName} className="w-11 h-11 rounded-full object-cover" />
              ) : (
                userName?.charAt(0).toUpperCase() ?? '?'
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
                {userName}
                {roleLabel && <span className="ml-1 font-semibold" style={{ color: 'var(--color-brand)' }}>[{roleLabel}]</span>}
              </p>
              {userEmail && (
                <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{userEmail}</p>
              )}
            </div>
          </div>

          {/* Empresa ativa; com mais de uma, a seta abre a lista para trocar */}
          {activeCompany && (
            <div className="px-4 pb-3">
              <p className="pb-1.5 text-[11px] font-semibold tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                EMPRESA
              </p>
              <button
                type="button"
                onClick={() => setCompaniesOpen((v) => !v)}
                disabled={companies.length < 2}
                className="w-full flex items-center gap-2 h-10 px-3 rounded-lg bg-gray-50 text-sm text-left transition-colors enabled:hover:bg-gray-100 disabled:cursor-default"
                style={{ color: 'var(--color-text-primary)' }}
                aria-expanded={companiesOpen}
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: 'var(--color-brand)' }} />
                <span className="flex-1 truncate font-medium">{activeCompany.razao_social}</span>
                {companies.length > 1 && (
                  <svg
                    width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                    className={cn('shrink-0 transition-transform duration-200', companiesOpen && 'rotate-180')}
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                )}
              </button>
              {companiesOpen && (
                <div className="mt-1 rounded-lg border py-1" style={{ borderColor: 'var(--color-bg-surface)' }}>
                  {companies.map((c) => {
                    const active = c.id === activeCompany.id
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => { setActiveCompany(c.id); setCompaniesOpen(false); setMenuOpen(false) }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors text-left"
                        style={{ color: active ? 'var(--color-brand)' : 'var(--color-sidebar-text)', fontWeight: active ? 600 : 400 }}
                      >
                        <span className="flex-1 truncate">{c.razao_social}</span>
                        {active && <span aria-hidden="true">✓</span>}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          <nav className="border-t py-2" style={{ borderColor: 'var(--color-bg-surface)' }}>
            <Link
              href="/perfil"
              onClick={closeAll}
              className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
              style={{ color: 'var(--color-sidebar-text)' }}
            >
              <Icon name="user" size={16} /> Meu Perfil
            </Link>
            <Link
              href="/empresa"
              onClick={closeAll}
              className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
              style={{ color: 'var(--color-sidebar-text)' }}
            >
              <Icon name="briefcase" size={16} /> Minha Empresa
            </Link>
            {/* Cofre pessoal do usuário (vale em qualquer empresa) */}
            <Link
              href="/cofre-de-senhas"
              onClick={closeAll}
              className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
              style={{ color: 'var(--color-sidebar-text)' }}
            >
              <Icon name="lock" size={16} /> Cofre de senhas
            </Link>
            <Link
              href="/admin/usuarios"
              onClick={closeAll}
              className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
              style={{ color: 'var(--color-sidebar-text)' }}
            >
              <Icon name="users" size={16} /> Usuários
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
              href="/configuracoes"
              onClick={closeAll}
              className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
              style={{ color: 'var(--color-sidebar-text)' }}
            >
              <Icon name="settings" size={16} /> Configurações
            </Link>
          </nav>

          <div className="border-t py-2" style={{ borderColor: 'var(--color-bg-surface)' }}>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-[var(--color-brand-light)] transition-colors text-left"
              style={{ color: 'var(--color-brand)' }}
            >
              <Icon name="logout" size={16} /> Sair da conta
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
