import Link from 'next/link'
import { Icon, type IconName } from '@/components/ui/icon'
import { DASHBOARD_CARD_CLASS, DASHBOARD_CARD_TITLE_CLASS, DASHBOARD_CARD_TITLE_STYLE } from './summary-card'

// Card de indicador dos dashboards das áreas: ícone e seta no topo, rótulo e valor; leva à tela correspondente
export function IndicadorCard({ icon, titulo, valor, detalhe, tom, href, delay }: {
  icon: IconName; titulo: string; valor: string | number; detalhe?: string
  tom?: 'atencao' | 'ok'; href: string; delay: number
}) {
  const cor = tom === 'atencao' ? '#B45309' : tom === 'ok' ? '#15803D' : 'var(--color-text-primary)'
  return (
    <Link href={href} className={`${DASHBOARD_CARD_CLASS} group flex flex-col`} style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-start justify-between gap-3">
        <span style={{ color: 'var(--color-brand)' }}><Icon name={icon} size={22} /></span>
        <span className="transition-transform group-hover:translate-x-0.5" style={{ color: 'var(--color-sidebar-text)' }}>
          <Icon name="chevron-right" size={16} />
        </span>
      </div>
      <p className={`${DASHBOARD_CARD_TITLE_CLASS} mt-4`} style={DASHBOARD_CARD_TITLE_STYLE}>{titulo}</p>
      <p className="text-2xl font-extrabold mt-1 truncate" style={{ fontFamily: 'Manrope', color: cor }}>{valor}</p>
      {detalhe && <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-muted)' }}>{detalhe}</p>}
    </Link>
  )
}
