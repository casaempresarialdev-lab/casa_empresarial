import Link from 'next/link'
import { Icon, type IconName } from '@/components/ui/icon'
import { DASHBOARD_CARD_CLASS, DASHBOARD_CARD_TITLE_CLASS, DASHBOARD_CARD_TITLE_STYLE } from './summary-card'

export type BadgeTone = 'green' | 'red' | 'amber' | 'blue' | 'neutral' | 'brand'

const TONES: Record<BadgeTone, { bg: string; color: string }> = {
  green:   { bg: '#DCFCE7', color: '#15803D' },
  red:     { bg: '#FEE2E2', color: '#B91C1C' },
  amber:   { bg: '#FEF3C7', color: '#B45309' },
  blue:    { bg: '#DBEAFE', color: '#1D4ED8' },
  neutral: { bg: 'var(--color-bg-surface)', color: 'var(--color-sidebar-text)' },
  brand:   { bg: 'var(--color-brand-light)', color: 'var(--color-primary-darker)' },
}

export type ListItem = {
  key: string
  title: string
  subtitle?: string | null
  badge?: { label: string; tone: BadgeTone }
  href?: string
}

interface Props {
  title: string
  /** Ícone de cada linha */
  icon: IconName
  items: ListItem[]
  emptyText: string
  href: string
  delay?: number
}

// Card do dashboard com título, link "Ver todos" e lista de linhas com selo opcional
export function ListCard({ title, icon, items, emptyText, href, delay = 0 }: Props) {
  return (
    <div className={`${DASHBOARD_CARD_CLASS} flex flex-col h-full`} style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className={DASHBOARD_CARD_TITLE_CLASS} style={{ ...DASHBOARD_CARD_TITLE_STYLE, fontFamily: 'Inter' }}>
          {title}
        </h3>
        <Link href={href} className="text-xs font-semibold hover:underline shrink-0" style={{ color: 'var(--color-brand)' }}>
          Ver todos →
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="text-sm py-6 text-center" style={{ color: 'var(--color-text-muted)' }}>
          {emptyText}
        </p>
      ) : (
        <ul className="divide-y">
          {items.map((item) => {
            const content = (
              <>
                <span className="shrink-0" style={{ color: 'var(--color-sidebar-text)' }}>
                  <Icon name={icon} size={18} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: 'var(--color-text-primary)' }}>
                    {item.title}
                  </p>
                  {item.subtitle && (
                    <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                      {item.subtitle}
                    </p>
                  )}
                </div>
                {item.badge && (
                  <span
                    className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: TONES[item.badge.tone].bg, color: TONES[item.badge.tone].color }}
                  >
                    {item.badge.label}
                  </span>
                )}
              </>
            )
            return (
              <li key={item.key} style={{ borderColor: 'var(--color-bg-surface)' }}>
                {item.href ? (
                  <Link href={item.href} className="flex items-center gap-3 py-3 rounded-lg hover:bg-gray-50 transition-colors">
                    {content}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 py-3">{content}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
