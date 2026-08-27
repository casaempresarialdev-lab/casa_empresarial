import type { CompanyBenefit, EmployeeWithBenefits } from '../queries'

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
        <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
          Meus Benefícios
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Benefícios vinculados ao seu cadastro
        </p>
      </div>

      {activeBenefits.length === 0 ? (
        <div className="rounded-xl border p-8 text-center" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Nenhum benefício vinculado ao seu cadastro no momento.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {activeBenefits.map(b => {
            const valor = empBenefitIds.get(b.id) ?? b.valor
            return (
              <div key={b.id} className="rounded-xl border p-4" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
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
