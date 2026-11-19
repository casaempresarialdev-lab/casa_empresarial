'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { SummaryCard } from '@/components/modules/dashboard/summary-card'
import { AddButton } from '@/components/ui/add-button'
import { StatusBadge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FilterResult, SearchField } from '@/components/ui/filter-select'
import { Tabs } from '@/components/ui/form-steps'
import { ListEmpty, ListItem } from '@/components/ui/list-item'
import { toast } from '@/lib/toast'
import { deleteBankAccountAction, deleteCreditCardAction } from '../actions'
import type { BankAccount, CreditCard } from '../queries'
import { ModalCartao } from './modal-cartao'
import { ModalConta } from './modal-conta'

const TIPO_LABELS: Record<string, string> = {
  corrente: 'Corrente', poupanca: 'Poupança', pagamento: 'Pagamento', investimento: 'Investimento', caixa: 'Caixa',
}
const BANDEIRA_LABELS: Record<string, string> = {
  visa: 'Visa', mastercard: 'Mastercard', elo: 'Elo', amex: 'Amex', hipercard: 'Hipercard', outro: 'Outro',
}

function fmtCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

interface Props {
  bankAccounts: BankAccount[]
  creditCards: CreditCard[]
  companyId: string
  /** true quando renderizado dentro de uma aba de Configurações — esconde o título/breadcrumb próprio */
  embedded?: boolean
}

type Excluir = { tipo: 'conta'; item: BankAccount } | { tipo: 'cartao'; item: CreditCard } | null

