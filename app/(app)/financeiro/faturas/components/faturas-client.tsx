'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { updateInvoiceStatusAction } from '../actions'
import type { CardInvoice } from '../queries'

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatMesAno(mesAno: string) {
  const [ano, mes] = mesAno.split('-')
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  return `${meses[parseInt(mes) - 1]}/${ano}`
}

const BANDEIRA_EMOJI: Record<string, string> = {
  visa: '💳', mastercard: '💳', elo: '💳', amex: '💳', hipercard: '💳', outro: '💳',
}

const STATUS_CONFIG = {
  aberta:  { label: 'Aberta',  bg: '#FEF9E7', text: '#D4AC0D' },
  fechada: { label: 'Fechada', bg: '#EBF5FB', text: '#2471A3' },
  paga:    { label: 'Paga',    bg: '#E9F7EF', text: '#1E8449' },
}

interface Props {
  invoices: CardInvoice[]
}

export function FaturasClient({ invoices }: Props) {
  const router = useRouter()
  const [actionId, setActionId] = useState<string | null>(null)

  async function handleStatus(inv: CardInvoice, status: 'aberta' | 'fechada' | 'paga') {
    setActionId(inv.id)
    await updateInvoiceStatusAction(inv.id, status)
    setActionId(null)
    router.refresh()
  }

  // Agrupa por cartão
  const byCard = invoices.reduce<Record<string, CardInvoice[]>>((acc, inv) => {
    const key = inv.card_id
    if (!acc[key]) acc[key] = []
    acc[key].push(inv)
    return acc
  }, {})

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
            Faturas de Cartão
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Faturas mensais dos cartões de crédito
          </p>
        </div>
      </div>

      {invoices.length === 0 && (
        <div className="rounded-xl border p-10 text-center" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Nenhuma fatura encontrada. As faturas são geradas automaticamente quando há lançamentos com cartão de crédito vinculado.
          </p>
        </div>
      )}

      {Object.entries(byCard).map(([, invs]) => {
        const first = invs[0]
        const cardNome = first.cartao?.nome ?? 'Cartão'
        const bandeira = first.cartao?.bandeira ?? ''
        return (
          <div key={first.card_id} className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span>{BANDEIRA_EMOJI[bandeira] ?? '💳'}</span>
              <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>{cardNome}</h2>
            </div>
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
              <table className="w-full text-sm">
                <thead style={{ backgroundColor: 'var(--color-bg-surface)' }}>
                  <tr>
                    <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Mês/Ano</th>
                    <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Total</th>
                    <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {invs.map(inv => {
                    const s = STATUS_CONFIG[inv.status]
                    const isBusy = actionId === inv.id
                    return (
                      <tr key={inv.id} className="border-t" style={{ borderColor: 'var(--color-bg-surface)' }}>
                        <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text-primary)' }}>
                          {formatMesAno(inv.mes_ano)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                          {formatCurrency(inv.valor_total ?? 0)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{ backgroundColor: s.bg, color: s.text }}>
                            {s.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 justify-end">
                            {inv.status === 'aberta' && (
                              <Button size="sm" variant="ghost" loading={isBusy} onClick={() => handleStatus(inv, 'fechada')}>
                                Fechar fatura
                              </Button>
                            )}
                            {inv.status === 'fechada' && (
                              <Button size="sm" loading={isBusy} onClick={() => handleStatus(inv, 'paga')}>
                                Marcar como paga
                              </Button>
                            )}
                            {inv.status === 'paga' && (
                              <Button size="sm" variant="ghost" loading={isBusy} onClick={() => handleStatus(inv, 'aberta')}>
                                Reabrir
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </>
  )
}
