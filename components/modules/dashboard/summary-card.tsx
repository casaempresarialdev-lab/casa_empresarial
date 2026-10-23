import Link from 'next/link'
import { Icon, type IconName } from '@/components/ui/icon'

interface Props {
  icon: IconName
  title: string
  value: string | number
  caption: string
  href: string
  linkLabel: string
  accent?: 'red' | 'yellow'
  /** Atraso da animação de entrada, em ms */
  delay?: number
}

const accentColor = {
  red:    '#B91C1C',
  yellow: '#D97706',
}

// Visual base dos cards do dashboard (borda, sombra e hover que sobe)
export const DASHBOARD_CARD_CLASS =
  'animate-enter bg-white rounded-2xl border p-5 shadow-[0_4px_16px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.06)] transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_14px_32px_rgba(0,0,0,0.14),0_4px_8px_rgba(0,0,0,0.06)] border-[var(--color-card-border)] hover:border-[var(--color-card-border-hover)]'

// Título padrão das caixas do dashboard
export const DASHBOARD_CARD_TITLE_CLASS = 'text-sm font-medium'
export const DASHBOARD_CARD_TITLE_STYLE = { color: 'var(--color-sidebar-text)' }

export function SummaryCard({ icon, title, value, caption, href, linkLabel, accent, delay = 0 }: Props) {
  return (
    <Link
      href={href}
      style={{ animationDelay: `${delay}ms` }}
      className={`${DASHBOARD_CARD_CLASS} group flex flex-col`}
    >
      <p className={DASHBOARD_CARD_TITLE_CLASS} style={DASHBOARD_CARD_TITLE_STYLE}>
        {title}
      </p>

      <p
        className="text-3xl font-extrabold mt-3 truncate"
        style={{ fontFamily: 'Manrope', color: accent ? accentColor[accent] : 'var(--color-text-primary)' }}
      >
        {value}
      </p>
      <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
        {caption}
      </p>

      <div className="flex items-end justify-between gap-3 mt-auto pt-5">
        <span className="text-xs font-semibold group-hover:underline" style={{ color: 'var(--color-brand)' }}>
          {linkLabel} →
        </span>
        <span
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}
        >
          <Icon name={icon} size={20} />
        </span>
      </div>
    </Link>
  )
}
