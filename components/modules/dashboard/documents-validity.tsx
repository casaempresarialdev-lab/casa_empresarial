import { ListCard, type BadgeTone } from './list-card'
import { daysBetween, formatDate } from './format'

export type DocumentValidity = {
  id: string
  nome: string
  vencimento: string | null
}

interface Props {
  documents: DocumentValidity[]
  today: string
  delay?: number
}

// Mesmo critério do card "itens pedindo atenção": vencendo = até 30 dias
const VENCENDO_DIAS = 30

function status(venc: string | null, today: string): { badge: { label: string; tone: BadgeTone }; subtitle: string | null } {
  if (!venc) return { badge: { label: 'Válido', tone: 'green' }, subtitle: 'sem vencimento' }
  const dias = daysBetween(today, venc)
  if (dias < 0) return { badge: { label: 'Vencido', tone: 'red' }, subtitle: `venceu em ${formatDate(venc)}` }
  if (dias <= VENCENDO_DIAS) {
    return {
      badge: { label: 'Vencendo', tone: 'red' },
      subtitle: dias === 0 ? 'vence hoje' : dias === 1 ? 'vence amanhã' : `vence em ${dias} dias`,
    }
  }
  return { badge: { label: 'Válido', tone: 'green' }, subtitle: `válido até ${formatDate(venc)}` }
}

export function DocumentsValidity({ documents, today, delay }: Props) {
  return (
    <ListCard
      title="Validade dos documentos"
      icon="folder"
      href="/admin/documentacao"
      emptyText="Nenhum documento cadastrado."
      delay={delay}
      items={documents.map((d) => {
        const s = status(d.vencimento, today)
        return { key: d.id, title: d.nome, subtitle: s.subtitle, badge: s.badge }
      })}
    />
  )
}
