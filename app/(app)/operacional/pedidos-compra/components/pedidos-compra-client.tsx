'use client'

import { useState } from 'react'
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

  function openAdd() { setEditingOrder(null); setModalOpen(true) }
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
        <Button onClick={openAdd}>Adicionar</Button>
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
              const nextStatus = STATUS_FLOW[o.status]
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
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 justify-end">
                      {nextStatus && (
                        <Button
                          variant="ghost"
                          size="sm"
                          loading={advancingId === o.id}
                          onClick={() => handleAdvanceStatus(o)}
                        >
                          {STATUS_NEXT_LABEL[o.status]}
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => openEdit(o)}>Editar</Button>
                      <Button variant="danger" size="sm" loading={deletingId === o.id} onClick={() => handleDelete(o)}>
                        Excluir
                      </Button>
                    </div>
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
