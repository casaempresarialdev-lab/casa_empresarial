'use client'

import { useRouter } from 'next/navigation'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { toast } from '@/lib/toast'
import { VagaForm } from '../../components/vaga-form'
import { CandidaturasLista } from '../../components/candidaturas-lista'
import { Selo, VAGA_STATUS, linkPublico } from '../../components/vaga-config'
import type { Candidatura, Vaga } from '../../queries'
import type { CompanyBenefit } from '../../../beneficios/queries'

interface Props {
  vaga: Vaga
  candidaturas: Candidatura[]
  companyId: string
  companyBenefits: CompanyBenefit[]
  abrirDados: boolean
}

// Vaga: candidaturas recebidas + abas com os dados da vaga
export function VagaPage({ vaga, candidaturas, companyId, companyBenefits, abrirDados }: Props) {
  const router = useRouter()
  const encerrada = vaga.status === 'encerrada'

  function voltarParaLista() {
    router.push('/pessoas/vagas')
  }

  async function copiar() {
    await navigator.clipboard.writeText(linkPublico(vaga.token))
    toast('Link de candidatura copiado.')
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={voltarParaLista}
        className="flex items-center gap-1.5 text-sm"
        style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        ← Vagas
      </button>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex items-center gap-3 min-w-0 animate-enter">
          <h1 className="text-3xl font-extrabold truncate" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>
            {vaga.titulo}
          </h1>
          <Selo cfg={VAGA_STATUS[vaga.status]} />
        </div>
        <Breadcrumb current={vaga.titulo} />
      </div>

      <div className="app-card p-6">
        {/* Vaga encerrada: só a consulta das candidaturas */}
        {encerrada ? (
          <CandidaturasLista candidaturas={candidaturas} companyId={companyId} encerrada />
        ) : (
          <VagaForm
            companyId={companyId}
            vaga={vaga}
            companyBenefits={companyBenefits}
            abasExtras={[{
              label: `Candidaturas (${candidaturas.length})`,
              content: <CandidaturasLista candidaturas={candidaturas} companyId={companyId} />,
            }]}
            abrirDados={abrirDados}
            acoes={
              <>
                <Button type="button" variant="secondary" onClick={() => window.open(linkPublico(vaga.token), '_blank', 'noopener')}>
                  <Icon name="external" size={16} />
                  Ver página
                </Button>
                <Button type="button" onClick={copiar}>
                  <Icon name="share" size={16} />
                  Copiar link
                </Button>
              </>
            }
            onCancel={voltarParaLista}
            onSaved={() => { router.refresh(); voltarParaLista() }}
          />
        )}
      </div>
    </div>
  )
}
