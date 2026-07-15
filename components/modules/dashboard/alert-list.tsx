import Link from 'next/link'

export interface AlertItem {
  icon: string
  text: string
  href: string
  level: 'danger' | 'warning'
}

interface Props {
  alerts: AlertItem[]
}

const levelColor = {
  danger:  '#B91C1C',
  warning: '#D97706',
}

export function AlertList({ alerts }: Props) {
  if (alerts.length === 0) return null

  return (
    <div className="bg-white rounded-xl border overflow-hidden"
      style={{ borderColor: 'var(--color-bg-surface)' }}>
      <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--color-bg-surface)' }}>
        <p className="text-xs font-bold tracking-wider"
          style={{ color: 'var(--color-text-secondary)', letterSpacing: '0.06em' }}>
          ALERTAS
        </p>
      </div>
      <div>
        {alerts.map((a, i) => (
          <Link key={i} href={a.href}
            className="flex items-center gap-3 px-5 py-3 border-b last:border-0 transition-colors hover:bg-gray-50"
            style={{ borderColor: 'var(--color-bg-surface)' }}>
            <span className="text-base flex-shrink-0">{a.icon}</span>
            <span className="text-sm flex-1"
              style={{ color: levelColor[a.level] }}>
              {a.text}
            </span>
            <span className="text-xs flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>→</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
