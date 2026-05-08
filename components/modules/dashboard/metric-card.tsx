import Link from 'next/link'

interface MetricCardProps {
  title: string
  value: string
  subtitle?: string
  icon: string
  href?: string
  accent?: 'default' | 'green' | 'red' | 'blue'
  empty?: boolean
}

const accents = {
  default: { bg: 'var(--color-primary)', text: 'var(--color-primary-darker)' },
  green:   { bg: '#DCFCE7', text: '#15803D' },
  red:     { bg: '#FEE2E2', text: '#B91C1C' },
  blue:    { bg: '#DBEAFE', text: '#1D4ED8' },
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon,
  href,
  accent = 'default',
  empty,
}: MetricCardProps) {
  const colors = accents[accent]

  const card = (
    <div
      className="bg-white rounded-xl border p-5 flex flex-col gap-3 transition-shadow hover:shadow-sm"
      style={{ borderColor: 'var(--color-bg-surface)' }}
    >
      <div className="flex items-start justify-between">
        <span className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
          {title}
        </span>
        <span
          className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0"
          style={{ backgroundColor: colors.bg, color: colors.text }}
        >
          {icon}
        </span>
      </div>

      <div>
        <p
          className="text-2xl font-bold"
          style={{
            fontFamily: 'Manrope',
            color: empty ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
          }}
        >
          {value}
        </p>
        {subtitle && (
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="block">
        {card}
      </Link>
    )
  }

  return card
}
