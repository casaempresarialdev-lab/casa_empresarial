'use client'

import { useEffect, useRef, useState } from 'react'
import { Icon, type IconName } from './icon'

export interface ActionMenuItem {
  icon: IconName
  label: string
  onClick: () => void
  tone?: 'default' | 'danger'
  disabled?: boolean
}

interface ActionMenuProps {
  items: ActionMenuItem[]
  /** Texto do botão para leitores de tela (ex.: "Ações de Fulano") */
  label?: string
}

const MENU_WIDTH = 208

// Agrupador de ações da linha: botão "⋯" que abre um menu flutuante com ícone + texto
export function ActionMenu({ items, label = 'Ações' }: ActionMenuProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number }>({ left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Fecha ao clicar fora, apertar Esc, rolar a página ou redimensionar
  useEffect(() => {
    if (!open) return
    function onPointer(e: MouseEvent) {
      const t = e.target as Node
      if (!menuRef.current?.contains(t) && !btnRef.current?.contains(t)) setOpen(false)
    }
    const close = () => setOpen(false)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  function toggle() {
    const rect = btnRef.current?.getBoundingClientRect()
    if (rect) {
      // Alinha à direita do botão; abre para cima se não couber embaixo
      const left = Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8))
      const estimated = items.length * 44 + 16
      const openUp = rect.bottom + estimated + 8 > window.innerHeight
      setPos(openUp ? { bottom: window.innerHeight - rect.top + 6, left } : { top: rect.bottom + 6, left })
    }
    setOpen((v) => !v)
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className="w-9 h-9 flex items-center justify-center rounded-lg transition-colors hover:bg-gray-100"
        style={{ color: 'var(--color-sidebar-text)', backgroundColor: open ? 'var(--color-bg-surface)' : undefined }}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          className="toast-enter fixed z-50 rounded-2xl border bg-white py-2 shadow-[0_12px_32px_rgba(0,0,0,0.12),0_2px_6px_rgba(0,0,0,0.06)]"
          style={{ ...pos, width: MENU_WIDTH, borderColor: 'var(--color-card-border)' }}
        >
          {items.map((item) => {
            const danger = item.tone === 'danger'
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => { setOpen(false); item.onClick() }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-[15px] font-medium text-left transition-colors disabled:opacity-50 ${danger ? 'hover:bg-red-50' : 'hover:bg-gray-50'}`}
                style={{ color: danger ? 'var(--color-error)' : 'var(--color-text-secondary)' }}
              >
                <span style={{ color: danger ? 'var(--color-error)' : 'var(--color-text-muted)' }}>
                  <Icon name={item.icon} size={18} />
                </span>
                {item.label}
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}
