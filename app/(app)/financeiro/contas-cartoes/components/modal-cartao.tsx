'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createCreditCardAction, updateCreditCardAction } from '../actions'
import type { CreditCard } from '../queries'

const BANDEIRA_OPTIONS = [
  { value: 'visa', label: 'Visa' },
  { value: 'mastercard', label: 'Mastercard' },
  { value: 'elo', label: 'Elo' },
  { value: 'amex', label: 'American Express' },
  { value: 'hipercard', label: 'Hipercard' },
  { value: 'outro', label: 'Outro' },
]

function formatMoney(v: number | null) {
  if (v === null || v === undefined) return ''
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  card: CreditCard | null
}

export function ModalCartao({ open, onClose, companyId, card }: Props) {
  const router = useRouter()
  const isEdit = !!card

  const [nome, setNome] = useState('')
  const [bandeira, setBandeira] = useState('')
  const [limite, setLimite] = useState('')
  const [diaVencimento, setDiaVencimento] = useState('')
  const [diaFechamento, setDiaFechamento] = useState('')
  const [ativo, setAtivo] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setNome(card?.nome ?? '')
      setBandeira(card?.bandeira ?? '')
      setLimite(card ? formatMoney(card.limite) : '')
      setDiaVencimento(card?.dia_vencimento ? String(card.dia_vencimento) : '')
      setDiaFechamento(card?.dia_fechamento ? String(card.dia_fechamento) : '')
      setAtivo(card?.ativo ?? true)
      setError('')
    }
  }, [open, card])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const fd = new FormData()
    fd.set('nome', nome)
    fd.set('bandeira', bandeira)
    fd.set('limite', limite)
    fd.set('dia_vencimento', diaVencimento)
    fd.set('dia_fechamento', diaFechamento)
    fd.set('ativo', String(ativo))

    const result = isEdit
      ? await updateCreditCardAction(card.id, fd)
      : await createCreditCardAction(companyId, fd)

    setLoading(false)
    if ('error' in result) { setError(result.error ?? 'Erro'); return }
    router.refresh()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar cartão' : 'Novo cartão de crédito'}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Nome do cartão *"
          value={nome}
          onChange={e => setNome(e.target.value)}
          placeholder="Ex: Nubank, Itaú Platinum..."
          required
        />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Bandeira</label>
          <select
            value={bandeira}
            onChange={e => setBandeira(e.target.value)}
            className="h-10 w-full rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C19A6B]"
            style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: 'white' }}
          >
            <option value="">Selecione...</option>
            {BANDEIRA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <Input
          label="Limite (R$)"
          value={limite}
          onChange={e => setLimite(e.target.value)}
          placeholder="0,00"
          inputMode="decimal"
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Dia de fechamento"
            type="number"
            min={1}
            max={31}
            value={diaFechamento}
            onChange={e => setDiaFechamento(e.target.value)}
            placeholder="Ex: 25"
          />
          <Input
            label="Dia de vencimento"
            type="number"
            min={1}
            max={31}
            value={diaVencimento}
            onChange={e => setDiaVencimento(e.target.value)}
            placeholder="Ex: 5"
          />
        </div>

        <label className="flex items-center gap-3 cursor-pointer select-none">
          <div
            onClick={() => setAtivo(!ativo)}
            className="relative w-10 h-6 rounded-full transition-colors cursor-pointer"
            style={{ backgroundColor: ativo ? 'var(--color-primary-dark)' : '#D1D5DB' }}
          >
            <div className="absolute top-1 w-4 h-4 rounded-full bg-white transition-transform shadow" style={{ left: ativo ? '22px' : '4px' }} />
          </div>
          <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{ativo ? 'Ativo' : 'Inativo'}</span>
        </label>

        {error && <p className="text-sm p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>{error}</p>}

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading} className="flex-1">{isEdit ? 'Salvar' : 'Criar cartão'}</Button>
        </div>
      </form>
    </Modal>
  )
}