// Contas bancárias e cartões de crédito usados no Fluxo de Caixa e nas Faturas
export function ContasCartoesClient({ bankAccounts, creditCards, companyId, embedded }: Props) {
  const router = useRouter()
  const [aba, setAba] = useState(0)
  const [busca, setBusca] = useState('')

  const [contaModalOpen, setContaModalOpen] = useState(false)
  const [editingConta, setEditingConta] = useState<BankAccount | null>(null)
  const [cartaoModalOpen, setCartaoModalOpen] = useState(false)
  const [editingCartao, setEditingCartao] = useState<CreditCard | null>(null)

  const [excluir, setExcluir] = useState<Excluir>(null)
  const [excluindo, setExcluindo] = useState(false)

  const contasAtivas = bankAccounts.filter((a) => a.ativo)
  const cartoesAtivos = creditCards.filter((c) => c.ativo)
  const saldoTotal = contasAtivas.reduce((s, a) => s + (a.saldo_atual ?? 0), 0)
  const limiteTotal = cartoesAtivos.reduce((s, c) => s + (c.limite ?? 0), 0)

  const q = busca.trim().toLowerCase()
  const contasVisiveis = bankAccounts.filter((a) => !q || a.banco.toLowerCase().includes(q))
  const cartoesVisiveis = creditCards.filter((c) => !q || c.nome.toLowerCase().includes(q))

  async function confirmarExclusao() {
    if (!excluir) return
    setExcluindo(true)
    const nome = excluir.tipo === 'conta' ? excluir.item.banco : excluir.item.nome
    const acao = excluir.tipo === 'conta' ? deleteBankAccountAction(excluir.item.id) : deleteCreditCardAction(excluir.item.id)
    const r = await toast.promise(acao, {
      loading: `Excluindo ${nome}…`,
      success: `${excluir.tipo === 'conta' ? 'Conta' : 'Cartão'} ${nome} excluído.`,
      error: `Não foi possível excluir ${excluir.tipo === 'conta' ? 'a conta' : 'o cartão'}.`,
    })
    setExcluindo(false)
    setExcluir(null)
    if (!('error' in r)) router.refresh()
  }

  return (
    <>
      {!embedded && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>Contas e Cartões</h1>
          <Breadcrumb />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <SummaryCard icon="wallet" title="Saldo em contas" value={fmtCurrency(saldoTotal)} caption={`${contasAtivas.length} ${contasAtivas.length === 1 ? 'conta ativa' : 'contas ativas'}`} />
        <SummaryCard icon="card" title="Cartões de crédito" value={cartoesAtivos.length} caption={`de ${creditCards.length} cadastrados`} delay={60} />
        <SummaryCard icon="dollar" title="Limite total" value={fmtCurrency(limiteTotal)} caption="soma dos cartões ativos" delay={120} />
      </div>

      <Tabs labels={['Contas Bancárias', 'Cartões de Crédito']} step={aba} onSelect={setAba} />

      {/* Contas Bancárias */}
      <div className={aba === 0 ? 'app-card p-5 flex flex-col gap-4' : 'hidden'}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {bankAccounts.length} {bankAccounts.length === 1 ? 'conta cadastrada' : 'contas cadastradas'}
          </p>
          <AddButton onClick={() => { setEditingConta(null); setContaModalOpen(true) }} label="Nova conta" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SearchField value={busca} onChange={setBusca} placeholder="Pesquisar por banco..." />
          {busca && <FilterResult total={contasVisiveis.length} onClear={() => setBusca('')} />}
        </div>

        <ul className="flex flex-col gap-3">
          {contasVisiveis.length === 0 && (
            <ListEmpty>{bankAccounts.length === 0 ? 'Cadastre a primeira conta bancária da empresa.' : 'Nenhuma conta encontrada.'}</ListEmpty>
          )}
          {contasVisiveis.map((a) => (
            <ListItem
              key={a.id}
              icon="wallet"
              title={a.banco}
              subtitle={`${a.tipo ? TIPO_LABELS[a.tipo] ?? a.tipo : 'Sem tipo'}${a.agencia && a.numero ? ` · Ag. ${a.agencia} / Conta ${a.numero}${a.digito ? `-${a.digito}` : ''}` : ''}`}
              aside={
                <>
                  <span className="text-sm font-semibold tabular-nums whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>{fmtCurrency(a.saldo_atual ?? 0)}</span>
                  <StatusBadge status={a.ativo ? 'active' : 'inactive'} />
                </>
              }
              onClick={() => { setEditingConta(a); setContaModalOpen(true) }}
              actionsLabel={a.banco}
              actions={[
                { icon: 'pencil', label: 'Editar', onClick: () => { setEditingConta(a); setContaModalOpen(true) } },
                { icon: 'trash', label: 'Excluir', tone: 'danger', onClick: () => setExcluir({ tipo: 'conta', item: a }) },
              ]}
            />
          ))}
        </ul>
      </div>

      {/* Cartões de Crédito */}
      <div className={aba === 1 ? 'app-card p-5 flex flex-col gap-4' : 'hidden'}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {creditCards.length} {creditCards.length === 1 ? 'cartão cadastrado' : 'cartões cadastrados'}
          </p>
          <AddButton onClick={() => { setEditingCartao(null); setCartaoModalOpen(true) }} label="Novo cartão" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SearchField value={busca} onChange={setBusca} placeholder="Pesquisar por nome do cartão..." />
          {busca && <FilterResult total={cartoesVisiveis.length} onClear={() => setBusca('')} />}
        </div>

        <ul className="flex flex-col gap-3">
          {cartoesVisiveis.length === 0 && (
            <ListEmpty>{creditCards.length === 0 ? 'Cadastre o primeiro cartão de crédito da empresa.' : 'Nenhum cartão encontrado.'}</ListEmpty>
          )}
          {cartoesVisiveis.map((c) => (
            <ListItem
              key={c.id}
              icon="card"
              title={c.nome}
              subtitle={`${c.bandeira ? BANDEIRA_LABELS[c.bandeira] ?? c.bandeira : 'Sem bandeira'}${c.dia_fechamento || c.dia_vencimento ? ` · Fecha dia ${c.dia_fechamento ?? '?'}, vence dia ${c.dia_vencimento ?? '?'}` : ''}`}
              aside={
                <>
                  <span className="text-sm font-semibold tabular-nums whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>{c.limite ? fmtCurrency(c.limite) : '—'}</span>
                  <StatusBadge status={c.ativo ? 'active' : 'inactive'} />
                </>
              }
              onClick={() => { setEditingCartao(c); setCartaoModalOpen(true) }}
              actionsLabel={c.nome}
              actions={[
                { icon: 'pencil', label: 'Editar', onClick: () => { setEditingCartao(c); setCartaoModalOpen(true) } },
                { icon: 'trash', label: 'Excluir', tone: 'danger', onClick: () => setExcluir({ tipo: 'cartao', item: c }) },
              ]}
            />
          ))}
        </ul>
      </div>

      <ModalConta open={contaModalOpen} onClose={() => setContaModalOpen(false)} companyId={companyId} account={editingConta} />
      <ModalCartao open={cartaoModalOpen} onClose={() => setCartaoModalOpen(false)} companyId={companyId} card={editingCartao} />

      <ConfirmDialog
        open={!!excluir}
        onClose={() => { if (!excluindo) setExcluir(null) }}
        onConfirm={confirmarExclusao}
        loading={excluindo}
        title={excluir?.tipo === 'conta' ? 'Excluir conta bancária' : 'Excluir cartão de crédito'}
        confirmLabel="Excluir"
        message={<p>Excluir <strong>{excluir ? (excluir.tipo === 'conta' ? excluir.item.banco : excluir.item.nome) : ''}</strong>? Lançamentos que já usam {excluir?.tipo === 'conta' ? 'esta conta' : 'este cartão'} não são apagados.</p>}
      />
    </>
  )
}
