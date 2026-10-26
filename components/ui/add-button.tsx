'use client'

import { Icon } from './icon'

// Botão "+ Adicionar" discreto (vazado, na cor principal) usado na barra das caixas de listagem
export function AddButton({ onClick, label = 'Adicionar' }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-sm font-medium transition-colors hover:bg-[var(--color-brand-light)] shrink-0"
      style={{ borderColor: 'var(--color-brand)', color: 'var(--color-brand)' }}
    >
      <Icon name="plus" size={16} />
      {label}
    </button>
  )
}
