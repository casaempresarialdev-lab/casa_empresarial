'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

export type ThreeDotMenuItem = { label: string; onClick: () => void; danger?: boolean }

interface Props {
  items: ThreeDotMenuItem[]
  /** Texto explicativo inerte no rodapé do menu — ex: "Área fixa do método" */
  note?: string
  label?: string
  className?: string
}

/**
 * Menu "⋮" reaproveitável — mesmo padrão já usado (duplicado) em vários módulos:
 * position fixed + getBoundingClientRect, com detecção de colisão vertical
 * (abre pra cima se não couber embaixo). Esta é a primeira versão compartilhada;
 * os módulos antigos continuam com a própria cópia local por enquanto.
 *
 * O painel é desenhado via Portal direto em document.body — necessário porque,
 * dentro do menu lateral, o <aside> tem `transform` (translateX, pro slide no
 * celular) e isso cria um "containing block" novo pra qualquer filho com
 * position:fixed, prendendo o painel lá dentro em vez de ancorar na viewport.
 */
export function ThreeDotMenu({ items, note, label = 'Mais ações', className }: Props) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const menuRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function handleOpen(e: React.MouseEvent) {
    e.stopPropagation()
    const rect = btnRef.current?.getBoundingClientRect()
    if (rect) {
      const estimatedHeight = items.length * 34 + (note ? 30 : 0) + 16
      const openUp = rect.bottom + estimatedHeight > window.innerHeight - 8
      setPos(openUp
        ? { top: rect.top - estimatedHeight, right: window.innerWidth - rect.right }
        : { top: rect.bottom + 4, right: window.innerWidth - rect.right }
      )
    }
    setOpen(v => !v)
  }

  return (
    <div className={className} onClick={e => e.stopPropagation()}>
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-black/5 transition-colors text-sm shrink-0"
        style={{ color: 'var(--color-text-muted)' }}
        aria-label={label}
      >
        ⋮
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          className="fixed w-48 rounded-xl border shadow-lg py-1 z-50"
          style={{ backgroundColor: 'white', borderColor: 'var(--color-bg-surface)', top: pos.top, right: pos.right }}
          onClick={e => e.stopPropagation()}
        >
          {items.map((item, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { setOpen(false); item.onClick() }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
              style={{ color: item.danger ? 'var(--color-error)' : 'var(--color-text-secondary)' }}
            >
              {item.label}
            </button>
          ))}
          {note && (
            <p className="px-3 pt-2 pb-1 text-xs border-t mt-1" style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-muted)' }}>
              {note}
            </p>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}
