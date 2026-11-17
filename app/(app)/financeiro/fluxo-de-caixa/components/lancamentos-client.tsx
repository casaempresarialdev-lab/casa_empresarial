'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { SummaryCard } from '@/components/modules/dashboard/summary-card'
import { AddButton } from '@/components/ui/add-button'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FilterResult, FilterSelect, SearchField } from '@/components/ui/filter-select'
import { ListEmpty, ListItem } from '@/components/ui/list-item'
import { Modal } from '@/components/ui/modal'
import { toast } from '@/lib/toast'
import { deleteTransactionAction, markAsPaidAction, markAsPendingAction } from '../actions'
import type { TransactionRow } from '../queries'
import type { Category } from '../../categorias/queries'
import type { Contact } from '../../contatos/queries'
import type { BankAccount, CreditCard } from '../../contas-cartoes/queries'
import type { CostCenter } from '../../centro-de-custo/queries'
import { ModalLancamento } from './modal-lancamento'

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function formatDate(d: string | null) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

const STATUS_SELO: Record<TransactionRow['status'], { texto: string; fundo: string; cor: string }> = {
  pendente: { texto: 'Pendente', fundo: '#FEF3C7', cor: '#B45309' },
  pago: { texto: 'Pago', fundo: '#DCFCE7', cor: '#15803D' },
  cancelado: { texto: 'Cancelado', fundo: '#FEE2E2', cor: '#B91C1C' },
  conciliado: { texto: 'Conciliado', fundo: '#DBEAFE', cor: '#1D4ED8' },
}
function Selo({ texto, fundo, cor }: { texto: string; fundo: string; cor: string }) {
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap" style={{ backgroundColor: fundo, color: cor }}>{texto}</span>
}

const FILTRO_STATUS = [
  { value: 'todos', label: 'Todos' },
  { value: 'pendente', label: 'Pendente' },
  { value: 'pago', label: 'Pago' },
  { value: 'cancelado', label: 'Cancelado' },
]

