'use client'

import { Modal } from './modal'
import { Button } from './button'
import { Icon } from './icon'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  /** Texto da pergunta; pode destacar partes com <strong> */
  message: React.ReactNode
  confirmLabel?: string
  loading?: boolean
}

// Confirmação de ação destrutiva no padrão visual do sistema (substitui o confirm() do navegador)
export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Remover', loading }: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="flex items-start gap-4">
        <span className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center bg-red-50" style={{ color: 'var(--color-error)' }}>
          <Icon name="trash" size={20} />
        </span>
        <div className="text-sm pt-1" style={{ color: 'var(--color-text-secondary)' }}>
          {message}
          <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>Essa ação não pode ser desfeita.</p>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-6">
        <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button type="button" variant="danger" onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
      </div>
    </Modal>
  )
}
