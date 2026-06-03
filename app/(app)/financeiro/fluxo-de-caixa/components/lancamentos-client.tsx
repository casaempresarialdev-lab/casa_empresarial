'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ModalLancamento } from './modal-lancamento'
import { markAsPaidAction, markAsPendingAction, deleteTransactionAction } from '../actions'
import type { TransactionRow } from '../queries'
import type { Category } from '../../categorias/queries'
import type { Contact } from '../../contatos/queries'
import type { BankAccount, CreditCard } from '../../contas-cartoes/queries'
import type { CostCenter } from '../../centro-de-custo/queries'

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function formatDate(d: string | null) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

const STATUS_CONFIG = {
  pendente:   { label: 'Pendente',   bg: '#FEF9E7', text: '#D4AC0D' },
  pago:       { label: 'Pago',       bg: '#E9F7EF', text: '#1E8449' },
  cancelado:  { label: 'Cancelado',  bg: '#FDEDEC', text: '#C0392B' },
  conciliado: { label: 'Conciliado', bg: '#EBF5FB', text: '#2471A3' },
}

interface DeleteDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: (mode: 'single' | 'following' | 'all') => void
  loading: boolean
}
function DeleteDialog({ open, onClose, onConfirm, loading }: DeleteDialogProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl sm:rounded-xl shadow-xl p-6 w-full sm:max-w-sm flex flex-col gap-4">
        <h3 className="font-semibold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
          Excluir lançamento recorrente
        </h3>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Este lançamento faz parte de uma série. O que deseja excluir?
        </p>
        <div className="flex flex-col gap-2">
          <Button variant="ghost" className="w-full justify-start" loading={loading} onClick={() => onConfirm('single')}>Só este</Button>
          <Button variant="ghost" className="w-full justify-start" loading={loading} onClick={() => onConfirm('following')}>Este e os seguintes</Button>
          <Button variant="danger" className="w-full justify-start" loading={loading} onClick={() => onConfirm('all')}>Toda a série</Button>
        </div>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
      </div>
    </div>
  )
}

interface Props {
  transactions: TransactionRow[]
  tipo: 'recebimento' | 'pagamento'
  companyId: string
  categories: Category[]
  contacts: Contact[]
  bankAccounts: BankAccount[]
  creditCards: CreditCard[]
  costCenters: CostCenter[]
}

