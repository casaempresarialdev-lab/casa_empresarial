'use client'

import { Button } from '@/components/ui/button'
import type { TransactionRow } from '../queries'

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(d: string | null) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function formatDayHeader(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const dow = DIAS_SEMANA[date.getDay()]
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')} · ${dow}`
}

const STATUS_CONFIG = {
  pendente:   { label: 'Pendente',   bg: '#FEF9E7', text: '#D4AC0D' },
  pago:       { label: 'Pago',       bg: '#E9F7EF', text: '#1E8449' },
  cancelado:  { label: 'Cancelado',  bg: '#FDEDEC', text: '#C0392B' },
  conciliado: { label: 'Conciliado', bg: '#EBF5FB', text: '#2471A3' },
}

interface RowProps {
  tx: TransactionRow
  onEdit: (tx: TransactionRow) => void
  onDelete: (tx: TransactionRow) => void
  onTogglePaid: (tx: TransactionRow) => void
  actionId: string | null
}

function GridRow({ tx, onEdit, onDelete, onTogglePaid, actionId }: RowProps) {
  const isRec = tx.tipo === 'recebimento'
  const isPending = tx.status === 'pendente'
  const isBusy = actionId === tx.id
  const s = STATUS_CONFIG[tx.status] ?? STATUS_CONFIG.pendente
  const conta = tx.conta?.banco ?? tx.cartao?.nome ?? null
  const data = tx.data_pagamento ?? tx.data_vencimento ?? tx.data_competencia

  return (
    <tr className="border-t" style={{ borderColor: 'var(--color-bg-surface)' }}>
      {/* Descrição */}
      <td className="px-4 py-2.5">
        <div className="font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>
          {tx.descricao}
          {tx.recorrente && (
            <span className="ml-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              🔄 {tx.parcela_numero && tx.parcela_total ? `${tx.parcela_numero}/${tx.parcela_total}` : '∞'}
            </span>
          )}
        </div>
        <div className="text-xs mt-0.5 flex items-center gap-1 flex-wrap" style={{ color: 'var(--color-text-muted)' }}>
          {tx.categoria && <span>{tx.categoria.icone ?? ''} {tx.categoria.nome}</span>}
          {tx.contato && <span className="opacity-60">· {tx.contato.nome}</span>}
          {tx.centro_custo && <span className="opacity-60">· {tx.centro_custo.nome}</span>}
        </div>
      </td>

      {/* Tipo */}
      <td className="px-3 py-2.5 whitespace-nowrap">
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
          style={{ backgroundColor: isRec ? '#E9F7EF' : '#FDEDEC', color: isRec ? '#1E8449' : '#C0392B' }}
        >
          {isRec ? '📈 Entrada' : '📉 Saída'}
        </span>
      </td>

      {/* Conta / Cartão */}
      <td className="px-3 py-2.5 text-xs whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>
        {conta ?? <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
      </td>

      {/* Data */}
      <td className="px-3 py-2.5 text-xs whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>
        {formatDate(data)}
      </td>

      {/* Valor */}
      <td className="px-3 py-2.5 text-sm font-semibold text-right whitespace-nowrap"
        style={{ color: isRec ? '#1E8449' : '#C0392B' }}>
        {isRec ? '+' : '−'} {formatCurrency(tx.valor)}
      </td>

      {/* Status */}
      <td className="px-3 py-2.5">
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
          style={{ backgroundColor: s.bg, color: s.text }}
        >
          {s.label}
        </span>
      </td>

      {/* Ações */}
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1 justify-end">
          {isPending ? (
            <button
              onClick={() => onTogglePaid(tx)}
              disabled={isBusy}
              className="text-xs px-2 py-1 rounded-lg font-medium transition-colors disabled:opacity-50"
              style={{ backgroundColor: '#E9F7EF', color: '#1E8449' }}
            >
              {isBusy ? '...' : '✓ Pagar'}
            </button>
          ) : tx.status === 'pago' ? (
            <button
              onClick={() => onTogglePaid(tx)}
              disabled={isBusy}
              className="text-xs px-2 py-1 rounded-lg font-medium transition-colors disabled:opacity-50"
              style={{ backgroundColor: '#F2F3F4', color: '#717D7E' }}
            >
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

interface Props {
  transactions: TransactionRow[]
  onEdit: (tx: TransactionRow) => void
  onDelete: (tx: TransactionRow) => void
  onTogglePaid: (tx: TransactionRow) => void
  actionId: string | null
}

export function GridDetalhado({ transactions, onEdit, onDelete, onTogglePaid, actionId }: Props) {
  // Agrupar por data (vencimento ou competência)
  const grouped: Record<string, TransactionRow[]> = {}
  for (const tx of transactions) {
    const date = tx.data_vencimento ?? tx.data_competencia
    if (!grouped[date]) grouped[date] = []
    grouped[date].push(tx)
  }
  const days = Object.keys(grouped).sort()

  if (transactions.length === 0) {
    return (
      <div
        className="rounded-xl border flex flex-col items-center justify-center py-16 gap-2"
        style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white', color: 'var(--color-text-muted)' }}
      >
        <p className="text-sm">Nenhum lançamento neste período.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead style={{ backgroundColor: 'var(--color-bg-surface)' }}>
            <tr>
              <th className="text-left px-4 py-2 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Descrição</th>
              <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Tipo</th>
              <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Conta / Cartão</th>
              <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Data</th>
              <th className="text-right px-3 py-2 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Valor</th>
              <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {days.map(date => {
              const txs = grouped[date]
              const entradas = txs.filter(t => t.tipo === 'recebimento').reduce((s, t) => s + t.valor, 0)
              const saidas  = txs.filter(t => t.tipo === 'pagamento').reduce((s, t) => s + t.valor, 0)

              return (
                <>
                  {/* Cabeçalho do dia */}
                  <tr key={`d-${date}`} style={{ backgroundColor: 'var(--color-bg-surface)' }}>
                    <td colSpan={7} className="px-4 py-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                          {formatDayHeader(date)}
                        </span>
                        <div className="flex items-center gap-3 text-xs">
                          {entradas > 0 && (
                            <span style={{ color: '#1E8449' }}>+ {formatCurrency(entradas)}</span>
                          )}
                          {saidas > 0 && (
                            <span style={{ color: '#C0392B' }}>− {formatCurrency(saidas)}</span>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>

                  {/* Linhas de transação */}
                  {txs.map(tx => (
                    <GridRow
                      key={tx.id}
                      tx={tx}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onTogglePaid={onTogglePaid}
                      actionId={actionId}
                    />
                  ))}
                </>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
