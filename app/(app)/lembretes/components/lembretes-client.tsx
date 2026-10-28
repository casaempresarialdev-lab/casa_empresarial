'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { ListItem, ListEmpty } from '@/components/ui/list-item'
import { AddButton } from '@/components/ui/add-button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Icon } from '@/components/ui/icon'
import { toast } from '@/lib/toast'
import { ANTECEDENCIAS } from '@/lib/validations/lembrete'
import { concluirLembreteAction, excluirLembreteAction } from '../actions'
import type { Lembrete } from '../queries'
import { ModalLembrete } from './modal-lembrete'

const dataHoraFormat = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

function quando(l: Lembrete) {
  const s = dataHoraFormat.format(new Date(l.data_hora))
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function avisoTexto(l: Lembrete) {
  if (!l.notificar) return null
  const ant = ANTECEDENCIAS.find((a) => a.value === l.antecedencia_min)?.label ?? `${l.antecedencia_min} min antes`
  return `${ant}${l.notificar_email ? ' · por e-mail' : ''}`
}

interface Props {
  lembretes: Lembrete[]
  abrirNovo: boolean
}

export function LembretesClient({ lembretes, abrirNovo }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(abrirNovo)
  const [editando, setEditando] = useState<Lembrete | null>(null)
  const [excluirTarget, setExcluirTarget] = useState<Lembrete | null>(null)
  const [excluindo, setExcluindo] = useState(false)
  const [verConcluidos, setVerConcluidos] = useState(false)

  const agora = Date.now()
  const pendentes = lembretes.filter((l) => !l.concluido)
  const atrasados = pendentes.filter((l) => new Date(l.data_hora).getTime() < agora)
  const proximos = pendentes.filter((l) => new Date(l.data_hora).getTime() >= agora)
  const concluidos = lembretes.filter((l) => l.concluido).reverse()

  function abrirNovoModal() { setEditando(null); setModalOpen(true) }

  async function alternarConcluido(l: Lembrete) {
    const r = await concluirLembreteAction(l.id, !l.concluido)
    if ('error' in r) { toast.error(r.error ?? 'Não foi possível atualizar.'); return }
    toast(l.concluido ? `"${l.titulo}" voltou para pendentes.` : `"${l.titulo}" concluído.`)
    router.refresh()
  }

  async function confirmarExclusao() {
    const l = excluirTarget
    if (!l) return
    setExcluindo(true)
    const r = await toast.promise(excluirLembreteAction(l.id), {
      loading: 'Excluindo lembrete…',
      success: `"${l.titulo}" excluído.`,
      error: 'Não foi possível excluir o lembrete.',
    })
    setExcluindo(false)
    setExcluirTarget(null)
    if (!('error' in r)) router.refresh()
  }

  const item = (l: Lembrete, tom?: 'atrasado') => {
    const aviso = avisoTexto(l)
    return (
      <ListItem
        key={l.id}
        icon={l.concluido ? 'check' : 'alarm'}
        title={<span className={l.concluido ? 'line-through opacity-60' : ''}>{l.titulo}</span>}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span style={tom === 'atrasado' ? { color: 'var(--color-error)', fontWeight: 600 } : undefined}>{quando(l)}</span>
            {aviso && (
              <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--color-brand)' }}>
                <Icon name="bell" size={12} /> {aviso}
              </span>
            )}
          </span>
        }
        actionsLabel={l.titulo}
        actions={[
          { icon: 'check', label: l.concluido ? 'Reabrir' : 'Concluir', onClick: () => alternarConcluido(l) },
          ...(!l.concluido ? [{ icon: 'pencil' as const, label: 'Editar', onClick: () => { setEditando(l); setModalOpen(true) } }] : []),
          { icon: 'trash', label: 'Excluir', tone: 'danger', onClick: () => setExcluirTarget(l) },
        ]}
      />
    )
  }

  const secao = (titulo: string, lista: Lembrete[], tom?: 'atrasado') => lista.length > 0 && (
    <section className="flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: tom === 'atrasado' ? 'var(--color-error)' : 'var(--color-text-muted)' }}>
        {titulo} ({lista.length})
      </p>
      <ul className="flex flex-col gap-3">{lista.map((l) => item(l, tom))}</ul>
    </section>
  )

  return (
    <>
      <div className="mb-6">
        {/* Título e breadcrumb */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>
            Lembretes
          </h1>
          <Breadcrumb />
        </div>
        <p className="text-sm mt-1 animate-enter" style={{ color: 'var(--color-text-muted)', animationDelay: '60ms' }}>
          Seus lembretes pessoais, com aviso no sistema e por e-mail
        </p>
      </div>

      <div className="app-card p-5 flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold" style={{ color: 'var(--color-sidebar-text)' }}>
            {pendentes.length} {pendentes.length === 1 ? 'lembrete pendente' : 'lembretes pendentes'}
          </p>
          <AddButton onClick={abrirNovoModal} />
        </div>

        {pendentes.length === 0 && <ListEmpty>Nenhum lembrete pendente.</ListEmpty>}
        {secao('Atrasados', atrasados, 'atrasado')}
        {secao('Próximos', proximos)}

        {concluidos.length > 0 && (
          <div className="pt-2 border-t" style={{ borderColor: 'var(--color-bg-surface)' }}>
            <button
              type="button"
              onClick={() => setVerConcluidos((v) => !v)}
              className="text-sm font-medium hover:underline cursor-pointer"
              style={{ color: 'var(--color-brand)' }}
            >
              {verConcluidos ? 'Ocultar concluídos' : `Ver concluídos (${concluidos.length})`}
            </button>
            {verConcluidos && <ul className="flex flex-col gap-3 mt-3">{concluidos.map((l) => item(l))}</ul>}
          </div>
        )}
      </div>

      <ModalLembrete open={modalOpen} onClose={() => setModalOpen(false)} lembrete={editando} />

      <ConfirmDialog
        open={!!excluirTarget}
        onClose={() => { if (!excluindo) setExcluirTarget(null) }}
        onConfirm={confirmarExclusao}
        loading={excluindo}
        title="Excluir lembrete"
        message={<p>Excluir o lembrete <strong>{excluirTarget?.titulo}</strong>?</p>}
      />
    </>
  )
}
