'use client'

import { useRouter } from 'next/navigation'
import { FuncionarioFormFields } from '../../../components/funcionario-form-fields'
import type { Employee } from '../../../queries'
import type { CompanyBenefit } from '../../../../beneficios/queries'

interface Props {
  employee: Employee
  companyId: string
  companyBenefits: CompanyBenefit[]
}

export function EditFuncionarioPage({ employee, companyId, companyBenefits }: Props) {
  const router = useRouter()

  function backToView() {
    router.push(`/pessoas/funcionarios/${employee.id}`)
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={backToView}
        className="flex items-center gap-1.5 text-sm"
        style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        ← {employee.nome}
      </button>

      <div>
        <h1 className="text-lg font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
          Editar Funcionário
        </h1>
      </div>

      <div
        className="rounded-xl border p-6"
        style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}
      >
        <FuncionarioFormFields
          companyId={companyId}
          employee={employee}
          companyBenefits={companyBenefits}
          onCancel={backToView}
          onSaved={backToView}
        />
      </div>
    </div>
  )
}
