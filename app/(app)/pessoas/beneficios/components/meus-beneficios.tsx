import type { CompanyBenefit, EmployeeWithBenefits } from '../queries'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { Icon } from '@/components/ui/icon'
import { descontoMensal } from '@/lib/beneficios-calculo'

interface Props {
  employee: EmployeeWithBenefits
  benefits: CompanyBenefit[]
}

const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// Visão somente-leitura do colaborador: só os próprios benefícios, sem catálogo nem os demais funcionários
export function MeusBeneficios({ employee, benefits }: Props) {
  const vinculos = new Map(employee.employee_benefits.map((b) => [b.benefit_id, b.valor_override]))
  const meus = benefits.filter((b) => vinculos.has(b.id))

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>Meus Benefícios</h1>
        <Breadcrumb />
      </div>

      <div className="app-card p-5 flex flex-col gap-4">
        <p className="text-sm font-semibold" style={{ color: 'var(--color-sidebar-text)' }}>
          {meus.length === 0 ? 'Nenhum benefício vinculado ao seu cadastro' : `${meus.length} ${meus.length === 1 ? 'benefício' : 'benefícios'}`}
        </p>
        {meus.length > 0 && (
          <ul className="flex flex-col gap-3">
            {meus.map((b) => {
              const desconto = descontoMensal(b, vinculos.get(b.id), employee.salario)
              return (
              <li key={b.id} className="flex items-center gap-3 rounded-xl border px-4 py-3" style={{ borderColor: 'var(--color-card-border)' }}>
                <span className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}>
                  <Icon name="wallet" size={18} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>{b.nome}</span>
                  {desconto > 0 && <span className="block text-xs" style={{ color: 'var(--color-text-muted)' }}>Desconto de {moeda(desconto)} por mês</span>}
                </span>
                <span className="text-sm font-bold whitespace-nowrap" style={{ color: 'var(--color-brand)' }}>
                  {moeda(vinculos.get(b.id) ?? b.valor)}
                  <span className="text-xs font-normal ml-1" style={{ color: 'var(--color-text-muted)' }}>{b.por_dia_trabalhado ? '/dia' : '/mês'}</span>
                </span>
              </li>
              )
            })}
          </ul>
        )}
      </div>
    </>
  )
}
