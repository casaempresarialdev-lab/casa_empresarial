'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { fetchCashSessionSummaryAction, closeCashSessionAction } from '../actions'
import type { CashSession, CashSessionSummary } from '../queries'

interface Props {
  open: boolean
  onClose: () => void
  cashSession: CashSession
  onFechado: () => void
}

const FORMA_LABELS: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  credito: 'Cartão de Crédito',
  debito: 'Cartão de Débito',
  outro: 'Outro',
}

function formatBRL(val: number) {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function ModalFecharCaixa({ open, onClose, cashSession, onFechado }: Props) {
  const [summary, setSummary] = useState<CashSessionSummary | null>(null)
  const [saldoFechamento, setSaldoFechamento] = useState('')
  const [observacao, setObservacao] = useState('')
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setSaldoFechamento(''); setObservacao(''); setError(''); setSummary(null)
    setLoadingSummary(true)
    fetchCashSessionSummaryAction().then(result => {
      setLoadingSummary(false)
      if (!('error' in result)) setSummary(result)
    })
  }, [open])

  const saldoInformado = parseFloat(saldoFechamento.replace(',', '.')) || 0
  const esperadoDinheiro = cashSession.saldo_abertura + (summary?.totalPorFormaPagamento['dinheiro'] ?? 0)
  const diferenca = saldoFechamento ? parseFloat((saldoInformado - esperadoDinheiro).toFixed(2)) : 0

  async function handleConfirmar() {
    setLoading(true)
    setError('')
    const result = await closeCashSessionAction(saldoInformado, observacao)
    setLoading(false)
    if ('error' in result) { setError(result.error ?? 'Erro ao fechar o caixa.'); return }
    onFechado()
  }

  return (
    <Modal open={open} onClose={onClose} title="Fechar Caixa">
      <div className="space-y-4">
        {loadingSummary ? (
          <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-muted)' }}>Carregando resumo...</p>
        ) : summary && (
          <div className="p-3 rounded-lg space-y-1.5" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
            <div className="flex justify-between text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              <span>Saldo de abertura</span><span>{formatBRL(cashSession.saldo_abertura)}</span>
            </div>
            {Object.entries(summary.totalPorFormaPagamento).map(([forma, valor]) => (
              <div key={forma} className="flex justify-between text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                <span>{FORMA_LABELS[forma] ?? forma}</span><span>{formatBRL(valor)}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm font-bold pt-1.5 border-t" style={{ borderColor: 'white', color: 'var(--color-text-primary)' }}>
              <span>Total vendido ({summary.qtdVendas} {summary.qtdVendas === 1 ? 'venda' : 'vendas'})</span>
              <span>{formatBRL(summary.totalGeral)}</span>
            </div>
          </div>
        )}

        <div>
          <label className="text-sm font-medium block mb-1" style={{ color: 'var(--color-text-secondary)' }}>
            Dinheiro em caixa (conferência)
          </label>
          <Input value={saldoFechamento} onChange={e => setSaldoFechamento(e.target.value)} placeholder="0,00" inputMode="decimal" />
          {saldoFechamento && (
            <p className="text-xs mt-1.5" style={{ color: diferenca === 0 ? 'var(--color-text-muted)' : diferenca > 0 ? '#1E8449' : '#C0392B' }}>
              {diferenca === 0
                ? 'Confere com o esperado.'
                : diferenca > 0
                  ? `Sobra de ${formatBRL(diferenca)} em relação ao esperado (${formatBRL(esperadoDinheiro)}).`
                  : `Falta de ${formatBRL(Math.abs(diferenca))} em relação ao esperado (${formatBRL(esperadoDinheiro)}).`}
            </p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium block mb-1" style={{ color: 'var(--color-text-secondary)' }}>
            Observação (opcional)
          </label>
          <textarea
            value={observacao}
            onChange={e => setObservacao(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
            style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
          />
        </div>

        {error && (
          <p className="text-sm p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>{error}</p>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="danger" onClick={handleConfirmar} loading={loading}>Confirmar Fechamento</Button>
        </div>
      </div>
    </Modal>
  )
}
