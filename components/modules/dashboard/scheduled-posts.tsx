import { ListCard, type BadgeTone } from './list-card'
import { daysBetween, formatDate } from './format'

export type ScheduledPost = {
  id: string
  titulo: string
  plataforma: string | null
  data_publicacao: string
  status: string
}

interface Props {
  posts: ScheduledPost[]
  today: string
  delay?: number
}

const PLATAFORMAS: Record<string, string> = {
  instagram: 'Instagram',
  facebook:  'Facebook',
  linkedin:  'LinkedIn',
  youtube:   'YouTube',
  tiktok:    'TikTok',
}

const STATUS_BADGE: Record<string, { label: string; tone: BadgeTone }> = {
  ideia:       { label: 'Ideia',       tone: 'neutral' },
  em_producao: { label: 'Em produção', tone: 'amber' },
  feito:       { label: 'Pronto',      tone: 'green' },
}

function quando(data: string, today: string) {
  const dias = daysBetween(today, data)
  if (dias === 0) return 'hoje'
  if (dias === 1) return 'amanhã'
  return formatDate(data)
}

export function ScheduledPosts({ posts, today, delay }: Props) {
  return (
    <ListCard
      title="Agendamento de postagens"
      icon="camera"
      href="/marketing/calendario"
      emptyText="Nenhuma postagem agendada."
      delay={delay}
      items={posts.map((p) => {
        const plataforma = p.plataforma ? PLATAFORMAS[p.plataforma] ?? p.plataforma : null
        return {
          key: p.id,
          title: plataforma ? `${plataforma} — ${p.titulo}` : p.titulo,
          subtitle: quando(p.data_publicacao, today),
          badge: STATUS_BADGE[p.status],
        }
      })}
    />
  )
}
