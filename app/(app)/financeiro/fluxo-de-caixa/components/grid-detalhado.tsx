'use client'

import { ListEmpty, ListItem } from '@/components/ui/list-item'
import type { TransactionRow } from '../queries'

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function formatDayHeader(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')} · ${DIAS_SEMANA[date.getDay()]}`
}

// Paleta fixa do guia de design: ok=verde, atenção=âmbar, vencido=vermelho, informativo=azul
const STATUS_SELO: Record<TransactionRow['status'], { texto: string; fundo: string; cor: string }> = {
  pendente: { texto: 'Pendente', fundo: '#FEF3C7', cor: '#B45309' },
  pago: { texto: 'Pago', fundo: '#DCFCE7', cor: '#15803D' },
  cancelado: { texto: 'Cancelado', fundo: '#FEE2E2', cor: '#B91C1C' },
  conciliado: { texto: 'Conciliado', fundo: '#DBEAFE', cor: '#1D4ED8' },
}

function Selo({ texto, fundo, cor }: { texto: string; fundo: string; cor: string }) {
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap" style={{ backgroundColor: fundo, color: cor }}>{texto}</span>
}

interface Props {
  transactions: TransactionRow[]
  onEdit: (tx: TransactionRow) => void
  onDelete: (tx: TransactionRow) => void
  onTogglePaid: (tx: TransactionRow) => void
  actionId: string | null
}

// Visão "Detalhado" do Fluxo de Caixa: todos os lançamentos do mês, agrupados por dia de vencimento
export function GridDetalhado({ transactions, onEdit, onDelete, onTogglePaid, actionId }: Props) {
  const grouped: Record<string, TransactionRow[]> = {}
  for (const tx of transactions) {
    const date = tx.data_vencimento ?? tx.data_competencia
    ;(grouped[date] ??= []).push(tx)
  }
  const days = Object.keys(grouped).sort()

  if (transactions.length === 0) {
    return <ul><ListEmpty>Nenhum lançamento neste período.</ListEmpty></ul>
  }

  return (
    <div className="flex flex-col gap-5">
      {days.map((date) => {
        const txs = grouped[date]
        const entradas = txs.filter((t) => t.tipo === 'recebimento').reduce((s, t) => s + t.valor, 0)
        const saidas = txs.filter((t) => t.tipo === 'pagamento').reduce((s, t) => s + t.valor, 0)

        return (
          <div key={date} className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>{formatDayHeader(date)}</span>
              <div className="flex items-center gap-3 text-xs">
                {entradas > 0 && <span style={{ color: '#15803D' }}>+ {formatCurrency(entradas)}</span>}
                {saidas > 0 && <span style={{ color: '#B91C1C' }}>− {formatCurrency(saidas)}</span>}
              </div>
            </div>
            <ul className="flex flex-col gap-3">
              {txs.map((tx) => {
                const isRec = tx.tipo === 'recebimento'
                const isBusy = actionId === tx.id
                const conta = tx.conta?.banco ?? tx.cartao?.nome ?? null
                return (
                  <ListItem
                    key={tx.id}
                    icon={isRec ? 'wallet' : 'card'}
                    title={
                      <span className="flex items-center gap-1.5">
                        {tx.descricao}
                        {tx.recorrente && (
                          <span className="text-xs font-normal" style={{ color: 'var(--color-text-muted)' }}>
                            🔄 {tx.parcela_numero && tx.parcela_total ? `${tx.parcela_numero}/${tx.parcela_total}` : '∞'}
                          </span>
                        )}
                      </span>
                    }
                    subtitle={[
                      tx.categoria && `${tx.categoria.icone ?? ''} ${tx.categoria.nome}`,
                      tx.contato?.nome,
                      tx.centro_custo?.nome,
                      conta,
                    ].filter(Boolean).join(' · ') || undefined}
                    aside={
                      <>
                        <span className="text-sm font-semibold tabular-nums whitespace-nowrap" style={{ color: isRec ? '#15803D' : '#B91C1C' }}>
                          {isRec ? '+ ' : '− '}{formatCurrency(tx.valor)}
                        </span>
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
      })}
    </div>
  )
}
