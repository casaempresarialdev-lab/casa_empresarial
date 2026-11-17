'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { AddButton } from '@/components/ui/add-button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ListEmpty, ListItem } from '@/components/ui/list-item'
import { fonteLabel } from '@/lib/marketing/constantes'
import { toast } from '@/lib/toast'
import { deleteDepoimentoAction, toggleDepoimentoDestaqueAction } from '../actions'
import type { Depoimento } from '../queries'
import { ModalDepoimento } from './modal-depoimento'

function fmtDataBr(d: string) {
  const [y, m, day] = d.slice(0, 10).split('-')
  return `${day}/${m}/${y}`
}

interface Props {
  depoimentos: Depoimento[]
  companyId: string
}

export function DepoimentosClient({ depoimentos, companyId }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Depoimento | null>(null)
  const [excluir, setExcluir] = useState<Depoimento | null>(null)
  const [excluindo, setExcluindo] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  function abrirNovo() { setEditing(null); setModalOpen(true) }
  function abrirEdicao(d: Depoimento) { setEditing(d); setModalOpen(true) }

  async function handleToggleDestaque(d: Depoimento) {
    setTogglingId(d.id)
    const r = await toast.promise(toggleDepoimentoDestaqueAction(d.id, !d.destaque), {
      loading: 'Atualizando…',
      success: d.destaque ? 'Destaque removido.' : 'Marcado como destaque.',
      error: 'Não foi possível atualizar.',
    })
    setTogglingId(null)
    if (!('error' in r)) router.refresh()
  }

  async function confirmarExclusao() {
    if (!excluir) return
    setExcluindo(true)
    const r = await toast.promise(deleteDepoimentoAction(excluir.id), {
      loading: 'Excluindo…',
      success: 'Depoimento excluído.',
      error: 'Não foi possível excluir.',
    })
    setExcluindo(false)
    setExcluir(null)
    if (!('error' in r)) router.refresh()
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>Depoimentos e Prova Social</h1>
        <Breadcrumb />
      </div>

      <div className="app-card p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {depoimentos.length} {depoimentos.length === 1 ? 'depoimento registrado' : 'depoimentos registrados'}
          </p>
          <AddButton onClick={abrirNovo} label="Novo depoimento" />
        </div>

        <ul className="flex flex-col gap-3">
          {depoimentos.length === 0 && <ListEmpty>Cole aqui o que um cliente disse (WhatsApp, Instagram, e-mail...).</ListEmpty>}
          {depoimentos.map((d) => (
            <ListItem
              key={d.id}
              icon="star"
              title={d.cliente}
              subtitle={[fonteLabel(d.fonte, d.fonte_outro), d.data && fmtDataBr(d.data), `"${d.texto}"`].filter(Boolean).join(' · ')}
              aside={d.destaque ? <span className="text-xs font-semibold" style={{ color: 'var(--color-brand)' }}>★ Destaque</span> : undefined}
              onClick={() => abrirEdicao(d)}
              actionsLabel={d.cliente}
              actions={[
                { icon: 'star', label: d.destaque ? 'Remover destaque' : 'Marcar como destaque', disabled: togglingId === d.id, onClick: () => handleToggleDestaque(d) },
                { icon: 'pencil', label: 'Editar', onClick: () => abrirEdicao(d) },
                { icon: 'trash', label: 'Excluir', tone: 'danger', onClick: () => setExcluir(d) },
              ]}
            />
          ))}
        </ul>
      </div>

      <ModalDepoimento open={modalOpen} onClose={() => setModalOpen(false)} companyId={companyId} depoimento={editing} />

      <ConfirmDialog
        open={!!excluir}
        onClose={() => { if (!excluindo) setExcluir(null) }}
        onConfirm={confirmarExclusao}
        loading={excluindo}
        title="Excluir depoimento"
        confirmLabel="Excluir"
        message={<p>Excluir o depoimento de <strong>{excluir?.cliente}</strong>?</p>}
      />
    </>
  )
}
