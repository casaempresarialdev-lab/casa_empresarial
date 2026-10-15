'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { CompanySwitcher, ROLE_LABELS, type SwitcherCompany } from './company-switcher'

interface Props {
  companies: SwitcherCompany[]
  activeCompanyId: string | null
  onSelectCompany: (id: string) => void
  userName?: string
  userEmail?: string
  userAvatar?: string | null
  role?: string | null
  myEmployeeId?: string | null
  expanded: boolean
}

/**
 * Menu do avatar — fica no rodapé do menu lateral, não mais no header, igual
 * ao artefato da Carol (renderProfileMenu). O painel abre pra cima (o
 * gatilho fica colado no fim da tela) via portal direto em document.body —
 * mesmo motivo do ThreeDotMenu: o <aside> tem `transform` pro slide mobile,
 * que quebra qualquer position:fixed filho se não for portado pra fora.
 */
export function SidebarProfileMenu({
  companies, activeCompanyId, onSelectCompany,
  userName, userEmail, userAvatar, role, myEmployeeId, expanded,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ left: 0, bottom: 0 })
  const panelRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function handleToggle() {
    const rect = btnRef.current?.getBoundingClientRect()
    if (rect) {
      setPos({ left: rect.left, bottom: window.innerHeight - rect.top + 8 })
    }
    setOpen(v => !v)
  }

  async function handleLogout() {
    const supabase = createClient()
    document.cookie = 'active_company_id=; path=/; max-age=0; SameSite=Lax'
    document.cookie = 'active_company_role=; path=/; max-age=0; SameSite=Lax'
    document.cookie = 'my_employee_id=; path=/; max-age=0; SameSite=Lax'
    document.cookie = 'active_area_permissions=; path=/; max-age=0; SameSite=Lax'
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Carol chama o dono de "Master" (não "Proprietário") no cabeçalho desse menu —
  // mesmo rótulo do artefato; os outros papéis usam o rótulo padrão do sistema.
  const roleLabel = role === 'owner' ? 'Master' : role ? (ROLE_LABELS[role] ?? role) : null
  const items: { href: string; icon: string; label: string }[] = [
    ...(myEmployeeId ? [{ href: `/pessoas/funcionarios/${myEmployeeId}`, icon: '🙋', label: 'Sou colaborador' }] : []),
    { href: '/empresa', icon: '🏠', label: 'Minha Empresa' },
    { href: '/suporte', icon: '💬', label: 'Suporte' },
    { href: '/admin/logins-senhas', icon: '🔑', label: 'Logins e Senhas' },
    { href: '/configuracoes', icon: '⚙️', label: 'Configurações' },
  ]

  return (
    <div className="border-t" style={{ borderColor: 'var(--color-bg-surface)' }}>
      <button
        ref={btnRef}
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center gap-2 px-3 py-3 hover:bg-gray-50 transition-colors"
      >
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
        <span className={cn('flex-1 min-w-0 text-left', !expanded && 'md:hidden')}>
          <span className="block text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
            {userName}
          </span>
        </span>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          className={cn('shrink-0 transition-transform', !expanded && 'md:hidden', open && 'rotate-180')}
          style={{ color: 'var(--color-text-muted)' }}
        >
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={panelRef}
          className="fixed w-72 rounded-xl border shadow-lg z-50 max-h-[80vh] overflow-y-auto"
          style={{ backgroundColor: 'white', borderColor: 'var(--color-bg-surface)', left: pos.left, bottom: pos.bottom }}
        >
          {/* Cabeçalho — identidade */}
          <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-bg-surface)' }}>
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
                style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-darker)' }}
              >
                {userAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={userAvatar} alt={userName} className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  userName?.charAt(0).toUpperCase() ?? '?'
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                  {userName}{roleLabel ? ` [${roleLabel}]` : ''}
                </p>
                {userEmail && (
                  <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{userEmail}</p>
                )}
              </div>
            </div>
          </div>

          {/* Empresa */}
          <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-bg-surface)' }}>
            <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>
              Empresa
            </p>
            <CompanySwitcher companies={companies} activeCompanyId={activeCompanyId} onSelect={onSelectCompany} />
          </div>

          {/* Itens */}
          <nav className="py-1">
            {items.map(item => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                <span>{item.icon}</span> {item.label}
              </Link>
            ))}
          </nav>

          {/* Sair */}
          <div className="border-t py-1" style={{ borderColor: 'var(--color-bg-surface)' }}>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-red-50 transition-colors text-left"
              style={{ color: 'var(--color-error)' }}
            >
              <span>🚪</span> Sair da conta
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