function DeleteSerieDialog({ open, onClose, onConfirm, loading }: {
  open: boolean; onClose: () => void; onConfirm: (mode: 'single' | 'following' | 'all') => void; loading: boolean
}) {
  return (
    <Modal open={open} onClose={onClose} title="Excluir lançamento recorrente" description="Este lançamento faz parte de uma série. O que deseja excluir?">
      <div className="flex flex-col gap-2">
        <Button type="button" variant="secondary" className="w-full justify-start" loading={loading} onClick={() => onConfirm('single')}>Só este lançamento</Button>
        <Button type="button" variant="secondary" className="w-full justify-start" loading={loading} onClick={() => onConfirm('following')}>Este e os seguintes</Button>
        <Button type="button" variant="danger" className="w-full justify-start" loading={loading} onClick={() => onConfirm('all')}>Toda a série</Button>
      </div>
    </Modal>
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

// Todos os lançamentos de um tipo (recebimento ou pagamento), sem filtro de período — o histórico completo
export function LancamentosClient({ transactions, tipo, companyId, categories, contacts, bankAccounts, creditCards, costCenters }: Props) {
  const router = useRouter()
  const isRec = tipo === 'recebimento'

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<TransactionRow | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)
  const [excluirSerie, setExcluirSerie] = useState<TransactionRow | null>(null)
  const [excluirUnico, setExcluirUnico] = useState<TransactionRow | null>(null)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('todos')

  const q = busca.trim().toLowerCase()
  const visiveis = transactions
    .filter((t) => filtro === 'todos' || t.status === filtro)
    .filter((t) => !q || t.descricao.toLowerCase().includes(q) || (t.contato?.nome ?? '').toLowerCase().includes(q) || (t.categoria?.nome ?? '').toLowerCase().includes(q))

  const total = transactions.reduce((s, t) => s + t.valor, 0)
  const feito = transactions.filter((t) => t.status === 'pago').reduce((s, t) => s + t.valor, 0)
  const pendente = transactions.filter((t) => t.status === 'pendente').reduce((s, t) => s + t.valor, 0)

  function handleDelete(tx: TransactionRow) {
    if (tx.recorrente) setExcluirSerie(tx)
    else setExcluirUnico(tx)
  }

  async function confirmarExclusaoUnica() {
    if (!excluirUnico) return
    setActionId(excluirUnico.id)
    const r = await toast.promise(deleteTransactionAction(excluirUnico.id, 'single'), {
      loading: 'Excluindo…', success: 'Lançamento excluído.', error: 'Não foi possível excluir o lançamento.',
    })
    setActionId(null)
    setExcluirUnico(null)
    if (!('error' in r)) router.refresh()
  }

  async function confirmarExclusaoSerie(mode: 'single' | 'following' | 'all') {
    if (!excluirSerie) return
    const tx = excluirSerie
    setActionId(tx.id)
    setExcluirSerie(null)
    const r = await toast.promise(deleteTransactionAction(tx.id, mode), {
      loading: 'Excluindo…',
      success: mode === 'all' ? 'Série excluída.' : mode === 'following' ? 'Lançamentos excluídos.' : 'Lançamento excluído.',
      error: 'Não foi possível excluir.',
    })
    setActionId(null)
    if (!('error' in r)) router.refresh()
  }

  async function handleTogglePaid(tx: TransactionRow) {
    setActionId(tx.id)
    const acao = tx.status === 'pendente' ? markAsPaidAction(tx.id) : markAsPendingAction(tx.id)
    const r = await toast.promise(acao, {
      loading: 'Atualizando…',
      success: tx.status === 'pendente' ? 'Lançamento marcado como pago.' : 'Pagamento desfeito.',
      error: 'Não foi possível atualizar o lançamento.',
    })
    setActionId(null)
    if (!('error' in r)) router.refresh()
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>{isRec ? 'Recebimentos' : 'Pagamentos'}</h1>
        <Breadcrumb />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <SummaryCard icon="dollar" title="Total" value={formatCurrency(total)} caption={`${transactions.length} ${transactions.length === 1 ? 'lançamento' : 'lançamentos'}`} />
        <SummaryCard icon="check" title={isRec ? 'Recebido' : 'Pago'} value={formatCurrency(feito)} caption="já quitado" delay={60} />
        <SummaryCard icon="alarm" title="Pendente" value={formatCurrency(pendente)} caption="ainda em aberto" accent={pendente > 0 ? 'yellow' : undefined} delay={120} />
      </div>

      <div className="app-card p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {visiveis.length} {visiveis.length === 1 ? 'lançamento' : 'lançamentos'}
          </p>
          <AddButton onClick={() => { setEditing(null); setModalOpen(true) }} label={isRec ? 'Novo recebimento' : 'Novo pagamento'} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SearchField value={busca} onChange={setBusca} placeholder="Pesquisar por descrição, contato ou categoria..." />
          <FilterSelect value={filtro} onChange={setFiltro} label="Filtrar por status" options={FILTRO_STATUS} />
          {(busca || filtro !== 'todos') && (
            <FilterResult total={visiveis.length} onClear={() => { setBusca(''); setFiltro('todos') }} />
          )}
        </div>

        <ul className="flex flex-col gap-3">
          {visiveis.length === 0 && (
            <ListEmpty>{transactions.length === 0 ? `Nenhum ${isRec ? 'recebimento' : 'pagamento'} cadastrado.` : 'Nenhum resultado.'}</ListEmpty>
          )}
          {visiveis.map((tx) => {
            const isBusy = actionId === tx.id
            return (
              <ListItem
                key={tx.id}
                icon={isRec ? 'wallet' : 'card'}
                title={
                  <span className="flex items-center gap-1.5">
                    {tx.descricao}
                    {tx.recorrente && <span className="text-xs font-normal" style={{ color: 'var(--color-text-muted)' }}>🔄</span>}
                  </span>
                }
                subtitle={`Competência ${formatDate(tx.data_competencia)}${tx.data_vencimento ? ` · Vencimento ${formatDate(tx.data_vencimento)}` : ''}${tx.categoria ? ` · ${tx.categoria.icone ?? ''} ${tx.categoria.nome}` : ''}${tx.contato ? ` · ${tx.contato.nome}` : ''}`}
                aside={
                  <>
                    <span className="text-sm font-semibold tabular-nums whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>{formatCurrency(tx.valor)}</span>
                    <Selo {...STATUS_SELO[tx.status]} />
                  </>
                }
                onClick={() => { setEditing(tx); setModalOpen(true) }}
                actionsLabel={tx.descricao}
                actions={[
                  ...(tx.status === 'pendente' ? [{ icon: 'check' as const, label: 'Marcar como pago', disabled: isBusy, onClick: () => handleTogglePaid(tx) }] : []),
                  ...(tx.status === 'pago' ? [{ icon: 'logout' as const, label: 'Desfazer pagamento', disabled: isBusy, onClick: () => handleTogglePaid(tx) }] : []),
                  { icon: 'pencil', label: 'Editar', onClick: () => { setEditing(tx); setModalOpen(true) } },
                  { icon: 'trash', label: 'Excluir', tone: 'danger', disabled: isBusy, onClick: () => handleDelete(tx) },
                ]}
              />
            )
          })}
        </ul>
      </div>

      <ModalLancamento
        open={modalOpen} onClose={() => setModalOpen(false)}
        companyId={companyId} transaction={editing} defaultTipo={tipo}
        categories={categories} contacts={contacts}
        bankAccounts={bankAccounts} creditCards={creditCards} costCenters={costCenters}
      />

      <DeleteSerieDialog open={!!excluirSerie} onClose={() => setExcluirSerie(null)} onConfirm={confirmarExclusaoSerie} loading={actionId !== null} />

      <ConfirmDialog
        open={!!excluirUnico}
        onClose={() => { if (!actionId) setExcluirUnico(null) }}
        onConfirm={confirmarExclusaoUnica}
        loading={!!actionId}
        title="Excluir lançamento"
        confirmLabel="Excluir"
        message={<p>Excluir <strong>{excluirUnico?.descricao}</strong>?</p>}
      />
    </>
  )
}
