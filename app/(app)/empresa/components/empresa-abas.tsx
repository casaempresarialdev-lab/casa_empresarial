'use client'

import { useState } from 'react'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { Tabs } from '@/components/ui/form-steps'
import { EmpresaForm } from './empresa-form'
import { EstruturaClient } from '../estrutura/components/estrutura-client'
import type { Company, CompanyBank } from '../queries'
import type { Cargo, Departamento } from '../estrutura/tipos'

interface Props {
  company: Company | null
  banks: CompanyBank[]
  companyId: string | null
  departamentos: Departamento[]
  cargos: Cargo[]
  abaInicial: number
}

// Minha Empresa: dados cadastrais e estrutura. Ao cadastrar uma empresa nova, só os dados.
// As abas ficam montadas, para não perder o que foi digitado ao trocar.
export function EmpresaAbas({ company, banks, companyId, departamentos, cargos, abaInicial }: Props) {
  const [aba, setAba] = useState(abaInicial)
  const comEstrutura = !!company && !!companyId

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>Minha Empresa</h1>
        <Breadcrumb />
      </div>

      {comEstrutura && <Tabs labels={['Dados cadastrais', 'Estrutura']} step={aba} onSelect={setAba} />}

      <div className={aba === 0 || !comEstrutura ? undefined : 'hidden'}>
        <EmpresaForm company={company} banks={banks} />
      </div>
      {comEstrutura && (
        <div className={aba === 1 ? undefined : 'hidden'}>
          <EstruturaClient companyId={companyId} departamentos={departamentos} cargos={cargos} ativa={aba === 1} />
        </div>
      )}
    </div>
  )
}
