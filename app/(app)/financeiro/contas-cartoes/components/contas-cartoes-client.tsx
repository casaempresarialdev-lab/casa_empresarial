'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ModalConta } from './modal-conta'
import { ModalCartao } from './modal-cartao'
import { deleteBankAccountAction, deleteCreditCardAction } from '../actions'
import type { BankAccount, CreditCard } from '../queries'

const TIPO_LABELS: Record<string, string> = {
  corrente: 'Corrente',
  poupanca: 'Poupança',
  pagamento: 'Pagamento',
  investimento: 'Investimento',
  caixa: 'Caixa',
}

const BANDEIRA_LABELS: Record<string, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  elo: 'Elo',
  amex: 'Amex',
  hipercard: 'Hipercard',
  outro: 'Outro',
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

interface Props {
  bankAccounts: BankAccount[]
  creditCards: CreditCard[]
  companyId: string
}

export function ContasCartoesClient({ bankAccounts, creditCards, companyId }: Props) {
  const router = useRouter()

  const [contaModalOpen, setContaModalOpen] = useState(false)
  const [editingConta, setEditingConta] = useState<BankAccount | null>(null)

  const [cartaoModalOpen, setCartaoModalOpen] = useState(false)
  const [editingCartao, setEditingCartao] = useState<CreditCard | null>(null)

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState('')

  async function handleDeleteConta(a: BankAccount) {
    if (!confirm(`Excluir a conta "${a.banco}"? Esta ação não pode ser desfeita.`)) return
    setDeletingId(a.id)
    setDeleteError('')
    const result = await deleteBankAccountAction(a.id)
    setDeletingId(null)
    if ('error' in result) setDeleteError(result.error ?? 'Erro ao excluir.')
    else router.refresh()
  }

  async function handleDeleteCartao(c: CreditCard) {
    if (!confirm(`Excluir o cartão "${c.nome}"? Esta ação não pode ser desfeita.`)) return
    setDeletingId(c.id)
    setDeleteError('')
    const result = await deleteCreditCardAction(c.id)
    setDeletingId(null)
    if ('error' in result) setDeleteError(result.error ?? 'Erro ao excluir.')
    else router.refresh()
  }

  const saldoTotal = bankAccounts.filter(a => a.ativo).reduce((s, a) => s + (a.saldo_atual ?? 0), 0)

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
            Contas e Cartões
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Contas bancárias e cartões de crédito da empresa
          </p>
        </div>
      </div>

      {deleteError && (
        <p className="text-sm mb-4 p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>{deleteError}</p>
      )}

      {/* ── Contas Bancárias ── */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>🏦 Contas Bancárias</h2>
            {bankAccounts.length > 0 && (
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
                Saldo total: <span style={{ color: 'var(--color-text-primary)' }}>{formatCurrency(saldoTotal)}</span>
              </span>
            )}
          </div>
          <Button size="sm" onClick={() => { setEditingConta(null); setContaModalOpen(true) }}>Adicionar</Button>
        </div>

        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
          <table className="w-full text-sm">
            <thead style={{ backgroundColor: 'var(--color-bg-surface)' }}>
              <tr>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Banco</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Tipo</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Agência / Conta</th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Saldo Atual</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {bankAccounts.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
                    Nenhuma conta bancária cadastrada.
                  </td>
                </tr>
              )}
              {bankAccounts.map(a => (
                <tr key={a.id} className="border-t" style={{ borderColor: 'var(--color-bg-surface)' }}>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text-primary)' }}>{a.banco}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>
                    {a.tipo ? TIPO_LABELS[a.tipo] ?? a.tipo : '—'}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>
                    {a.agencia && a.numero ? `${a.agencia} / ${a.numero}${a.digito ? `-${a.digito}` : ''}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {formatCurrency(a.saldo_atual ?? 0)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ backgroundColor: a.ativo ? '#E9F7EF' : '#F2F3F4', color: a.ativo ? '#1E8449' : '#717D7E' }}
                    >
                      {a.ativo ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="sm" onClick={() => { setEditingConta(a); setContaModalOpen(true) }}>Editar</Button>
                      <Button variant="danger" size="sm" loading={deletingId === a.id} onClick={() => handleDeleteConta(a)}>Excluir</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Cartões de Crédito ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>💳 Cartões de Crédito</h2>
          <Button size="sm" onClick={() => { setEditingCartao(null); setCartaoModalOpen(true) }}>Adicionar</Button>
        </div>

        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
          <table className="w-full text-sm">
            <thead style={{ backgroundColor: 'var(--color-bg-surface)' }}>
              <tr>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Nome</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Bandeira</th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Limite</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Fechamento / Vencimento</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {creditCards.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
                    Nenhum cartão de crédito cadastrado.
                  </td>
                </tr>
              )}
              {creditCards.map(c => (
                <tr key={c.id} className="border-t" style={{ borderColor: 'var(--color-bg-surface)' }}>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text-primary)' }}>{c.nome}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>
                    {c.bandeira ? BANDEIRA_LABELS[c.bandeira] ?? c.bandeira : '—'}
                  </td>
                  <td className="px-4 py-3 text-right" style={{ color: 'var(--color-text-secondary)' }}>
                    {c.limite ? formatCurrency(c.limite) : '—'}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>
                    {c.dia_fechamento || c.dia_vencimento
                      ? `Dia ${c.dia_fechamento ?? '?'} / Dia ${c.dia_vencimento ?? '?'}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ backgroundColor: c.ativo ? '#E9F7EF' : '#F2F3F4', color: c.ativo ? '#1E8449' : '#717D7E' }}
                    >
                      {c.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="sm" onClick={() => { setEditingCartao(c); setCartaoModalOpen(true) }}>Editar</Button>
                      <Button variant="danger" size="sm" loading={deletingId === c.id} onClick={() => handleDeleteCartao(c)}>Excluir</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ModalConta
        open={contaModalOpen}
        onClose={() => setContaModalOpen(false)}
        companyId={companyId}
        account={editingConta}
      />
      <ModalCartao
        open={cartaoModalOpen}
        onClose={() => setCartaoModalOpen(false)}
        companyId={companyId}
        card={editingCartao}
      />
    </>
  )
}
