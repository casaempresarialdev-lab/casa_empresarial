'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createTransactionAction, updateTransactionAction } from '../actions'
import type { TransactionRow } from '../queries'
import type { Category } from '../../categorias/queries'
import type { Contact } from '../../contatos/queries'
import type { BankAccount, CreditCard } from '../../contas-cartoes/queries'
import type { CostCenter } from '../../centro-de-custo/queries'

const RECORRENCIA_OPTIONS = [
  { value: 'semanal', label: 'Semanal' },
  { value: 'quinzenal', label: 'Quinzenal' },
  { value: 'mensal', label: 'Mensal' },
  { value: 'bimestral', label: 'Bimestral' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' },
]

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  transaction: TransactionRow | null
  defaultTipo?: 'recebimento' | 'pagamento'
  categories: Category[]
  contacts: Contact[]
  bankAccounts: BankAccount[]
  creditCards: CreditCard[]
  costCenters: CostCenter[]
}

export function ModalLancamento({
  open, onClose, companyId, transaction, defaultTipo = 'recebimento',
  categories, contacts, bankAccounts, creditCards, costCenters,
}: Props) {
  const router = useRouter()
  const isEdit = !!transaction

  const [tipo, setTipo] = useState<'recebimento' | 'pagamento'>(defaultTipo)
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [dataComp, setDataComp] = useState('')
  const [dataVenc, setDataVenc] = useState('')
  const [status, setStatus] = useState('pendente')
  const [dataPag, setDataPag] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [cardId, setCardId] = useState('')
  const [costCenterId, setCostCenterId] = useState('')
  const [contactId, setContactId] = useState('')
  const [detalhes, setDetalhes] = useState('')

  const [recorrente, setRecorrente] = useState(false)
  const [recorrenciaTipo, setRecorrenciaTipo] = useState('mensal')
  const [fimTipo, setFimTipo] = useState<'infinito' | 'parcelas' | 'data'>('infinito')
  const [recorrenciaTotal, setRecorrenciaTotal] = useState('12')
  const [recorrenciaFim, setRecorrenciaFim] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setTipo((transaction?.tipo as 'recebimento' | 'pagamento') ?? defaultTipo)
      setDescricao(transaction?.descricao ?? '')
      setValor(transaction ? formatMoney(transaction.valor) : '')
      setDataComp(transaction?.data_competencia ?? '')
      setDataVenc(transaction?.data_vencimento ?? '')
      setStatus(transaction?.status ?? 'pendente')
      setDataPag(transaction?.data_pagamento ?? '')
      setCategoriaId(transaction?.categoria_id ?? '')
      setAccountId(transaction?.account_id ?? '')
      setCardId(transaction?.card_id ?? '')
      setCostCenterId(transaction?.cost_center_id ?? '')
      setContactId(transaction?.contact_id ?? '')
      setDetalhes(transaction?.detalhes ?? '')
      setRecorrente(transaction?.recorrente ?? false)
      setRecorrenciaTipo(transaction?.recorrencia_tipo ?? 'mensal')
      setFimTipo('infinito')
      setRecorrenciaTotal('12')
      setRecorrenciaFim('')
      setError('')
    }
  }, [open, transaction, defaultTipo])

  function formatMoney(v: number) {
    return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  function handleAccountChange(v: string) {
    setAccountId(v)
    if (v) setCardId('')
  }
  function handleCardChange(v: string) {
    setCardId(v)
    if (v) setAccountId('')
  }

  const catsFiltradas = categories.filter(
    c => c.tipo === (tipo === 'recebimento' ? 'receita' : 'despesa') && c.ativo
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const fd = new FormData()
    fd.set('tipo', tipo)
    fd.set('descricao', descricao)
    fd.set('valor', valor)
    fd.set('data_competencia', dataComp)
    fd.set('data_vencimento', dataVenc)
    fd.set('status', status)
    fd.set('data_pagamento', status === 'pago' ? dataPag : '')
    fd.set('categoria_id', categoriaId)
    fd.set('account_id', accountId)
    fd.set('card_id', cardId)
    fd.set('cost_center_id', costCenterId)
    fd.set('contact_id', contactId)
    fd.set('detalhes', detalhes)
    fd.set('recorrente', String(!isEdit && recorrente))
    if (!isEdit && recorrente) {
      fd.set('recorrencia_tipo', recorrenciaTipo)
      fd.set('recorrencia_fim_tipo', fimTipo)
      fd.set('recorrencia_total', recorrenciaTotal)
      fd.set('recorrencia_fim', recorrenciaFim)
    }

    const result = isEdit
      ? await updateTransactionAction(transaction.id, fd)
      : await createTransactionAction(companyId, fd)

    setLoading(false)
    if ('error' in result) { setError(result.error ?? 'Erro'); return }
    router.refresh()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar lançamento' : 'Novo lançamento'}
      className="sm:max-w-xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">

        {/* Tipo */}
        {!isEdit && (
          <div className="flex gap-2">
            {(['recebimento', 'pagamento'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => { setTipo(t); setCategoriaId('') }}
                className="flex-1 py-2 rounded-lg text-sm font-medium border transition-colors"
                style={{
                  backgroundColor: tipo === t ? 'var(--color-primary)' : 'white',
                  borderColor: tipo === t ? 'var(--color-primary-dark)' : 'var(--color-bg-surface)',
                  color: tipo === t ? 'var(--color-primary-darker)' : 'var(--color-text-secondary)',
                }}
              >
                {t === 'recebimento' ? '📈 Recebimento' : '📉 Pagamento'}
              </button>
            ))}
          </div>
        )}

        <Input label="Descrição *" value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex: Aluguel, Venda de produto..." required />

        <div className="grid grid-cols-2 gap-3">
          <Input label="Valor (R$) *" value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" inputMode="decimal" required />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)}
              className="h-10 w-full rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C19A6B]"
              style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: 'white' }}>
              <option value="pendente">Pendente</option>
              <option value="pago">Pago / Recebido</option>
              <option value="cancelado">Cancelado</option>
              <option value="conciliado">Conciliado</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Data de competência *" type="date" value={dataComp} onChange={e => setDataComp(e.target.value)} required />
          <Input label="Data de vencimento" type="date" value={dataVenc} onChange={e => setDataVenc(e.target.value)} />
        </div>

        {status === 'pago' && (
          <Input label="Data de pagamento" type="date" value={dataPag} onChange={e => setDataPag(e.target.value)} />
        )}

        <div className="grid grid-cols-2 gap-3">
          {/* Categoria filtrada por tipo */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Categoria</label>
            <select value={categoriaId} onChange={e => setCategoriaId(e.target.value)}
              className="h-10 w-full rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C19A6B]"
              style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: 'white' }}>
              <option value="">Selecione...</option>
              {catsFiltradas.map(c => (
                <option key={c.id} value={c.id}>
                  {c.icone ? `${c.icone} ` : ''}{c.nome}
                </option>
              ))}
            </select>
          </div>
          {/* Contato */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              {tipo === 'recebimento' ? 'Cliente' : 'Fornecedor'}
            </label>
            <select value={contactId} onChange={e => setContactId(e.target.value)}
              className="h-10 w-full rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C19A6B]"
              style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: 'white' }}>
              <option value="">Selecione...</option>
              {contacts.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Conta bancária */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Conta bancária</label>
            <select value={accountId} onChange={e => handleAccountChange(e.target.value)}
              className="h-10 w-full rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C19A6B]"
              style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: 'white' }}>
              <option value="">Selecione...</option>
              {bankAccounts.filter(a => a.ativo).map(a => <option key={a.id} value={a.id}>{a.banco}</option>)}
            </select>
          </div>
          {/* Cartão */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Cartão de crédito</label>
            <select value={cardId} onChange={e => handleCardChange(e.target.value)}
              className="h-10 w-full rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C19A6B]"
              style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: 'white' }}>
              <option value="">Selecione...</option>
              {creditCards.filter(c => c.ativo).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
        </div>

        {/* Centro de custo */}
        {costCenters.length > 0 && (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Centro de custo</label>
            <select value={costCenterId} onChange={e => setCostCenterId(e.target.value)}
              className="h-10 w-full rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C19A6B]"
              style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: 'white' }}>
              <option value="">Selecione...</option>
              {costCenters.filter(c => c.ativo).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
        )}

        {/* Detalhes */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Observações</label>
          <textarea value={detalhes} onChange={e => setDetalhes(e.target.value)} rows={2} placeholder="Informações adicionais..."
            className="w-full rounded-lg border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#C19A6B]"
            style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }} />
        </div>

        {/* Recorrência — apenas na criação */}
        {!isEdit && (
          <div className="border rounded-xl p-4 flex flex-col gap-3" style={{ borderColor: 'var(--color-bg-surface)' }}>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div onClick={() => setRecorrente(!recorrente)}
                className="relative w-10 h-6 rounded-full transition-colors cursor-pointer"
                style={{ backgroundColor: recorrente ? 'var(--color-primary-dark)' : '#D1D5DB' }}>
                <div className="absolute top-1 w-4 h-4 rounded-full bg-white transition-transform shadow"
                  style={{ left: recorrente ? '22px' : '4px' }} />
              </div>
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                Lançamento recorrente
              </span>
            </label>

            {recorrente && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Frequência</label>
                  <select value={recorrenciaTipo} onChange={e => setRecorrenciaTipo(e.target.value)}
                    className="h-10 w-full rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C19A6B]"
                    style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: 'white' }}>
                    {RECORRENCIA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Término</label>
                  <div className="flex gap-2">
                    {([
                      { v: 'infinito', l: 'Sem fim' },
                      { v: 'parcelas', l: 'Nº de parcelas' },
                      { v: 'data', l: 'Até data' },
                    ] as const).map(opt => (
                      <button key={opt.v} type="button" onClick={() => setFimTipo(opt.v)}
                        className="flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                        style={{
                          backgroundColor: fimTipo === opt.v ? 'var(--color-primary)' : 'white',
                          borderColor: fimTipo === opt.v ? 'var(--color-primary-dark)' : 'var(--color-bg-surface)',
                          color: fimTipo === opt.v ? 'var(--color-primary-darker)' : 'var(--color-text-secondary)',
                        }}>
                        {opt.l}
                      </button>
                    ))}
                  </div>
                </div>

                {fimTipo === 'parcelas' && (
                  <Input label="Número de parcelas" type="number" min={2} max={360} value={recorrenciaTotal}
                    onChange={e => setRecorrenciaTotal(e.target.value)} placeholder="12" />
                )}
                {fimTipo === 'data' && (
                  <Input label="Repetir até" type="date" value={recorrenciaFim}
                    onChange={e => setRecorrenciaFim(e.target.value)} />
                )}
                {fimTipo === 'infinito' && (
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    Gera 36 meses à frente automaticamente — o diferencial da Casa Empresarial.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {error && <p className="text-sm p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>{error}</p>}

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading} className="flex-1">
            {isEdit ? 'Salvar' : recorrente ? `Criar série` : 'Criar lançamento'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
