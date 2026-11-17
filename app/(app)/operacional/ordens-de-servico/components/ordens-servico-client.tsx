'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { SummaryCard } from '@/components/modules/dashboard/summary-card'
import { AddButton } from '@/components/ui/add-button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FilterResult, FilterSelect, SearchField } from '@/components/ui/filter-select'
import { ListEmpty, ListItem } from '@/components/ui/list-item'
import { toast } from '@/lib/toast'
import { deleteServiceOrderAction, updateServiceOrderStatusAction } from '../actions'
import type { ServiceOrder } from '../queries'
import { ModalOrdemServico } from './modal-ordem-servico'

const STATUS_SELO: Record<string, { texto: string; fundo: string; cor: string }> = {
  aberta: { texto: 'Aberta', fundo: '#DBEAFE', cor: '#1D4ED8' },
  concluida: { texto: 'Concluída', fundo: '#DCFCE7', cor: '#15803D' },
  cancelada: { texto: 'Cancelada', fundo: '#FEE2E2', cor: '#B91C1C' },
}
const FORMA_LABELS: Record<string, string> = {
  dinheiro: 'Dinheiro', pix: 'Pix', credito: 'Crédito', debito: 'Débito', boleto: 'Boleto', outro: 'Outro',
}
const FILTRO_STATUS = [
  { value: 'todos', label: 'Todos' },
  { value: 'aberta', label: 'Aberta' },
  { value: 'concluida', label: 'Concluída' },
  { value: 'cancelada', label: 'Cancelada' },
]

function Selo({ texto, fundo, cor }: { texto: string; fundo: string; cor: string }) {
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap" style={{ backgroundColor: fundo, color: cor }}>{texto}</span>
}
function formatBRL(val: number) {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function formatDate(d: string | null) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

interface Props {
  orders: ServiceOrder[]
  contacts: { id: string; nome: string; tipo: string }[]
  companyId: string
}

// Ordens de serviço — "Concluir" lança o recebimento no Fluxo de Caixa
export function OrdensServicoClient({ orders, contacts, companyId }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingOrder, setEditingOrder] = useState<ServiceOrder | null>(null)
  const [excluir, setExcluir] = useState<ServiceOrder | null>(null)
  const [excluindo, setExcluindo] = useState(false)
  const [concluindoId, setConcluindoId] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('todos')

  const abertas = orders.filter((o) => o.status === 'aberta')
  const concluidas = orders.filter((o) => o.status === 'concluida')
  const totalAberto = abertas.reduce((s, o) => s + o.valor_total, 0)

  const q = busca.trim().toLowerCase()
  const visiveis = orders
    .filter((o) => filtro === 'todos' || o.status === filtro)
    .filter((o) => !q || (o.cliente?.nome ?? '').toLowerCase().includes(q) || String(o.numero).includes(q))

  function abrirNovo() { setEditingOrder(null); setModalOpen(true) }
  function abrirEdicao(o: ServiceOrder) { setEditingOrder(o); setModalOpen(true) }

  async function handleConcluir(o: ServiceOrder) {
    setConcluindoId(o.id)
    const r = await toast.promise(updateServiceOrderStatusAction(o.id, 'concluida'), {
      loading: 'Concluindo…',
      success: `Ordem #${String(o.numero).padStart(3, '0')} concluída — recebimento lançado no caixa.`,
      error: 'Não foi possível concluir a ordem.',
    })
    setConcluindoId(null)
    if (!('error' in r)) router.refresh()
  }

  async function confirmarExclusao() {
    if (!excluir) return
    setExcluindo(true)
    const r = await toast.promise(deleteServiceOrderAction(excluir.id), {
      loading: 'Excluindo…',
      success: `Ordem #${String(excluir.numero).padStart(3, '0')} excluída.`,
      error: 'Não foi possível excluir a ordem.',
    })
    setExcluindo(false)
    setExcluir(null)
    if (!('error' in r)) router.refresh()
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>Ordens de Serviço</h1>
        <Breadcrumb />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <SummaryCard icon="briefcase" title="Abertas" value={abertas.length} caption="em andamento" />
        <SummaryCard icon="check" title="Concluídas" value={concluidas.length} caption="recebimento lançado" delay={60} />
        <SummaryCard icon="dollar" title="Total em abertas" value={formatBRL(totalAberto)} caption="ainda não concluídas" delay={120} />
      </div>

      <div className="app-card p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {orders.length} {orders.length === 1 ? 'ordem' : 'ordens'}
          </p>
          <AddButton onClick={abrirNovo} label="Nova ordem" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SearchField value={busca} onChange={setBusca} placeholder="Pesquisar por cliente ou número..." />
          <FilterSelect value={filtro} onChange={setFiltro} label="Filtrar por status" options={FILTRO_STATUS} />
          {(busca || filtro !== 'todos') && (
            <FilterResult total={visiveis.length} onClear={() => { setBusca(''); setFiltro('todos') }} />
          )}
        </div>

        <ul className="flex flex-col gap-3">
          {visiveis.length === 0 && (
            <ListEmpty>{orders.length === 0 ? 'Crie a primeira ordem de serviço.' : 'Nenhuma ordem encontrada.'}</ListEmpty>
          )}
          {visiveis.map((o) => (
            <ListItem
              key={o.id}
              icon="briefcase"
              title={`Ordem #${String(o.numero).padStart(3, '0')}`}
              subtitle={[o.cliente?.nome ?? 'Sem cliente', formatDate(o.data), o.forma_pagamento && FORMA_LABELS[o.forma_pagamento]].filter(Boolean).join(' · ')}
              aside={
                <>
                  <span className="text-sm font-semibold tabular-nums whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>{formatBRL(o.valor_total)}</span>
                  <Selo {...STATUS_SELO[o.status]} />
                </>
              }
              onClick={() => abrirEdicao(o)}
              actionsLabel={`ordem #${o.numero}`}
              actions={[
                ...(o.status === 'aberta' ? [{ icon: 'check' as const, label: 'Concluir', disabled: concluindoId === o.id, onClick: () => handleConcluir(o) }] : []),
                { icon: 'pencil', label: 'Editar', onClick: () => abrirEdicao(o) },
                { icon: 'trash', label: 'Excluir', tone: 'danger', onClick: () => setExcluir(o) },
              ]}
            />
          ))}
        </ul>
      </div>

      <ModalOrdemServico open={modalOpen} onClose={() => setModalOpen(false)} companyId={companyId} order={editingOrder} contacts={contacts} />

      <ConfirmDialog
        open={!!excluir}
        onClose={() => { if (!excluindo) setExcluir(null) }}
        onConfirm={confirmarExclusao}
        loading={excluindo}
        title="Excluir ordem de serviço"
        confirmLabel="Excluir"
        message={<p>Excluir a ordem <strong>#{excluir ? String(excluir.numero).padStart(3, '0') : ''}</strong>?</p>}
      />
    </>
  )
}
