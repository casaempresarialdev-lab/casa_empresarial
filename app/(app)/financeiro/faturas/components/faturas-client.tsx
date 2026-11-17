'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { SummaryCard } from '@/components/modules/dashboard/summary-card'
import { ListItem } from '@/components/ui/list-item'
import { toast } from '@/lib/toast'
import { updateInvoiceStatusAction } from '../actions'
import type { CardInvoice } from '../queries'

function fmtCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtMesAno(mesAno: string) {
  const [ano, mes] = mesAno.split('-')
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${meses[parseInt(mes) - 1]}/${ano}`
}

function Selo({ texto, fundo, cor }: { texto: string; fundo: string; cor: string }) {
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap" style={{ backgroundColor: fundo, color: cor }}>{texto}</span>
}

// aberta = neutro (ainda recebendo lançamentos), fechada = atenção (aguardando pagamento), paga = ok — paleta fixa do guia de design
const STATUS_SELO: Record<CardInvoice['status'], { texto: string; fundo: string; cor: string }> = {
  aberta: { texto: 'Aberta', fundo: '#F3F4F6', cor: '#6B7280' },
  fechada: { texto: 'Aguardando pagamento', fundo: '#FEF3C7', cor: '#B45309' },
  paga: { texto: 'Paga', fundo: '#DCFCE7', cor: '#15803D' },
}
const PROXIMA_ACAO: Record<CardInvoice['status'], { icon: 'check' | 'pencil'; label: string; novoStatus: CardInvoice['status'] } | null> = {
  aberta: { icon: 'pencil', label: 'Fechar fatura', novoStatus: 'fechada' },
  fechada: { icon: 'check', label: 'Marcar como paga', novoStatus: 'paga' },
  paga: { icon: 'pencil', label: 'Reabrir', novoStatus: 'aberta' },
}

interface Props {
  invoices: CardInvoice[]
}

// Faturas de cartão de crédito, geradas a partir dos lançamentos com cartão vinculado no Fluxo de Caixa
export function FaturasClient({ invoices }: Props) {
  const router = useRouter()
  const [processando, setProcessando] = useState<string | null>(null)

  async function mudarStatus(inv: CardInvoice) {
    const proxima = PROXIMA_ACAO[inv.status]
    if (!proxima) return
    setProcessando(inv.id)
    const r = await toast.promise(updateInvoiceStatusAction(inv.id, proxima.novoStatus), {
      loading: 'Atualizando a fatura…',
      success: proxima.novoStatus === 'paga' ? 'Fatura marcada como paga.' : proxima.novoStatus === 'fechada' ? 'Fatura fechada.' : 'Fatura reaberta.',
      error: 'Não foi possível atualizar a fatura.',
    })
    setProcessando(null)
    if (!('error' in r)) router.refresh()
  }

  const abertas = invoices.filter((i) => i.status === 'aberta')
  const fechadas = invoices.filter((i) => i.status === 'fechada')
  const pagas = invoices.filter((i) => i.status === 'paga')

  const byCard = invoices.reduce<Record<string, CardInvoice[]>>((acc, inv) => {
    (acc[inv.card_id] ??= []).push(inv)
    return acc
  }, {})

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>Faturas de Cartão</h1>
        <Breadcrumb />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <SummaryCard icon="card" title="Faturas em aberto" value={abertas.length} caption="recebendo lançamentos do mês" />
        <SummaryCard icon="alarm" title="Aguardando pagamento" value={fechadas.length} caption="fechadas, ainda não pagas" accent={fechadas.length ? 'yellow' : undefined} delay={60} />
        <SummaryCard icon="check" title="Pagas" value={pagas.length} caption="quitadas" delay={120} />
      </div>

      <div className="app-card p-5 flex flex-col gap-6">
        {invoices.length === 0 && (
          <p className="text-sm text-center py-6" style={{ color: 'var(--color-text-muted)' }}>
            Nenhuma fatura encontrada. As faturas são geradas automaticamente quando há lançamentos com cartão de crédito vinculado.
          </p>
        )}

        {Object.entries(byCard).map(([cardId, invs]) => {
          const cardNome = invs[0].cartao?.nome ?? 'Cartão'
          return (
            <div key={cardId} className="flex flex-col gap-3">
              <h2 className="text-base font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>{cardNome}</h2>
              <ul className="flex flex-col gap-3">
                {invs.map((inv) => {
                  const proxima = PROXIMA_ACAO[inv.status]
                  return (
                    <ListItem
                      key={inv.id}
                      icon="card"
                      title={fmtMesAno(inv.mes_ano)}
                      subtitle={inv.data_pagamento ? `Pago em ${new Date(inv.data_pagamento).toLocaleDateString('pt-BR')}` : undefined}
                      aside={
                        <>
                          <span className="text-sm font-semibold tabular-nums whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>{fmtCurrency(inv.valor_total ?? 0)}</span>
                          <Selo {...STATUS_SELO[inv.status]} />
                        </>
                      }
                      actionsLabel={`fatura de ${fmtMesAno(inv.mes_ano)}`}
                      actions={proxima ? [{ icon: proxima.icon, label: proxima.label, disabled: processando === inv.id, onClick: () => mudarStatus(inv) }] : []}
                    />
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>
    </>
  )
}
