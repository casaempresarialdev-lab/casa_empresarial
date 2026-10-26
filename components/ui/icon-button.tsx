'use client'

import { Icon, type IconName } from './icon'

interface IconButtonProps {
  icon: IconName
  /** Texto da dica (title) e do aria-label */
  label: string
  onClick: () => void
  tone?: 'default' | 'danger'
  disabled?: boolean
}

// Botão só com ícone (ações de linha de tabela: editar, remover, ver…)
export function IconButton({ icon, label, onClick, tone = 'default', disabled }: IconButtonProps) {
  const danger = tone === 'danger'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${danger ? 'hover:bg-red-50' : 'hover:bg-gray-100'}`}
      style={{ color: danger ? 'var(--color-error)' : 'var(--color-sidebar-text)' }}
    >
      <Icon name={icon} size={16} />
    </button>
  )
}
