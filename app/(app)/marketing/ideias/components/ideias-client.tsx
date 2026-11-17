'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { AddButton } from '@/components/ui/add-button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ListEmpty, ListItem } from '@/components/ui/list-item'
import { formatoLabel } from '@/lib/marketing/constantes'
import { toast } from '@/lib/toast'
import { deleteIdeiaMarketingAction, descartarIdeiaMarketingAction, promoverIdeiaMarketingAction } from '../actions'
import type { IdeiaMarketing } from '../queries'
import { ModalIdeia } from './modal-ideia'

function Selo({ texto, fundo, cor }: { texto: string; fundo: string; cor: string }) {
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap" style={{ backgroundColor: fundo, color: cor }}>{texto}</span>
}

const STATUS_SELO: Record<IdeiaMarketing['status'], { texto: string; fundo: string; cor: string }> = {
  ideia: { texto: 'Ideia', fundo: '#DBEAFE', cor: '#1D4ED8' },
  promovida: { texto: 'Promovida a post', fundo: '#DCFCE7', cor: '#15803D' },
  descartada: { texto: 'Descartada', fundo: '#F3F4F6', cor: '#6B7280' },
}

interface Props {
  ideias: IdeiaMarketing[]
  companyId: string
}

// Pautas soltas antes de virarem publicação agendada no Calendário editorial
export function IdeiasClient({ ideias, companyId }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<IdeiaMarketing | null>(null)
  const [excluir, setExcluir] = useState<IdeiaMarketing | null>(null)
  const [excluindo, setExcluindo] = useState(false)
  const [processando, setProcessando] = useState<string | null>(null)

  function abrirNovo() { setEditing(null); setModalOpen(true) }
  function abrirEdicao(i: IdeiaMarketing) { setEditing(i); setModalOpen(true) }

  async function handleDescartar(i: IdeiaMarketing) {
    setProcessando(i.id)
    const r = await toast.promise(descartarIdeiaMarketingAction(i.id), {
      loading: 'Descartando…',
      success: 'Ideia descartada.',
      error: 'Não foi possível descartar.',
    })
    setProcessando(null)
    if (!('error' in r)) router.refresh()
  }

  async function handlePromover(i: IdeiaMarketing) {
    setProcessando(i.id)
    const r = await promoverIdeiaMarketingAction(i.id)
    setProcessando(null)
    if ('error' in r) { toast.error(r.error ?? 'Não foi possível promover a ideia.'); return }
    const params = new URLSearchParams({ prefillTitulo: i.titulo })
    if (i.formato) params.set('prefillFormato', i.formato)
    router.push(`/marketing/calendario?${params.toString()}`)
  }

  async function confirmarExclusao() {
    if (!excluir) return
    setExcluindo(true)
    const r = await toast.promise(deleteIdeiaMarketingAction(excluir.id), {
      loading: 'Excluindo…',
      success: 'Ideia excluída.',
      error: 'Não foi possível excluir.',
    })
    setExcluindo(false)
    setExcluir(null)
    if (!('error' in r)) router.refresh()
  }

  const ordem: Record<IdeiaMarketing['status'], number> = { ideia: 0, promovida: 1, descartada: 2 }
  const ordenadas = [...ideias].sort((a, b) => ordem[a.status] - ordem[b.status])

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>Banco de Ideias</h1>
        <Breadcrumb />
      </div>

      <div className="app-card p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Guarde aqui qualquer pauta solta antes dela virar uma publicação agendada no Calendário editorial.
          </p>
          <AddButton onClick={abrirNovo} label="Nova ideia" />
        </div>

        <ul className="flex flex-col gap-3">
          {ordenadas.length === 0 && <ListEmpty>Nenhuma ideia registrada ainda.</ListEmpty>}
          {ordenadas.map((i) => (
            <ListItem
              key={i.id}
              icon="sparkle"
              title={i.titulo}
              subtitle={[i.formato && formatoLabel(i.formato), i.notas].filter(Boolean).join(' · ')}
              aside={<Selo {...STATUS_SELO[i.status]} />}
              onClick={i.status === 'ideia' ? () => abrirEdicao(i) : undefined}
              actionsLabel={i.titulo}
              actions={i.status === 'ideia' ? [
                { icon: 'calendar', label: 'Transformar em post', disabled: processando === i.id, onClick: () => handlePromover(i) },
                { icon: 'pencil', label: 'Editar', onClick: () => abrirEdicao(i) },
                { icon: 'trash', label: 'Descartar', tone: 'danger', disabled: processando === i.id, onClick: () => handleDescartar(i) },
              ] : [
                { icon: 'trash', label: 'Excluir', tone: 'danger', onClick: () => setExcluir(i) },
              ]}
            />
          ))}
        </ul>
      </div>

      <ModalIdeia open={modalOpen} onClose={() => setModalOpen(false)} companyId={companyId} ideia={editing} />

      <ConfirmDialog
        open={!!excluir}
        onClose={() => { if (!excluindo) setExcluir(null) }}
        onConfirm={confirmarExclusao}
        loading={excluindo}
        title="Excluir ideia"
        confirmLabel="Excluir"
        message={<p>Excluir <strong>{excluir?.titulo}</strong>?</p>}
      />
    </>
  )
}
