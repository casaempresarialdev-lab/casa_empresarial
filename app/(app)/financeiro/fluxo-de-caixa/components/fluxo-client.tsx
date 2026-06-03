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

// ── Dialog para excluir recorrente ────────────────────────────

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
          <Button variant="ghost" className="w-full justify-start" loading={loading} onClick={() => onConfirm('single')}>
            Só este lançamento
          </Button>
          <Button variant="ghost" className="w-full justify-start" loading={loading} onClick={() => onConfirm('following')}>
            Este e os seguintes
          </Button>
          <Button variant="danger" className="w-full justify-start" loading={loading} onClick={() => onConfirm('all')}>
            Toda a série
          </Button>
        </div>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
      </div>
    </div>
  )
}

// ── Linha da tabela ───────────────────────────────────────────

interface RowProps {
  tx: TransactionRow
  onEdit: (tx: TransactionRow) => void
  onDelete: (tx: TransactionRow) => void
  onTogglePaid: (tx: TransactionRow) => void
  actionId: string | null
}
function TxRow({ tx, onEdit, onDelete, onTogglePaid, actionId }: RowProps) {
  const isPending = tx.status === 'pendente'
  const isBusy = actionId === tx.id
  const s = STATUS_CONFIG[tx.status] ?? STATUS_CONFIG.pendente

  return (
    <tr className="border-t" style={{ borderColor: 'var(--color-bg-surface)' }}>
      <td className="px-4 py-3">
        <div className="font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>
          {tx.descricao}
          {tx.recorrente && (
            <span className="ml-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              🔄 {tx.parcela_numero && tx.parcela_total ? `${tx.parcela_numero}/${tx.parcela_total}` : '∞'}
            </span>
          )}
        </div>
        <div className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
          {tx.categoria && (
            <span>{tx.categoria.icone ?? ''} {tx.categoria.nome}</span>
          )}
          {tx.contato && (
            <span className="opacity-60">· {tx.contato.nome}</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        {formatDate(tx.data_vencimento ?? tx.data_competencia)}
      </td>
      <td className="px-4 py-3 text-sm font-semibold text-right" style={{ color: 'var(--color-text-primary)' }}>
        {formatCurrency(tx.valor)}
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
          style={{ backgroundColor: s.bg, color: s.text }}>
          {s.label}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 justify-end">
          {isPending ? (
            <button onClick={() => onTogglePaid(tx)} disabled={isBusy}
              className="text-xs px-2 py-1 rounded-lg font-medium transition-colors disabled:opacity-50"
              style={{ backgroundColor: '#E9F7EF', color: '#1E8449' }}>
              {isBusy ? '...' : '✓ Pagar'}
            </button>
          ) : tx.status === 'pago' ? (
            <button onClick={() => onTogglePaid(tx)} disabled={isBusy}
              className="text-xs px-2 py-1 rounded-lg font-medium transition-colors disabled:opacity-50"
              style={{ backgroundColor: '#F2F3F4', color: '#717D7E' }}>
              {isBusy ? '...' : 'Desfazer'}
            </button>
          ) : null}
          <Button variant="ghost" size="sm" onClick={() => onEdit(tx)}>Editar</Button>
          <Button variant="danger" size="sm" loading={isBusy} onClick={() => onDelete(tx)}>Excluir</Button>
        </div>
      </td>
    </tr>
  )
}

// ── Seção (Recebimentos ou Pagamentos) ────────────────────────

interface SectionProps {
  tipo: 'recebimento' | 'pagamento'
  transactions: TransactionRow[]
  onAdd: (tipo: 'recebimento' | 'pagamento') => void
  onEdit: (tx: TransactionRow) => void
  onDelete: (tx: TransactionRow) => void
  onTogglePaid: (tx: TransactionRow) => void
  actionId: string | null
}
function Section({ tipo, transactions, onAdd, onEdit, onDelete, onTogglePaid, actionId }: SectionProps) {
  const isRec = tipo === 'recebimento'
  const total = transactions.reduce((s, t) => s + t.valor, 0)
  const pago = transactions.filter(t => t.status === 'pago').reduce((s, t) => s + t.valor, 0)

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
      <div className="px-4 py-3 flex items-center justify-between border-b"
        style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: isRec ? '#F0FFF4' : '#FFF5F5' }}>
        <div className="flex items-center gap-2">
          <span>{isRec ? '📈' : '📉'}</span>
          <span className="font-semibold text-sm" style={{ color: isRec ? '#1E8449' : '#C0392B' }}>
            {isRec ? 'Recebimentos' : 'Pagamentos'}
          </span>
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            ({transactions.length} lançamentos · {formatCurrency(pago)} de {formatCurrency(total)})
          </span>
        </div>
        <Button size="sm" variant={isRec ? 'primary' : 'danger'} onClick={() => onAdd(tipo)}>
          + {isRec ? 'Recebimento' : 'Pagamento'}
        </Button>
      </div>
      <table className="w-full min-w-[600px] text-sm">
        <thead style={{ backgroundColor: 'var(--color-bg-surface)' }}>
          <tr>
            <th className="text-left px-4 py-2 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Descrição</th>
            <th className="text-left px-4 py-2 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Vencimento</th>
            <th className="text-right px-4 py-2 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Valor</th>
            <th className="text-left px-4 py-2 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Status</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {transactions.length === 0 && (
            <tr><td colSpan={5} className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
              Nenhum {isRec ? 'recebimento' : 'pagamento'} neste período.
            </td></tr>
          )}
          {transactions.map(tx => (
            <TxRow key={tx.id} tx={tx} onEdit={onEdit} onDelete={onDelete} onTogglePaid={onTogglePaid} actionId={actionId} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────

interface Props {
  transactions: TransactionRow[]
  companyId: string
  mes: number
  ano: number
  categories: Category[]
  contacts: Contact[]
  bankAccounts: BankAccount[]
  creditCards: CreditCard[]
  costCenters: CostCenter[]
}

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

export function FluxoClient({ transactions, companyId, mes, ano, categories, contacts, bankAccounts, creditCards, costCenters }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<TransactionRow | null>(null)
  const [defaultTipo, setDefaultTipo] = useState<'recebimento' | 'pagamento'>('recebimento')
  const [actionId, setActionId] = useState<string | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<{ tx: TransactionRow } | null>(null)

  const recebimentos = transactions.filter(t => t.tipo === 'recebimento')
  const pagamentos = transactions.filter(t => t.tipo === 'pagamento')

  const totalRec = recebimentos.reduce((s, t) => s + t.valor, 0)
  const totalPag = pagamentos.reduce((s, t) => s + t.valor, 0)
  const saldo = totalRec - totalPag

  function navigate(delta: number) {
    let m = mes + delta
    let a = ano
    if (m > 12) { m = 1; a++ }
    if (m < 1) { m = 12; a-- }
    router.push(`/financeiro/fluxo-de-caixa?mes=${m}&ano=${a}`)
  }

  function openAdd(tipo: 'recebimento' | 'pagamento') {
    setEditing(null); setDefaultTipo(tipo); setModalOpen(true)
  }
  function openEdit(tx: TransactionRow) {
    setEditing(tx); setDefaultTipo(tx.tipo); setModalOpen(true)
  }

  function handleDelete(tx: TransactionRow) {
    if (tx.recorrente) {
      setDeleteDialog({ tx })
    } else {
      if (!confirm(`Excluir "${tx.descricao}"?`)) return
      setActionId(tx.id)
      startTransition(async () => {
        await deleteTransactionAction(tx.id, 'single')
        setActionId(null)
        router.refresh()
      })
    }
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
      if (tx.status === 'pendente') {
        await markAsPaidAction(tx.id)
      } else if (tx.status === 'pago') {
        await markAsPendingAction(tx.id)
      }
      setActionId(null)
      router.refresh()
    })
  }

  return (
    <>
      {/* Header com navegação de mês */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
            Fluxo de Caixa
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-sm"
            style={{ color: 'var(--color-text-secondary)' }}>
            ◀
          </button>
          <span className="text-sm font-semibold px-2 min-w-[130px] text-center"
            style={{ color: 'var(--color-text-primary)' }}>
            {MESES[mes - 1]} {ano}
          </span>
          <button onClick={() => navigate(1)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-sm"
            style={{ color: 'var(--color-text-secondary)' }}>
            ▶
          </button>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'A Receber', value: totalRec, color: '#1E8449', bg: '#F0FFF4' },
          { label: 'A Pagar', value: totalPag, color: '#C0392B', bg: '#FFF5F5' },
          { label: 'Saldo Previsto', value: saldo, color: saldo >= 0 ? '#1E8449' : '#C0392B', bg: 'white' },
        ].map(c => (
          <div key={c.label} className="rounded-xl border p-4" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: c.bg }}>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>{c.label}</p>
            <p className="text-lg font-bold" style={{ color: c.color }}>{formatCurrency(c.value)}</p>
          </div>
        ))}
      </div>

      {/* Seções */}
      <div className="flex flex-col gap-6 overflow-x-auto">
        <Section tipo="recebimento" transactions={recebimentos} onAdd={openAdd} onEdit={openEdit} onDelete={handleDelete} onTogglePaid={handleTogglePaid} actionId={actionId} />
        <Section tipo="pagamento" transactions={pagamentos} onAdd={openAdd} onEdit={openEdit} onDelete={handleDelete} onTogglePaid={handleTogglePaid} actionId={actionId} />
      </div>

      <ModalLancamento
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        companyId={companyId}
        transaction={editing}
        defaultTipo={defaultTipo}
        categories={categories}
        contacts={contacts}
        bankAccounts={bankAccounts}
        creditCards={creditCards}
        costCenters={costCenters}
      />

      <DeleteDialog
        open={!!deleteDialog}
        onClose={() => setDeleteDialog(null)}
        onConfirm={confirmDelete}
        loading={actionId !== null}
      />
    </>
  )
}
