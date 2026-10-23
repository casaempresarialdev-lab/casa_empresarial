import { ListCard, type BadgeTone } from './list-card'

export type EmployeeRow = {
  id: string
  nome: string
  cargo: string | null
  status: string
  convitePendente: boolean
}

interface Props {
  employees: EmployeeRow[]
  delay?: number
}

const STATUS_BADGE: Record<string, { label: string; tone: BadgeTone }> = {
  ativo:       { label: 'Ativo',       tone: 'green' },
  admissao:    { label: 'Em admissão', tone: 'amber' },
  experiencia: { label: 'Experiência', tone: 'amber' },
  ferias:      { label: 'Férias',      tone: 'blue' },
  afastado:    { label: 'Afastado',    tone: 'neutral' },
}

export function EmployeesList({ employees, delay }: Props) {
  return (
    <ListCard
      title="Funcionários"
      icon="users"
      href="/pessoas/funcionarios"
      emptyText="Nenhum funcionário cadastrado."
      delay={delay}
      items={employees.map((e) => ({
        key: e.id,
        title: e.nome,
        subtitle: e.cargo || 'Sem cargo definido',
        // Convite de acesso pendente tem prioridade sobre o status do cadastro
        badge: e.convitePendente
          ? { label: 'Convite pendente', tone: 'red' }
          : STATUS_BADGE[e.status] ?? STATUS_BADGE.afastado,
        href: `/pessoas/funcionarios/${e.id}`,
      }))}
    />
  )
}
