'use client'

import { useRouter } from 'next/navigation'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { VagaForm } from '../../components/vaga-form'
import type { CargoOpcao } from '../../../../empresa/estrutura/tipos'
import type { CompanyBenefit } from '../../../beneficios/queries'

interface Props {
  companyId: string
  companyBenefits: CompanyBenefit[]
  cargos: CargoOpcao[]
}

export function NovaVagaPage({ companyId, companyBenefits, cargos }: Props) {
  const router = useRouter()

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => router.push('/pessoas/vagas')}
        className="flex items-center gap-1.5 text-sm"
        style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        ← Vagas
      </button>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>
          Nova vaga
        </h1>
        <Breadcrumb />
      </div>

      <div className="app-card p-6">
        <VagaForm
          companyId={companyId}
          vaga={null}
          companyBenefits={companyBenefits}
          cargos={cargos}
          onCancel={() => router.push('/pessoas/vagas')}
          onSaved={(id) => { router.refresh(); router.push(`/pessoas/vagas/${id}`) }}
        />
      </div>
    </div>
  )
}
