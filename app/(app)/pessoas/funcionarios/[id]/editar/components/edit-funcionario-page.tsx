'use client'

import { useRouter } from 'next/navigation'
import { FuncionarioFormFields } from '../../../components/funcionario-form-fields'
import type { Employee } from '../../../queries'
import type { CompanyBenefit } from '../../../../beneficios/queries'
import { Breadcrumb } from '@/components/layout/breadcrumb'

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

      <div className="flex-1 min-w-0">
        {/* Título e breadcrumb na mesma linha */}
        <div className="flex-1 min-w-0 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>
            Editar Funcionário
          </h1>
          <Breadcrumb />
        </div>
      </div>

      <div
        className="app-card p-6"
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
