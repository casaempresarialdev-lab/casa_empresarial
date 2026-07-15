import Link from 'next/link'

export interface ModuleMetric {
  label: string
  value: string | number
  accent?: 'green' | 'red' | 'yellow'
}

interface Props {
  icon: string
  title: string
  metrics: ModuleMetric[]
  href: string
  linkLabel: string
}

const accentColor = {
  green:  '#15803D',
  red:    '#B91C1C',
  yellow: '#D97706',
}

export function ModuleSection({ icon, title, metrics, href, linkLabel }: Props) {
  return (
    <div className="bg-white rounded-xl border p-5 flex flex-col"
      style={{ borderColor: 'var(--color-bg-surface)' }}>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-base">{icon}</span>
        <p className="text-xs font-bold tracking-wider"
          style={{ color: 'var(--color-text-secondary)', letterSpacing: '0.06em' }}>
          {title}
        </p>
      </div>

      <div className="flex-1 space-y-3">
        {metrics.map((m, i) => (
          <div key={i} className="flex items-center justify-between">
            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{m.label}</span>
            <span className="text-sm font-semibold"
              style={{ color: m.accent ? accentColor[m.accent] : 'var(--color-text-primary)' }}>
              {m.value}
            </span>
          </div>
        ))}
      </div>

      <Link href={href}
        className="mt-5 text-xs font-medium flex items-center gap-1 transition-opacity hover:opacity-70"
        style={{ color: 'var(--color-primary-darker)' }}>
        {linkLabel} →
      </Link>
    </div>
  )
}