export function LancamentosClient({ transactions, tipo, companyId, categories, contacts, bankAccounts, creditCards, costCenters }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<TransactionRow | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<{ tx: TransactionRow } | null>(null)
  const [search, setSearch] = useState('')
  const [statusFiltro, setStatusFiltro] = useState('todos')

  const isRec = tipo === 'recebimento'
  const q = search.toLowerCase()
  const filtered = transactions.filter(t => {
    const matchStatus = statusFiltro === 'todos' || t.status === statusFiltro
    const matchSearch = t.descricao.toLowerCase().includes(q) ||
      (t.contato?.nome ?? '').toLowerCase().includes(q) ||
      (t.categoria?.nome ?? '').toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  const total = filtered.reduce((s, t) => s + t.valor, 0)
  const pago = filtered.filter(t => t.status === 'pago').reduce((s, t) => s + t.valor, 0)
  const pendente = filtered.filter(t => t.status === 'pendente').reduce((s, t) => s + t.valor, 0)

  function handleDelete(tx: TransactionRow) {
    if (tx.recorrente) { setDeleteDialog({ tx }); return }
    if (!confirm(`Excluir "${tx.descricao}"?`)) return
    setActionId(tx.id)
    startTransition(async () => {
      await deleteTransactionAction(tx.id, 'single')
      setActionId(null)
      router.refresh()
    })
  }

  async function confirmDelete(mode: 'single' | 'following' | 'all') {
    if (!deleteDialog) return
    const { tx } = deleteDialog
    setActionId(tx.id)
    setDeleteDialog(null)
    await deleteTransactionAction(tx.id, mode)
    setActionId(null)
    router.refresh()
  }

  function handleTogglePaid(tx: TransactionRow) {
    setActionId(tx.id)
    startTransition(async () => {
      if (tx.status === 'pendente') await markAsPaidAction(tx.id)
      else if (tx.status === 'pago') await markAsPendingAction(tx.id)
      setActionId(null)
      router.refresh()
    })
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
            {isRec ? 'Recebimentos' : 'Pagamentos'}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Todos os {isRec ? 'recebimentos' : 'pagamentos'} da empresa
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setModalOpen(true) }}>
          + {isRec ? 'Recebimento' : 'Pagamento'}
        </Button>
      </div>

      {/* Métricas rápidas */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Total', value: total, color: 'var(--color-text-primary)' },
          { label: isRec ? 'Recebido' : 'Pago', value: pago, color: '#1E8449' },
          { label: 'Pendente', value: pendente, color: '#D4AC0D' },
        ].map(c => (
          <div key={c.label} className="rounded-xl border p-4" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>{c.label}</p>
            <p className="text-base font-bold" style={{ color: c.color }}>{formatCurrency(c.value)}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-3 mb-4">
        <input type="text" placeholder="Buscar por descrição, contato ou categoria..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 rounded-lg border text-sm"
          style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white', color: 'var(--color-text-primary)' }} />
        <div className="flex gap-1 rounded-lg border p-1" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
          {(['todos', 'pendente', 'pago', 'cancelado'] as const).map(s => (
            <button key={s} onClick={() => setStatusFiltro(s)}
              className="px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors"
              style={{
                backgroundColor: statusFiltro === s ? 'var(--color-primary)' : 'transparent',
                color: statusFiltro === s ? 'var(--color-primary-darker)' : 'var(--color-text-muted)',
              }}>
              {s === 'todos' ? 'Todos' : STATUS_CONFIG[s]?.label ?? s}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border overflow-x-auto" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
        <table className="w-full min-w-[620px] text-sm">
          <thead style={{ backgroundColor: 'var(--color-bg-surface)' }}>
            <tr>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Descrição</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Competência</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Vencimento</th>
              <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Valor</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="text-center py-10" style={{ color: 'var(--color-text-muted)' }}>
                {search || statusFiltro !== 'todos' ? 'Nenhum resultado.' : `Nenhum ${isRec ? 'recebimento' : 'pagamento'} cadastrado.`}
              </td></tr>
            )}
            {filtered.map(tx => {
              const isBusy = actionId === tx.id
              const s = STATUS_CONFIG[tx.status] ?? STATUS_CONFIG.pendente
              return (
                <tr key={tx.id} className="border-t" style={{ borderColor: 'var(--color-bg-surface)' }}>
                  <td className="px-4 py-3">
                    <div className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      {tx.descricao}
                      {tx.recorrente && <span className="ml-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>🔄</span>}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                      {tx.categoria && `${tx.categoria.icone ?? ''} ${tx.categoria.nome}`}
                      {tx.contato && ` · ${tx.contato.nome}`}
                    </div>
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>{formatDate(tx.data_competencia)}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>{formatDate(tx.data_vencimento)}</td>
                  <td className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--color-text-primary)' }}>{formatCurrency(tx.valor)}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ backgroundColor: s.bg, color: s.text }}>{s.label}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      {tx.status === 'pendente' && (
                        <button onClick={() => handleTogglePaid(tx)} disabled={isBusy}
                          className="text-xs px-2 py-1 rounded-lg font-medium disabled:opacity-50"
                          style={{ backgroundColor: '#E9F7EF', color: '#1E8449' }}>
                          {isBusy ? '...' : '✓ Pagar'}
                        </button>
                      )}
                      {tx.status === 'pago' && (
                        <button onClick={() => handleTogglePaid(tx)} disabled={isBusy}
                          className="text-xs px-2 py-1 rounded-lg font-medium disabled:opacity-50"
                          style={{ backgroundColor: '#F2F3F4', color: '#717D7E' }}>
                          {isBusy ? '...' : 'Desfazer'}
                        </button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => { setEditing(tx); setModalOpen(true) }}>Editar</Button>
                      <Button variant="danger" size="sm" loading={isBusy} onClick={() => handleDelete(tx)}>Excluir</Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <ModalLancamento
        open={modalOpen} onClose={() => setModalOpen(false)}
        companyId={companyId} transaction={editing} defaultTipo={tipo}
        categories={categories} contacts={contacts}
        bankAccounts={bankAccounts} creditCards={creditCards} costCenters={costCenters}
      />
      <DeleteDialog open={!!deleteDialog} onClose={() => setDeleteDialog(null)} onConfirm={confirmDelete} loading={actionId !== null} />
    </>
  )
}
