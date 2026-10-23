import { ListCard } from './list-card'
import { formatCurrency } from './format'

export type OpenReceivable = {
  contactId: string
  nome: string
  parcelas: number
  vencidas: number
  total: number
}

interface Props {
  clients: OpenReceivable[]
  delay?: number
}

export function OpenReceivables({ clients, delay }: Props) {
  return (
    <ListCard
      title="Clientes em aberto"
      icon="card"
      href="/financeiro/fluxo-de-caixa/recebimentos"
      emptyText="Nenhum cliente com valores em aberto."
      delay={delay}
      items={clients.map((c) => ({
        key: c.contactId,
        title: c.nome,
        subtitle: [
          `${c.parcelas} ${c.parcelas === 1 ? 'parcela' : 'parcelas'} em aberto`,
          c.vencidas > 0 && `${c.vencidas} ${c.vencidas === 1 ? 'vencida' : 'vencidas'}`,
        ].filter(Boolean).join(' · '),
        // Vermelho se há parcela vencida
        badge: { label: formatCurrency(c.total), tone: c.vencidas > 0 ? 'red' : 'brand' },
        href: `/financeiro/contatos/${c.contactId}`,
      }))}
    />
  )
}
