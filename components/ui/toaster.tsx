'use client'

import { useEffect } from 'react'
import { useAppStore, type Toast, type ToastStatus } from '@/store'

const TOAST_DURATION_MS = 4000

// Pilha de toasts no canto superior direito — fundo na cor principal, texto branco
export function Toaster() {
  const toasts = useAppStore((s) => s.toasts)

  return (
    <div
      className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[calc(100%-2rem)] sm:w-96 pointer-events-none"
      aria-live="polite"
      role="status"
    >
      {toasts.map((t) => <ToastItem key={t.id} toast={t} />)}
    </div>
  )
}

function ToastItem({ toast }: { toast: Toast }) {
  const dismissToast = useAppStore((s) => s.dismissToast)

  // Enquanto processa, não some; ao virar ✓/✕, conta o tempo para sumir
  useEffect(() => {
    if (toast.status === 'loading') return
    const timer = setTimeout(() => dismissToast(toast.id), TOAST_DURATION_MS)
    return () => clearTimeout(timer)
  }, [toast.id, toast.status, dismissToast])

  return (
    <div
      className="toast-enter pointer-events-auto flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-[0_10px_30px_rgba(0,0,0,0.18)]"
      style={{ backgroundColor: 'var(--color-brand)' }}
    >
      {/* key no status: o ícone "estoura" (pop) a cada troca */}
      <span key={toast.status} className="toast-icon shrink-0 w-5 h-5 flex items-center justify-center">
        <StatusIcon status={toast.status} />
      </span>
      <p className="flex-1">{toast.message}</p>
      {toast.status !== 'loading' && (
        <button
          type="button"
          onClick={() => dismissToast(toast.id)}
          className="shrink-0 opacity-70 hover:opacity-100 transition-opacity cursor-pointer"
          aria-label="Fechar"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  )
}

function StatusIcon({ status }: { status: ToastStatus }) {
  if (status === 'loading') {
    // Anel girando
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="animate-spin" aria-label="Processando">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    )
  }

  // Círculo branco com ✓ ou ✕ desenhado
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-label={status === 'success' ? 'Concluído' : 'Erro'}>
      <circle cx="12" cy="12" r="11" fill="currentColor" />
      {status === 'success' ? (
        <polyline points="7 12.5 10.5 16 17 8.5" className="toast-draw" stroke="var(--color-brand)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <>
          <line x1="8" y1="8" x2="16" y2="16" className="toast-draw" stroke="var(--color-brand)" strokeWidth="2.8" strokeLinecap="round" />
          <line x1="16" y1="8" x2="8" y2="16" className="toast-draw toast-draw-2" stroke="var(--color-brand)" strokeWidth="2.8" strokeLinecap="round" />
        </>
      )}
    </svg>
  )
}
