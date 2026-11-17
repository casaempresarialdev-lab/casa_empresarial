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
import { deletePurchaseOrderAction, updatePurchaseOrderStatusAction } from '../actions'
import type { PurchaseOrder } from '../queries'
import { ModalPedidoCompra } from './modal-pedido-compra'

const STATUS_FLOW: Record<string, string> = { rascunho: 'enviado', enviado: 'confirmado', confirmado: 'recebido' }
const STATUS_NEXT_LABEL: Record<string, string> = { rascunho: 'Enviar', enviado: 'Confirmar', confirmado: 'Marcar recebido' }
const STATUS_SELO: Record<string, { texto: string; fundo: string; cor: string }> = {
  rascunho: { texto: 'Rascunho', fundo: '#F3F4F6', cor: '#6B7280' },
  enviado: { texto: 'Enviado', fundo: '#DBEAFE', cor: '#1D4ED8' },
  confirmado: { texto: 'Confirmado', fundo: '#FEF3C7', cor: '#B45309' },
  recebido: { texto: 'Recebido', fundo: '#DCFCE7', cor: '#15803D' },
  cancelado: { texto: 'Cancelado', fundo: '#FEE2E2', cor: '#B91C1C' },
}
const FILTRO_STATUS = [
  { value: 'todos', label: 'Todos' },
  { value: 'rascunho', label: 'Rascunho' },
  { value: 'enviado', label: 'Enviado' },
  { value: 'confirmado', label: 'Confirmado' },
  { value: 'recebido', label: 'Recebido' },
  { value: 'cancelado', label: 'Cancelado' },
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
  orders: PurchaseOrder[]
  contacts: { id: string; nome: string; tipo: string }[]
  products: { id: string; nome: string; preco_custo: number | null; preco_venda: number | null; unidade_medida: string }[]
  companyId: string
}

// Pedidos de compra a fornecedores — "Recebido" dá entrada no estoque e lança o pagamento no Fluxo de Caixa
export function PedidosCompraClient({ orders, contacts, products, companyId }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null)
  const [excluir, setExcluir] = useState<PurchaseOrder | null>(null)
  const [excluindo, setExcluindo] = useState(false)
  const [avancandoId, setAvancandoId] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('todos')

  const emAberto = orders.filter((o) => ['rascunho', 'enviado', 'confirmado'].includes(o.status))
  const recebidos = orders.filter((o) => o.status === 'recebido')
  const valorEmAberto = emAberto.reduce((s, o) => s + o.valor_total, 0)

  const q = busca.trim().toLowerCase()
  const visiveis = orders
    .filter((o) => filtro === 'todos' || o.status === filtro)
    .filter((o) => !q || (o.fornecedor?.nome ?? '').toLowerCase().includes(q) || String(o.numero).includes(q))

  function abrirNovo() { setEditingOrder(null); setModalOpen(true) }
  function abrirEdicao(o: PurchaseOrder) { setEditingOrder(o); setModalOpen(true) }

  async function handleAvancar(o: PurchaseOrder) {
    const next = STATUS_FLOW[o.status]
    if (!next) return
    setAvancandoId(o.id)
    const r = await toast.promise(updatePurchaseOrderStatusAction(o.id, next), {
      loading: 'Atualizando…',
      success: next === 'recebido' ? `Pedido #${String(o.numero).padStart(3, '0')} recebido — estoque atualizado.` : `Pedido #${String(o.numero).padStart(3, '0')} ${STATUS_NEXT_LABEL[o.status].toLowerCase()}.`,
      error: 'Não foi possível atualizar o pedido.',
    })
    setAvancandoId(null)
    if (!('error' in r)) router.refresh()
  }

  async function confirmarExclusao() {
    if (!excluir) return
    setExcluindo(true)
    const r = await toast.promise(deletePurchaseOrderAction(excluir.id), {
      loading: 'Excluindo…',
      success: `Pedido #${String(excluir.numero).padStart(3, '0')} excluído.`,
      error: 'Não foi possível excluir o pedido.',
    })
    setExcluindo(false)
    setExcluir(null)
    if (!('error' in r)) router.refresh()
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>Pedidos de Compra</h1>
        <Breadcrumb />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <SummaryCard icon="briefcase" title="Em aberto" value={emAberto.length} caption="aguardando recebimento" />
        <SummaryCard icon="check" title="Recebidos" value={recebidos.length} caption="deram entrada no estoque" delay={60} />
        <SummaryCard icon="dollar" title="Valor em aberto" value={formatBRL(valorEmAberto)} caption="pedidos não recebidos" delay={120} />
      </div>

      <div className="app-card p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {orders.length} {orders.length === 1 ? 'pedido' : 'pedidos'}
          </p>
          <AddButton onClick={abrirNovo} label="Novo pedido" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SearchField value={busca} onChange={setBusca} placeholder="Pesquisar por fornecedor ou número..." />
          <FilterSelect value={filtro} onChange={setFiltro} label="Filtrar por status" options={FILTRO_STATUS} />
          {(busca || filtro !== 'todos') && (
            <FilterResult total={visiveis.length} onClear={() => { setBusca(''); setFiltro('todos') }} />
          )}
        </div>

        <ul className="flex flex-col gap-3">
          {visiveis.length === 0 && (
            <ListEmpty>{orders.length === 0 ? 'Crie o primeiro pedido de compra.' : 'Nenhum pedido encontrado.'}</ListEmpty>
          )}
          {visiveis.map((o) => {
            const next = STATUS_FLOW[o.status]
            const isBusy = avancandoId === o.id
            return (
              <ListItem
                key={o.id}
                icon="briefcase"
                title={`Pedido #${String(o.numero).padStart(3, '0')}`}
                subtitle={[o.fornecedor?.nome ?? 'Sem fornecedor', formatDate(o.data), `${o.itens.length} ${o.itens.length === 1 ? 'item' : 'itens'}`].join(' · ')}
                aside={
                  <>
                    <span className="text-sm font-semibold tabular-nums whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>{formatBRL(o.valor_total)}</span>
                    <Selo {...STATUS_SELO[o.status]} />
                  </>
                }
                onClick={() => router.push(`/operacional/pedidos-compra/${o.id}`)}
                actionsLabel={`pedido #${o.numero}`}
                actions={[
                  { icon: 'eye', label: 'Visualizar', onClick: () => router.push(`/operacional/pedidos-compra/${o.id}`) },
                  ...(next ? [{ icon: 'check' as const, label: STATUS_NEXT_LABEL[o.status], disabled: isBusy, onClick: () => handleAvancar(o) }] : []),
                  { icon: 'pencil', label: 'Editar', onClick: () => abrirEdicao(o) },
                  { icon: 'trash', label: 'Excluir', tone: 'danger', onClick: () => setExcluir(o) },
                ]}
              />
            )
          })}
        </ul>
      </div>

      <ModalPedidoCompra open={modalOpen} onClose={() => setModalOpen(false)} companyId={companyId} order={editingOrder} contacts={contacts} products={products} />

      <ConfirmDialog
        open={!!excluir}
        onClose={() => { if (!excluindo) setExcluir(null) }}
        onConfirm={confirmarExclusao}
        loading={excluindo}
        title="Excluir pedido"
        confirmLabel="Excluir"
        message={<p>Excluir o pedido <strong>#{excluir ? String(excluir.numero).padStart(3, '0') : ''}</strong>?</p>}
      />
    </>
  )
}
