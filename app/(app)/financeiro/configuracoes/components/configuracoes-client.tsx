'use client'

import { useState } from 'react'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { Tabs } from '@/components/ui/form-steps'
import { CentroCustoClient } from '../../centro-de-custo/components/centro-custo-client'
import type { CostCenter } from '../../centro-de-custo/queries'
import { CategoriasClient } from '../../categorias/components/categorias-client'
import type { Category } from '../../categorias/queries'
import { ContasCartoesClient } from '../../contas-cartoes/components/contas-cartoes-client'
import type { BankAccount, CreditCard } from '../../contas-cartoes/queries'

interface Props {
  companyId: string
  costCenters: CostCenter[]
  categories: Category[]
  bankAccounts: BankAccount[]
  creditCards: CreditCard[]
}

const ABAS = ['Centro de Custo', 'Categorias', 'Contas e Cartões']

// Cadastros de apoio do Financeiro, reunidos numa tela só (cada aba reaproveita a tela que já existia)
export function ConfiguracoesClient({ companyId, costCenters, categories, bankAccounts, creditCards }: Props) {
  const [aba, setAba] = useState(0)

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>Configurações</h1>
        <Breadcrumb />
      </div>

      <Tabs labels={ABAS} step={aba} onSelect={setAba} />

      {aba === 0 && <CentroCustoClient costCenters={costCenters} companyId={companyId} embedded />}
      {aba === 1 && <CategoriasClient categories={categories} companyId={companyId} embedded />}
      {aba === 2 && <ContasCartoesClient bankAccounts={bankAccounts} creditCards={creditCards} companyId={companyId} embedded />}
    </>
  )
}
