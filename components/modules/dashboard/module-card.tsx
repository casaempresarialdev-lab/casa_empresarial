import Link from 'next/link'

interface ModuleCardProps {
  icon: string
  title: string
  subtitle: string
  description: string
  href: string
  items?: { label: string; href: string }[]
  badge?: string | number
}

export function ModuleCard({
  icon,
  title,
  subtitle,
  description,
  href,
  items = [],
  badge,
}: ModuleCardProps) {
  return (
    <div
      className="bg-white rounded-xl border overflow-hidden flex flex-col"
      style={{ borderColor: 'var(--color-bg-surface)' }}
    >
      {/* Header */}
      <Link
        href={href}
        className="flex items-center gap-3 p-5 hover:bg-gray-50 transition-colors"
      >
        <span
          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
          style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-darker)' }}
        >
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-sm" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
              {title}
            </p>
            {badge !== undefined && (
              <span
                className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-darker)' }}
              >
                {badge}
              </span>
            )}
          </div>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {subtitle}
          </p>
        </div>
        <span className="text-gray-300 text-sm">›</span>
      </Link>

      {/* Description */}
      <p className="px-5 pb-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {description}
      </p>

      {/* Quick links */}
      {items.length > 0 && (
        <div
          className="border-t px-5 py-3 flex flex-wrap gap-x-4 gap-y-1"
          style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: '#FAFAFA' }}
        >
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-xs hover:underline"
              style={{ color: 'var(--color-primary-dark)' }}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
