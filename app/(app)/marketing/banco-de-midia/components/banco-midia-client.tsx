'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { AddButton } from '@/components/ui/add-button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FilterResult, FilterSelect } from '@/components/ui/filter-select'
import { ListEmpty, ListItem } from '@/components/ui/list-item'
import { areaLabel, MIDIA_AREAS } from '@/lib/marketing/constantes'
import { toast } from '@/lib/toast'
import { deleteMediaAssetAction } from '../actions'
import type { MediaAsset } from '../queries'
import { ModalMidia } from './modal-midia'

const FILTRO_AREA = [{ value: 'todas', label: 'Todas as áreas' }, ...MIDIA_AREAS.map((a) => ({ value: a.id, label: a.label }))]

interface Props {
  midias: MediaAsset[]
  companyId: string
}

export function BancoMidiaClient({ midias, companyId }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<MediaAsset | null>(null)
  const [excluir, setExcluir] = useState<MediaAsset | null>(null)
  const [excluindo, setExcluindo] = useState(false)
  const [filtroArea, setFiltroArea] = useState('todas')

  const visiveis = midias.filter((m) => filtroArea === 'todas' || m.area === filtroArea)

  function abrirNovo() { setEditing(null); setModalOpen(true) }
  function abrirEdicao(m: MediaAsset) { setEditing(m); setModalOpen(true) }

  async function confirmarExclusao() {
    if (!excluir) return
    setExcluindo(true)
    const r = await toast.promise(deleteMediaAssetAction(excluir.id), {
      loading: 'Excluindo…',
      success: 'Arquivo excluído.',
      error: 'Não foi possível excluir.',
    })
    setExcluindo(false)
    setExcluir(null)
    if (!('error' in r)) router.refresh()
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>Banco de Mídia</h1>
        <Breadcrumb />
      </div>

      <div className="app-card p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Fotos e vídeos organizados por área, prontos para reusar no conteúdo.
          </p>
          <AddButton onClick={abrirNovo} label="Adicionar mídia" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect value={filtroArea} onChange={setFiltroArea} label="Filtrar por área" options={FILTRO_AREA} />
          {filtroArea !== 'todas' && <FilterResult total={visiveis.length} onClear={() => setFiltroArea('todas')} />}
        </div>

        <ul className="flex flex-col gap-3">
          {visiveis.length === 0 && (
            <ListEmpty>{midias.length === 0 ? 'Nenhum arquivo ainda. Clique em "Adicionar mídia" pra começar a organizar fotos e vídeos.' : 'Nenhum resultado encontrado.'}</ListEmpty>
          )}
          {visiveis.map((m) => (
            <ListItem
              key={m.id}
              media={m.mime_type?.startsWith('image/') ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.url} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
              ) : undefined}
              icon={m.mime_type?.startsWith('image/') ? undefined : 'camera'}
              title={m.nome ?? 'Sem nome'}
              subtitle={[areaLabel(m.area), m.tema].filter(Boolean).join(' · ')}
              onClick={() => abrirEdicao(m)}
              actionsLabel={m.nome ?? 'arquivo'}
              actions={[
                { icon: 'pencil', label: 'Editar', onClick: () => abrirEdicao(m) },
                { icon: 'trash', label: 'Excluir', tone: 'danger', onClick: () => setExcluir(m) },
              ]}
            />
          ))}
        </ul>
      </div>

      <ModalMidia open={modalOpen} onClose={() => setModalOpen(false)} companyId={companyId} midia={editing} />

      <ConfirmDialog
        open={!!excluir}
        onClose={() => { if (!excluindo) setExcluir(null) }}
        onConfirm={confirmarExclusao}
        loading={excluindo}
        title="Excluir arquivo"
        confirmLabel="Excluir"
        message={<p>Excluir <strong>{excluir?.nome}</strong>?</p>}
      />
    </>
  )
}
