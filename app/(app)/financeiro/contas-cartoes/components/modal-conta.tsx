'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createBankAccountAction, updateBankAccountAction } from '../actions'
import type { BankAccount } from '../queries'

const TIPO_OPTIONS = [
  { value: 'corrente', label: 'Conta Corrente' },
  { value: 'poupanca', label: 'Poupança' },
  { value: 'pagamento', label: 'Conta Pagamento' },
  { value: 'investimento', label: 'Investimento' },
  { value: 'caixa', label: 'Caixa (espécie)' },
]

function formatMoney(v: number | null) {
  if (v === null || v === undefined) return ''
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  account: BankAccount | null
}

export function ModalConta({ open, onClose, companyId, account }: Props) {
  const router = useRouter()
  const isEdit = !!account

  const [banco, setBanco] = useState('')
  const [agencia, setAgencia] = useState('')
  const [numero, setNumero] = useState('')
  const [digito, setDigito] = useState('')
  const [tipo, setTipo] = useState('')
  const [saldoInicial, setSaldoInicial] = useState('')
  const [ativo, setAtivo] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setBanco(account?.banco ?? '')
      setAgencia(account?.agencia ?? '')
      setNumero(account?.numero ?? '')
      setDigito(account?.digito ?? '')
      setTipo(account?.tipo ?? '')
      setSaldoInicial(account ? formatMoney(account.saldo_inicial) : '')
      setAtivo(account?.ativo ?? true)
      setError('')
    }
  }, [open, account])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const fd = new FormData()
    fd.set('banco', banco)
    fd.set('agencia', agencia)
    fd.set('numero', numero)
    fd.set('digito', digito)
    fd.set('tipo', tipo)
    fd.set('saldo_inicial', saldoInicial)
    fd.set('ativo', String(ativo))

    const result = isEdit
      ? await updateBankAccountAction(account.id, fd)
      : await createBankAccountAction(companyId, fd)

    setLoading(false)
    if ('error' in result) { setError(result.error ?? 'Erro'); return }
    router.refresh()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar conta bancária' : 'Nova conta bancária'}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Banco / Nome da conta *"
          value={banco}
          onChange={e => setBanco(e.target.value)}
          placeholder="Ex: Itaú, Nubank, Bradesco..."
          required
        />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Tipo de conta</label>
          <select
            value={tipo}
            onChange={e => setTipo(e.target.value)}
            className="h-10 w-full rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C19A6B]"
            style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: 'white' }}
          >
            <option value="">Selecione...</option>
            {TIPO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Input label="Agência" value={agencia} onChange={e => setAgencia(e.target.value)} placeholder="0000" />
          <Input label="Número" value={numero} onChange={e => setNumero(e.target.value)} placeholder="00000" />
          <Input label="Dígito" value={digito} onChange={e => setDigito(e.target.value)} placeholder="0" />
        </div>

        <Input
          label="Saldo inicial (R$)"
          value={saldoInicial}
          onChange={e => setSaldoInicial(e.target.value)}
          placeholder="0,00"
          inputMode="decimal"
        />

        <label className="flex items-center gap-3 cursor-pointer select-none">
          <div
            onClick={() => setAtivo(!ativo)}
            className="relative w-10 h-6 rounded-full transition-colors cursor-pointer"
            style={{ backgroundColor: ativo ? 'var(--color-primary-dark)' : '#D1D5DB' }}
          >
            <div className="absolute top-1 w-4 h-4 rounded-full bg-white transition-transform shadow" style={{ left: ativo ? '22px' : '4px' }} />
          </div>
          <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{ativo ? 'Ativa' : 'Inativa'}</span>
        </label>

        {error && <p className="text-sm p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>{error}</p>}

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading} className="flex-1">{isEdit ? 'Salvar' : 'Criar conta'}</Button>
        </div>
      </form>
    </Modal>
  )
}
