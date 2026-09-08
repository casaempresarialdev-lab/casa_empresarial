'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createPdvSaleAction, type PdvSaleItem } from '../actions'
import { Comprovante } from './comprovante'

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  itens: PdvSaleItem[]
  subtotal: number
  onComplete: () => void
}

const FORMAS = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'pix', label: 'Pix' },
  { value: 'credito', label: 'Cartão de Crédito' },
  { value: 'debito', label: 'Cartão de Débito' },
  { value: 'outro', label: 'Outro' },
]

function formatBRL(val: number) {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function ModalCheckout({ open, onClose, companyId, itens, subtotal, onComplete }: Props) {
  const [clienteNome, setClienteNome] = useState('')
  const [desconto, setDesconto] = useState('')
  const [formaPagamento, setFormaPagamento] = useState('')
  const [valorRecebido, setValorRecebido] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [vendaConcluida, setVendaConcluida] = useState<{ total: number; troco: number } | null>(null)

  useEffect(() => {
    if (!open) return
    setClienteNome(''); setDesconto(''); setFormaPagamento('')
    setValorRecebido(''); setError(''); setVendaConcluida(null)
  }, [open])

  const descontoVal = parseFloat(desconto.replace(',', '.')) || 0
  const total = Math.max(0, parseFloat((subtotal - descontoVal).toFixed(2)))
  const recebidoVal = parseFloat(valorRecebido.replace(',', '.')) || 0
  const troco = formaPagamento === 'dinheiro' ? Math.max(0, parseFloat((recebidoVal - total).toFixed(2))) : 0
  const recebidoInsuficiente = formaPagamento === 'dinheiro' && valorRecebido !== '' && recebidoVal < total

  async function handleConfirmar() {
    if (!formaPagamento) { setError('Selecione a forma de pagamento.'); return }
    setLoading(true)
    setError('')

    const fd = new FormData()
    fd.set('itens', JSON.stringify(itens))
    fd.set('desconto', desconto)
    fd.set('forma_pagamento', formaPagamento)
    fd.set('troco', String(troco))
    fd.set('cliente_nome', clienteNome)

    const result = await createPdvSaleAction(companyId, fd)
    setLoading(false)

    if ('error' in result) { setError(result.error ?? 'Erro ao finalizar venda.'); return }
    setVendaConcluida({ total: result.total ?? total, troco: result.troco ?? troco })
  }

  function handleFechar() {
    if (vendaConcluida) onComplete()
    else onClose()
  }

  if (vendaConcluida) {
    return (
      <Modal open={open} onClose={handleFechar} title="Venda concluída">
        <Comprovante
          itens={itens}
          subtotal={subtotal}
          desconto={descontoVal}
          total={vendaConcluida.total}
          formaPagamento={formaPagamento}
          troco={vendaConcluida.troco}
          clienteNome={clienteNome}
        />
        <div className="flex gap-3 justify-end pt-4">
          <Button variant="secondary" onClick={() => window.print()}>Imprimir</Button>
          <Button onClick={handleFechar}>Nova venda</Button>
        </div>
      </Modal>
    )
  }

  const labelStyle = { color: 'var(--color-text-secondary)', fontSize: '0.75rem', fontWeight: 500, marginBottom: 4, display: 'block' }

  return (
    <Modal open={open} onClose={onClose} title="Finalizar Venda">
      <div className="space-y-4">
        <div>
          <label style={labelStyle}>Cliente (opcional)</label>
          <Input value={clienteNome} onChange={e => setClienteNome(e.target.value)} placeholder="Nome do cliente" />
        </div>

        <div>
          <label style={labelStyle}>Desconto (R$)</label>
          <Input value={desconto} onChange={e => setDesconto(e.target.value)} placeholder="0,00" inputMode="decimal" />
        </div>

        <div>
          <label style={labelStyle}>Forma de Pagamento</label>
          <div className="grid grid-cols-2 gap-2">
            {FORMAS.map(f => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFormaPagamento(f.value)}
                className="px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors"
                style={{
                  borderColor: formaPagamento === f.value ? 'var(--color-primary-darker)' : 'var(--color-bg-surface)',
                  backgroundColor: formaPagamento === f.value ? 'var(--color-primary)' : 'white',
                  color: formaPagamento === f.value ? 'var(--color-primary-darker)' : 'var(--color-text-secondary)',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {formaPagamento === 'dinheiro' && (
          <div>
            <label style={labelStyle}>Valor recebido (R$)</label>
            <Input value={valorRecebido} onChange={e => setValorRecebido(e.target.value)} placeholder="0,00" inputMode="decimal" />
            {valorRecebido && !recebidoInsuficiente && (
              <p className="text-sm mt-1.5 font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                Troco: {formatBRL(troco)}
              </p>
            )}
          </div>
        )}

        <div className="pt-3 border-t space-y-1" style={{ borderColor: 'var(--color-bg-surface)' }}>
          <div className="flex justify-between text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            <span>Subtotal</span><span>{formatBRL(subtotal)}</span>
          </div>
          {descontoVal > 0 && (
            <div className="flex justify-between text-sm" style={{ color: '#C0392B' }}>
              <span>Desconto</span><span>-{formatBRL(descontoVal)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>
            <span>Total</span><span>{formatBRL(total)}</span>
          </div>
        </div>

        {error && (
          <p className="text-sm p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>{error}</p>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={handleConfirmar}
            loading={loading}
            disabled={!formaPagamento || recebidoInsuficiente}
          >
            Confirmar Venda
          </Button>
        </div>
      </div>
    </Modal>
  )
}
