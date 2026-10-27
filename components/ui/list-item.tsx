'use client'

import { Icon, type IconName } from './icon'
import { ActionMenu, type ActionMenuItem } from './action-menu'

interface ListItemProps {
  /** Ícone à esquerda (ignorado quando há `media`) */
  icon?: IconName
  /** Conteúdo no lugar do ícone (ex.: foto do sócio) */
  media?: React.ReactNode
  title: React.ReactNode
  subtitle?: React.ReactNode
  /** Informações à direita, antes do menu (selos, senha, percentual…) */
  aside?: React.ReactNode
  actions: ActionMenuItem[]
  /** Nome do item para o menu de ações (leitores de tela) */
  actionsLabel: string
  /** Clique no cartão (ex.: abrir a pasta) */
  onClick?: () => void
}

// Item das listas em cartões (sócios, documentos, cofre, certificados): ícone, título, subtítulo e menu "⋯"
export function ListItem({ icon, media, title, subtitle, aside, actions, actionsLabel, onClick }: ListItemProps) {
  const body = (
    <>
      {media ?? (icon && (
        <span className="shrink-0" style={{ color: 'var(--color-brand)' }}>
          <Icon name={icon} size={18} />
        </span>
      ))}
      <div className="flex-1 min-w-0">
        <p className="font-bold truncate" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>{title}</p>
        {subtitle && (
          <div className="text-sm truncate" style={{ color: 'var(--color-text-muted)' }}>{subtitle}</div>
        )}
      </div>
    </>
  )

  return (
    <li
      className="flex items-center gap-4 rounded-xl border bg-white px-4 py-3.5 transition-colors hover:bg-gray-50/70"
      style={{ borderColor: 'var(--color-card-border)' }}
    >
      {onClick ? (
        <button type="button" onClick={onClick} className="flex-1 min-w-0 flex items-center gap-4 text-left cursor-pointer">
          {body}
        </button>
      ) : body}
      {aside && <div className="flex items-center gap-3 shrink-0">{aside}</div>}
      <ActionMenu label={`Ações de ${actionsLabel}`} items={actions} />
    </li>
  )
}

// Lista vazia (mesmo formato dos itens)
export function ListEmpty({ children }: { children: React.ReactNode }) {
  return (
    <li
      className="rounded-xl border border-dashed px-4 py-8 text-center text-sm"
      style={{ borderColor: 'var(--color-card-border)', color: 'var(--color-text-muted)' }}
    >
      {children}
    </li>
  )
}
