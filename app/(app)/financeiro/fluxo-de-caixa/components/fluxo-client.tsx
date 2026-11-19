'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { SummaryCard } from '@/components/modules/dashboard/summary-card'
import { AddButton } from '@/components/ui/add-button'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Tabs } from '@/components/ui/form-steps'
import { Icon } from '@/components/ui/icon'
import { ListEmpty, ListItem } from '@/components/ui/list-item'
import { Modal } from '@/components/ui/modal'
import { toast } from '@/lib/toast'
import { deleteTransactionAction, markAsPaidAction, markAsPendingAction } from '../actions'
import type { TransactionRow } from '../queries'
import type { Category } from '../../categorias/queries'
import type { Contact } from '../../../operacional/contatos/queries'
import type { BankAccount, CreditCard } from '../../contas-cartoes/queries'
import type { CostCenter } from '../../centro-de-custo/queries'
import { GridDetalhado } from './grid-detalhado'
import { ModalLancamento } from './modal-lancamento'

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
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

// Confirmação de exclusão de lançamento recorrente — pergunta o alcance antes de excluir
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

interface SectionProps {
  tipo: 'recebimento' | 'pagamento'
  transactions: TransactionRow[]
  onAdd: (tipo: 'recebimento' | 'pagamento') => void
  onEdit: (tx: TransactionRow) => void
  onDelete: (tx: TransactionRow) => void
  onTogglePaid: (tx: TransactionRow) => void
  actionId: string | null
}
function Secao({ tipo, transactions, onAdd, onEdit, onDelete, onTogglePaid, actionId }: SectionProps) {
  const isRec = tipo === 'recebimento'
  const total = transactions.reduce((s, t) => s + t.valor, 0)
  const feito = transactions.filter((t) => t.status === 'pago').reduce((s, t) => s + t.valor, 0)

  return (
    <div className="app-card p-5 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {transactions.length} {transactions.length === 1 ? 'lançamento' : 'lançamentos'} · {formatCurrency(feito)} de {formatCurrency(total)}
        </p>
        <AddButton onClick={() => onAdd(tipo)} label={isRec ? 'Novo recebimento' : 'Novo pagamento'} />
      </div>
      <ul className="flex flex-col gap-3">
        {transactions.length === 0 && <ListEmpty>Nenhum {isRec ? 'recebimento' : 'pagamento'} neste período.</ListEmpty>}
        {transactions.map((tx) => {
          const isBusy = actionId === tx.id
          return (
            <ListItem
              key={tx.id}
              icon={isRec ? 'wallet' : 'card'}
              title={tx.descricao}
              subtitle={[tx.categoria && `${tx.categoria.icone ?? ''} ${tx.categoria.nome}`, tx.contato?.nome].filter(Boolean).join(' · ') || undefined}
              aside={
                <>
                  <span className="text-sm font-semibold tabular-nums whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>{formatCurrency(tx.valor)}</span>
                  <Selo {...STATUS_SELO[tx.status]} />
                </>
              }
              onClick={() => onEdit(tx)}
              actionsLabel={tx.descricao}
              actions={[
                ...(tx.status === 'pendente' ? [{ icon: 'check' as const, label: 'Marcar como pago', disabled: isBusy, onClick: () => onTogglePaid(tx) }] : []),
                ...(tx.status === 'pago' ? [{ icon: 'logout' as const, label: 'Desfazer pagamento', disabled: isBusy, onClick: () => onTogglePaid(tx) }] : []),
                { icon: 'pencil', label: 'Editar', onClick: () => onEdit(tx) },
                { icon: 'trash', label: 'Excluir', tone: 'danger', disabled: isBusy, onClick: () => onDelete(tx) },
              ]}
            />
          )
        })}
      </ul>
    </div>
  )
}

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

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

// Lançamentos do mês — visão "Detalhado" (dia a dia) ou "Resumo" (recebimentos e pagamentos separados)
export function FluxoClient({ transactions, companyId, mes, ano, categories, contacts, bankAccounts, creditCards, costCenters }: Props) {
  const router = useRouter()

  const [aba, setAba] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<TransactionRow | null>(null)
  const [defaultTipo, setDefaultTipo] = useState<'recebimento' | 'pagamento'>('recebimento')
  const [actionId, setActionId] = useState<string | null>(null)
  const [excluirSerie, setExcluirSerie] = useState<TransactionRow | null>(null)
  const [excluirUnico, setExcluirUnico] = useState<TransactionRow | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('fluxo_view')
    if (stored === '0' || stored === '1') setAba(Number(stored))
  }, [])

  function mudarAba(i: number) {
    setAba(i)
    localStorage.setItem('fluxo_view', String(i))
  }

  const recebimentos = transactions.filter((t) => t.tipo === 'recebimento')
  const pagamentos = transactions.filter((t) => t.tipo === 'pagamento')
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

  function openAdd(tipo: 'recebimento' | 'pagamento') { setEditing(null); setDefaultTipo(tipo); setModalOpen(true) }
  function openEdit(tx: TransactionRow) { setEditing(tx); setDefaultTipo(tx.tipo); setModalOpen(true) }

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
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex flex-1 min-w-0 items-center gap-3">
          <div className="flex-1 min-w-0 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>Fluxo de Caixa</h1>
            <Breadcrumb />
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" style={{ color: 'var(--color-text-secondary)' }} aria-label="Mês anterior">
              <Icon name="chevron-left" size={16} />
            </button>
            <span className="text-sm font-semibold px-2 min-w-[120px] text-center" style={{ color: 'var(--color-text-primary)' }}>{MESES[mes - 1]} {ano}</span>
            <button onClick={() => navigate(1)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" style={{ color: 'var(--color-text-secondary)' }} aria-label="Próximo mês">
              <Icon name="chevron-right" size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <SummaryCard icon="wallet" title="A Receber" value={formatCurrency(totalRec)} caption={`${recebimentos.length} ${recebimentos.length === 1 ? 'lançamento' : 'lançamentos'}`} />
        <SummaryCard icon="card" title="A Pagar" value={formatCurrency(totalPag)} caption={`${pagamentos.length} ${pagamentos.length === 1 ? 'lançamento' : 'lançamentos'}`} delay={60} />
        <SummaryCard icon="dollar" title="Saldo Previsto" value={formatCurrency(saldo)} caption="recebimentos − pagamentos" accent={saldo < 0 ? 'red' : undefined} delay={120} />
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <Tabs labels={['Detalhado', 'Resumo']} step={aba} onSelect={mudarAba} />
      </div>

      {aba === 0 ? (
        <div className="app-card p-5">
          <GridDetalhado transactions={transactions} onEdit={openEdit} onDelete={handleDelete} onTogglePaid={handleTogglePaid} actionId={actionId} />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Secao tipo="recebimento" transactions={recebimentos} onAdd={openAdd} onEdit={openEdit} onDelete={handleDelete} onTogglePaid={handleTogglePaid} actionId={actionId} />
          <Secao tipo="pagamento" transactions={pagamentos} onAdd={openAdd} onEdit={openEdit} onDelete={handleDelete} onTogglePaid={handleTogglePaid} actionId={actionId} />
        </div>
      )}

      <ModalLancamento
        open={modalOpen} onClose={() => setModalOpen(false)} companyId={companyId} transaction={editing} defaultTipo={defaultTipo}
        categories={categories} contacts={contacts} bankAccounts={bankAccounts} creditCards={creditCards} costCenters={costCenters}
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
