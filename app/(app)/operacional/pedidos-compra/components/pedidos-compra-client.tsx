'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ModalPedidoCompra } from './modal-pedido-compra'
import { deletePurchaseOrderAction, updatePurchaseOrderStatusAction } from '../actions'
import type { PurchaseOrder } from '../queries'

interface Props {
  orders: PurchaseOrder[]
  contacts: { id: string; nome: string; tipo: string }[]
  products: { id: string; nome: string; preco_custo: number | null; preco_venda: number | null; unidade_medida: string }[]
  companyId: string
}

const STATUS_FLOW: Record<string, string> = {
  rascunho: 'enviado',
  enviado: 'confirmado',
  confirmado: 'recebido',
}

const STATUS_LABELS: Record<string, string> = {
  rascunho: 'Rascunho',
  enviado: 'Enviado',
  confirmado: 'Confirmado',
  recebido: 'Recebido',
  cancelado: 'Cancelado',
}

const STATUS_NEXT_LABEL: Record<string, string> = {
  rascunho: 'Enviar',
  enviado: 'Confirmar',
  confirmado: 'Marcar recebido',
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  rascunho:   { bg: '#F2F3F4', text: '#717D7E' },
  enviado:    { bg: '#EBF5FB', text: '#2471A3' },
  confirmado: { bg: '#FEF9E7', text: '#D4AC0D' },
  recebido:   { bg: '#E9F7EF', text: '#1E8449' },
  cancelado:  { bg: '#FDEDEC', text: '#C0392B' },
}

function formatBRL(val: number) {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(d: string | null) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function RowMenu({
  order,
  onEdit,
  onAdvance,
  onDelete,
  onView,
  advancingId,
  deletingId,
}: {
  order: PurchaseOrder
  onEdit: () => void
  onAdvance: () => void
  onDelete: () => void
  onView: () => void
  advancingId: string | null
  deletingId: string | null
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const nextStatus = STATUS_FLOW[order.status]

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      const t = e.target as Node
      if (!btnRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  function toggle() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + window.scrollY + 4, right: window.innerWidth - rect.right })
    }
    setOpen(v => !v)
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
        style={{ color: 'var(--color-text-muted)' }}
        title="Opções"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="3" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="8" cy="13" r="1.5" />
        </svg>
      </button>
      {open && (
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: pos.top,
            right: pos.right,
            zIndex: 9999,
            backgroundColor: 'white',
            border: '1px solid var(--color-bg-surface)',
            borderRadius: '8px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            minWidth: '160px',
            padding: '4px 0',
          }}
        >
          <button
            onClick={() => { setOpen(false); onView() }}
            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Visualizar
          </button>
          {nextStatus && (
            <button
              onClick={() => { setOpen(false); onAdvance() }}
              disabled={advancingId === order.id}
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
              style={{ color: 'var(--color-primary-darker)' }}
            >
              {advancingId === order.id ? 'Aguarde...' : STATUS_NEXT_LABEL[order.status]}
            </button>
          )}
          <button
            onClick={() => { setOpen(false); onEdit() }}
            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Editar
          </button>
          <button
            onClick={() => { setOpen(false); onDelete() }}
            disabled={deletingId === order.id}
            className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 transition-colors"
            style={{ color: '#C0392B' }}
          >
            {deletingId === order.id ? 'Excluindo...' : 'Excluir'}
          </button>
        </div>
      )}
    </>
  )
}

export function PedidosCompraClient({ orders, contacts, products, companyId }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [advancingId, setAdvancingId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState('')

  const filtered = filterStatus ? orders.filter(o => o.status === filterStatus) : orders

  const counts = {
    rascunho: orders.filter(o => o.status === 'rascunho').length,
    enviado: orders.filter(o => o.status === 'enviado').length,
    confirmado: orders.filter(o => o.status === 'confirmado').length,
    recebido: orders.filter(o => o.status === 'recebido').length,
    cancelado: orders.filter(o => o.status === 'cancelado').length,
  }

  function openEdit(o: PurchaseOrder) { setEditingOrder(o); setModalOpen(true) }

  async function handleAdvanceStatus(o: PurchaseOrder) {
    const next = STATUS_FLOW[o.status]
    if (!next) return
    setAdvancingId(o.id)
    await updatePurchaseOrderStatusAction(o.id, next)
    setAdvancingId(null)
    router.refresh()
  }

  async function handleDelete(o: PurchaseOrder) {
    if (!confirm(`Excluir pedido #${String(o.numero).padStart(3, '0')}?`)) return
    setDeletingId(o.id)
    const result = await deletePurchaseOrderAction(o.id)
    setDeletingId(null)
    if ('error' in result) alert(result.error)
    else router.refresh()
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
            Pedidos de Compra
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Compras e reposição de estoque
          </p>
        </div>
        <Button onClick={() => router.push('/operacional/pedidos-compra/novo')}>Adicionar</Button>
      </div>

      {/* Cards de status — clicáveis para filtrar */}
      <div className="grid grid-cols-5 gap-2 mb-4">
        {(['rascunho', 'enviado', 'confirmado', 'recebido', 'cancelado'] as const).map(s => {
          const colors = STATUS_COLORS[s]
          const isActive = filterStatus === s
          return (
            <button
              key={s}
              onClick={() => setFilterStatus(isActive ? '' : s)}
              className="p-2 rounded-xl border text-center transition-all"
              style={{
                borderColor: isActive ? colors.text : 'var(--color-bg-surface)',
                backgroundColor: isActive ? colors.bg : 'white',
              }}
            >
              <div className="text-xl font-bold" style={{ color: colors.text }}>{counts[s]}</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{STATUS_LABELS[s]}</div>
            </button>
          )
        })}
      </div>

      <div className="rounded-xl border overflow-x-auto" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
        <table className="w-full min-w-[750px] text-sm">
          <thead style={{ backgroundColor: 'var(--color-bg-surface)' }}>
            <tr>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Nº</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Fornecedor</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Data</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Entrega</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Itens</th>
              <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Total</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-10" style={{ color: 'var(--color-text-muted)' }}>
                  {filterStatus ? `Nenhum pedido com status "${STATUS_LABELS[filterStatus]}".` : 'Nenhum pedido de compra cadastrado.'}
                </td>
              </tr>
            )}
            {filtered.map(o => {
              const colors = STATUS_COLORS[o.status]
              return (
                <tr key={o.id} className="border-t" style={{ borderColor: 'var(--color-bg-surface)' }}>
                  <td className="px-4 py-3 font-mono font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    #{String(o.numero).padStart(3, '0')}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>
                    {o.fornecedor?.nome ?? <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>{formatDate(o.data)}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>{formatDate(o.data_entrega)}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>
                    {o.itens.length} {o.itens.length === 1 ? 'item' : 'itens'}
                  </td>
                  <td className="px-4 py-3 text-right font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {formatBRL(o.valor_total)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ backgroundColor: colors.bg, color: colors.text }}
                    >
                      {STATUS_LABELS[o.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <RowMenu
                      order={o}
                      onView={() => router.push(`/operacional/pedidos-compra/${o.id}`)}
                      onEdit={() => openEdit(o)}
                      onAdvance={() => handleAdvanceStatus(o)}
                      onDelete={() => handleDelete(o)}
                      advancingId={advancingId}
                      deletingId={deletingId}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <ModalPedidoCompra
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        companyId={companyId}
        order={editingOrder}
        contacts={contacts}
        products={products}
      />
    </>
  )
}
