'use client'

import { useRouter } from 'next/navigation'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { SocioForm } from '../../components/socio-form'

interface Props {
  companyId: string
  outrasParticipacoes: number
}

export function NovoSocioPage({ companyId, outrasParticipacoes }: Props) {
  const router = useRouter()

  function backToList() {
    router.push('/admin/quadro-societario')
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={backToList}
        className="flex items-center gap-1.5 text-sm"
        style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        ← Quadro Societário
      </button>

      {/* Título e breadcrumb na mesma linha */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>
          Novo sócio
        </h1>
        <Breadcrumb />
      </div>

      <div className="app-card p-6">
        <SocioForm
          companyId={companyId}
          socio={null}
          outrasParticipacoes={outrasParticipacoes}
          onCancel={backToList}
          onSaved={() => { router.refresh(); backToList() }}
        />
      </div>
    </div>
  )
}
