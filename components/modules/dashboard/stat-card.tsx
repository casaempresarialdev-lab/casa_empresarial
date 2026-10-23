import Link from 'next/link'
import { DASHBOARD_CARD_CLASS, DASHBOARD_CARD_TITLE_CLASS, DASHBOARD_CARD_TITLE_STYLE } from './summary-card'

interface Props {
  title: string
  value: string | number
  caption: string
  /** Cor da legenda (ex.: variação positiva/negativa) */
  captionTone?: 'positive' | 'negative'
  href: string
  delay?: number
}

const toneColor = {
  positive: '#15803D',
  negative: '#B91C1C',
}

export function StatCard({ title, value, caption, captionTone, href, delay = 0 }: Props) {
  return (
    <Link href={href} className={`${DASHBOARD_CARD_CLASS} flex flex-col`} style={{ animationDelay: `${delay}ms` }}>
      <p className={DASHBOARD_CARD_TITLE_CLASS} style={DASHBOARD_CARD_TITLE_STYLE}>
        {title}
      </p>
      <p className="text-3xl font-extrabold mt-2 truncate" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
        {value}
      </p>
      <p
        className="text-xs mt-3"
        style={{ color: captionTone ? toneColor[captionTone] : 'var(--color-text-muted)', fontWeight: captionTone ? 600 : 400 }}
      >
        {caption}
      </p>
    </Link>
  )
}
