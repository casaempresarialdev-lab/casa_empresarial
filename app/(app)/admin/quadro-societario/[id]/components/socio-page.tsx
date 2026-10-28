'use client'

import { useRouter } from 'next/navigation'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { SocioForm } from '../../components/socio-form'
import { SocioDocumentos } from '../../components/socio-documentos'
import type { Socio } from '../../queries'

interface Props {
  socio: Socio
  companyId: string
  outrasParticipacoes: number
  /** Entrar direto na aba Documentos (vindo do menu "Documentos" da lista) */
  abrirDocumentos: boolean
}

// Índice da aba Documentos: depois das 3 abas do formulário
const ABA_DOCUMENTOS = 3

export function SocioPage({ socio, companyId, outrasParticipacoes, abrirDocumentos }: Props) {
  const router = useRouter()

  function backToList() {
    router.push('/admin/quadro-societario')
  }

  const iniciais = socio.nome.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()

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
        <div className="flex items-center gap-3 min-w-0 animate-enter">
          <span
            className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center shrink-0 text-sm font-bold"
            style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}
          >
            {socio.foto_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={socio.foto_url} alt={socio.nome} className="w-full h-full object-cover" />
            ) : iniciais}
          </span>
          <div className="min-w-0">
            <h1 className="text-3xl font-extrabold truncate" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>
              {socio.nome}
            </h1>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Editar sócio</p>
          </div>
        </div>
        <Breadcrumb current={socio.nome} />
      </div>

      <div className="app-card p-6">
        <SocioForm
          companyId={companyId}
          socio={socio}
          outrasParticipacoes={outrasParticipacoes}
          initialTab={abrirDocumentos ? ABA_DOCUMENTOS : 0}
          extraTabs={[
            {
              label: 'Documentos',
              content: <SocioDocumentos socioId={socio.id} socioNome={socio.nome} companyId={companyId} />,
            },
          ]}
          onCancel={backToList}
          onSaved={() => { router.refresh(); backToList() }}
        />
      </div>
    </div>
  )
}
