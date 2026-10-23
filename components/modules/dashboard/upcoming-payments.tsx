import { ListCard, type BadgeTone } from './list-card'
import { formatCurrency, formatDate } from './format'

export type UpcomingPayment = {
  id: string
  descricao: string
  valor: number
  data_vencimento: string | null
  contato: string | null
}

interface Props {
  payments: UpcomingPayment[]
  /** Data de hoje (yyyy-mm-dd) para classificar vencidos */
  today: string
  delay?: number
}

function badge(venc: string | null, today: string): { label: string; tone: BadgeTone } {
  if (!venc)          return { label: 'Pendente',   tone: 'neutral' }
  if (venc < today)   return { label: 'Vencido',    tone: 'red' }
  if (venc === today) return { label: 'Vence hoje', tone: 'amber' }
  return { label: 'A vencer', tone: 'brand' }
}

export function UpcomingPayments({ payments, today, delay }: Props) {
  return (
    <ListCard
      title="Pagamentos a vencer"
      icon="card"
      href="/financeiro/fluxo-de-caixa/pagamentos"
      emptyText="Nenhum pagamento pendente. 🎉"
      delay={delay}
      items={payments.map((p) => ({
        key: p.id,
        title: p.descricao,
        subtitle: [
          formatCurrency(p.valor),
          p.data_vencimento && `vence ${formatDate(p.data_vencimento)}`,
          p.contato,
        ].filter(Boolean).join(' · '),
        badge: badge(p.data_vencimento, today),
      }))}
    />
  )
}
