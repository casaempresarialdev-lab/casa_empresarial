'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ModalOrdemServico } from './modal-ordem-servico'
import { deleteServiceOrderAction, updateServiceOrderStatusAction } from '../actions'
import type { ServiceOrder } from '../queries'

interface Props {
  orders: ServiceOrder[]
  contacts: { id: string; nome: string; tipo: string }[]
  companyId: string
}

const STATUS_LABELS: Record<string, string> = {
  aberta: 'Aberta',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  aberta:     { bg: '#EBF5FB', text: '#2471A3' },
  concluida:  { bg: '#E9F7EF', text: '#1E8449' },
  cancelada:  { bg: '#FDEDEC', text: '#C0392B' },
}

const FORMA_LABELS: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  credito: 'Crédito',
  debito: 'Débito',
  boleto: 'Boleto',
  outro: 'Outro',
}

function formatBRL(val: number) {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(d: string | null) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

export function OrdensServicoClient({ orders, contacts, companyId }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingOrder, setEditingOrder] = useState<ServiceOrder | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [advancingId, setAdvancingId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState('')

  const filtered = filterStatus ? orders.filter(o => o.status === filterStatus) : orders

  const statusKeys = ['aberta', 'concluida', 'cancelada'] as const
  const counts = Object.fromEntries(
    statusKeys.map(s => [s, orders.filter(o => o.status === s).length])
  ) as Record<string, number>

  const totalAberto = orders
    .filter(o => o.status === 'aberta')
    .reduce((sum, o) => sum + o.valor_total, 0)

  function openAdd() { setEditingOrder(null); setModalOpen(true) }
  function openEdit(o: ServiceOrder) { setEditingOrder(o); setModalOpen(true) }

  async function handleConcluir(o: ServiceOrder) {
    setAdvancingId(o.id)
    await updateServiceOrderStatusAction(o.id, 'concluida')
    setAdvancingId(null)
    router.refresh()
  }

  async function handleDelete(o: ServiceOrder) {
    if (!confirm(`Excluir ordem de serviço #${String(o.numero).padStart(3, '0')}?`)) return
    setDeletingId(o.id)
    const result = await deleteServiceOrderAction(o.id)
    setDeletingId(null)
    if ('error' in result) alert(result.error)
    else router.refresh()
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
            Ordens de Serviço
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Total em ordens abertas: <span className="font-semibold" style={{ color: 'var(--color-primary-darker)' }}>{formatBRL(totalAberto)}</span>
          </p>
        </div>
        <Button onClick={openAdd}>Adicionar</Button>
      </div>

      {/* Cards de status */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {statusKeys.map(s => {
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
              <div className="text-lg font-bold" style={{ color: colors.text }}>{counts[s]}</div>
              <div className="text-xs mt-0.5 leading-tight" style={{ color: 'var(--color-text-muted)' }}>
                {STATUS_LABELS[s]}
              </div>
            </button>
          )
        })}
      </div>

      <div className="rounded-xl border overflow-x-auto" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
        <table className="w-full min-w-[700px] text-sm">
          <thead style={{ backgroundColor: 'var(--color-bg-surface)' }}>
            <tr>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Nº</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Cliente</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Data</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Pgto</th>
              <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Total</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-10" style={{ color: 'var(--color-text-muted)' }}>
                  {filterStatus ? `Nenhuma ordem com status "${STATUS_LABELS[filterStatus]}".` : 'Nenhuma ordem de serviço cadastrada.'}
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
                    {o.cliente?.nome ?? <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>{formatDate(o.data)}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>
                    {o.forma_pagamento ? FORMA_LABELS[o.forma_pagamento] ?? o.forma_pagamento : '—'}
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
                      {o.status === 'aberta' && (
                        <Button variant="ghost" size="sm" loading={advancingId === o.id} onClick={() => handleConcluir(o)}>
                          Concluir
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

      <ModalOrdemServico
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        companyId={companyId}
        order={editingOrder}
        contacts={contacts}
      />
    </>
  )
}
