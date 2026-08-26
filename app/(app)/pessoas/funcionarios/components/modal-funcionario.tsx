'use client'

import { Modal } from '@/components/ui/modal'
import { FuncionarioFormFields } from './funcionario-form-fields'
import type { Employee } from '../queries'
import type { CompanyBenefit } from '../../beneficios/queries'

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  employee: Employee | null
  companyBenefits: CompanyBenefit[]
}

export function ModalFuncionario({ open, onClose, companyId, employee, companyBenefits }: Props) {
  if (!open) return null

  return (
    <Modal open={open} onClose={onClose} title={employee ? 'Editar Funcionário' : 'Novo Funcionário'}>
      <FuncionarioFormFields
        companyId={companyId}
        employee={employee}
        companyBenefits={companyBenefits}
        onCancel={onClose}
        onSaved={onClose}
      />
    </Modal>
  )
}
