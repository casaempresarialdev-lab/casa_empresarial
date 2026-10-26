import type { CompanyBenefit, EmployeeWithBenefits } from '../queries'
import { Breadcrumb } from '@/components/layout/breadcrumb'

interface Props {
  employee: EmployeeWithBenefits
  benefits: CompanyBenefit[]
}

// Visão somente-leitura do colaborador — mostra só os próprios benefícios,
// sem catálogo nem matriz dos demais funcionários.
export function MeusBeneficios({ employee, benefits }: Props) {
  const empBenefitIds = new Map(employee.employee_benefits.map(b => [b.benefit_id, b.valor_override]))
  const activeBenefits = benefits.filter(b => empBenefitIds.has(b.id))

  return (
    <div>
      <div className="mb-6">
        {/* Título e breadcrumb na mesma linha */}
        <div className="flex-1 min-w-0 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>
            Meus Benefícios
          </h1>
          <Breadcrumb />
        </div>
        <p className="text-sm mt-1 animate-enter" style={{ color: 'var(--color-text-muted)', animationDelay: '60ms' }}>
          Benefícios vinculados ao seu cadastro
        </p>
      </div>

      {activeBenefits.length === 0 ? (
        <div className="app-card p-8 text-center">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Nenhum benefício vinculado ao seu cadastro no momento.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {activeBenefits.map(b => {
            const valor = empBenefitIds.get(b.id) ?? b.valor
            return (
              <div key={b.id} className="app-card p-4">
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{b.nome}</p>
                <p className="text-lg font-bold mt-1" style={{ color: 'var(--color-primary-darker)' }}>
                  {valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  <span className="text-xs font-normal ml-1" style={{ color: 'var(--color-text-muted)' }}>
                    {b.por_dia_trabalhado ? '/dia' : '/mês'}
                  </span>
                </p>
                {b.desconta_salario && (
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Descontado do salário</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
