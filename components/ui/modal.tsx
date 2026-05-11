'use client'

import { useEffect } from 'react'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}

export function Modal({ open, onClose, title, description, children, className }: ModalProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) {
      document.addEventListener('keydown', handleEsc)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    // Mobile: bottom-sheet (items-end). sm+: centralizado (items-center).
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          'relative bg-white w-full sm:max-w-lg',
          // Mobile: cantos arredondados só no topo (bottom-sheet). sm+: todos os cantos.
          'rounded-t-2xl sm:rounded-xl',
          'shadow-xl max-h-[90vh] flex flex-col',
          className,
        )}
        role="dialog"
        aria-modal="true"
      >
        {/* Drag handle — mobile apenas */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        <div
          className="flex items-center justify-between px-6 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--color-bg-surface)' }}
        >
          <div>
            <h2
              className="text-base font-semibold"
              style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}
            >
              {title}
            </h2>
            {description && (
              <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                {description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
            aria-label="Fechar"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
