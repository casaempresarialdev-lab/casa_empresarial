'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createServiceOrderAction, updateServiceOrderAction } from '../actions'
import type { ServiceOrder, OrdemServicoItem } from '../queries'

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  order: ServiceOrder | null
  contacts: { id: string; nome: string; tipo: string }[]
}

function formatBRL(val: number) {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function ModalOrdemServico({ open, onClose, companyId, order, contacts }: Props) {
  const router = useRouter()
  const isEdit = !!order

  const [tab, setTab] = useState<'dados' | 'itens'>('dados')
  const [clienteId, setClienteId] = useState('')
  const [data, setData] = useState('')
  const [status, setStatus] = useState('aberta')
  const [formaPagamento, setFormaPagamento] = useState('')
  const [observacao, setObservacao] = useState('')
  const [itens, setItens] = useState<OrdemServicoItem[]>([])

  const [itemDescricao, setItemDescricao] = useState('')
  const [itemValor, setItemValor] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const valorTotal = itens.reduce((sum, i) => sum + i.valor, 0)

  useEffect(() => {
    if (!open) return
    setError('')
    setTab('dados')
    if (order) {
      setClienteId(order.cliente_id ?? '')
      setData(order.data)
      setStatus(order.status)
      setFormaPagamento(order.forma_pagamento ?? '')
      setObservacao(order.observacao ?? '')
      setItens(order.itens ?? [])
    } else {
      setClienteId(''); setData(new Date().toISOString().slice(0, 10))
      setStatus('aberta'); setFormaPagamento('')
      setObservacao(''); setItens([])
    }
    setItemDescricao(''); setItemValor('')
  }, [open, order])

  function addItem() {
    if (!itemDescricao.trim()) return
    const valor = parseFloat(itemValor.replace(',', '.')) || 0
    setItens(prev => [...prev, { descricao: itemDescricao.trim(), valor }])
    setItemDescricao(''); setItemValor('')
  }

  function removeItem(idx: number) { setItens(prev => prev.filter((_, i) => i !== idx)) }

  function updateItemValor(idx: number, val: string) {
    const valor = parseFloat(val.replace(',', '.')) || 0
    setItens(prev => prev.map((item, i) => i === idx ? { ...item, valor } : item))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const fd = new FormData()
    fd.set('cliente_id', clienteId)
    fd.set('data', data)
    fd.set('status', status)
    fd.set('forma_pagamento', formaPagamento)
    fd.set('observacao', observacao)
    fd.set('itens', JSON.stringify(itens))

    const result = isEdit
      ? await updateServiceOrderAction(order!.id, fd)
      : await createServiceOrderAction(companyId, fd)

    setLoading(false)
    if ('error' in result) { setError(result.error ?? 'Erro ao salvar.'); return }
    router.refresh()
    onClose()
  }

  const labelStyle = { color: 'var(--color-text-secondary)', fontSize: '0.75rem', fontWeight: 500, marginBottom: 4, display: 'block' }
  const tabStyle = (active: boolean) => ({
    padding: '6px 16px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 500,
    backgroundColor: active ? 'var(--color-primary)' : 'transparent',
    color: active ? 'var(--color-primary-darker)' : 'var(--color-text-muted)',
    cursor: 'pointer', border: 'none',
  })

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? `Editar OS #${String(order!.numero).padStart(3, '0')}` : 'Nova Ordem de Serviço'}>
      <form onSubmit={handleSubmit} className="space-y-4">

        <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
          <button type="button" style={tabStyle(tab === 'dados')} onClick={() => setTab('dados')}>Dados da OS</button>
          <button type="button" style={tabStyle(tab === 'itens')} onClick={() => setTab('itens')}>
            Itens do serviço {itens.length > 0 && `(${itens.length})`}
          </button>
        </div>

        {/* Tab: Dados */}
        {tab === 'dados' && (
          <div className="space-y-3">
            <div>
              <label style={labelStyle}>Cliente</label>
              <select
                value={clienteId}
                onChange={e => setClienteId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
              >
                <option value="">Sem cliente</option>
                {contacts.map(c => (
                  <option key={c.id} value={c.id}>{c.nome} ({c.tipo})</option>
                ))}
              </select>
              {contacts.length === 0 && (
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  Nenhum contato cadastrado. Cadastre em Financeiro → Contatos.
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={labelStyle}>Data</label>
                <Input type="date" value={data} onChange={e => setData(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Forma de Pagamento</label>
                <select
                  value={formaPagamento}
                  onChange={e => setFormaPagamento(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                >
                  <option value="">Selecionar...</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="pix">Pix</option>
                  <option value="credito">Cartão de Crédito</option>
                  <option value="debito">Cartão de Débito</option>
                  <option value="boleto">Boleto</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
              >
                <option value="aberta">Aberta</option>
                <option value="concluida">Concluída</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Observação</label>
              <textarea
                value={observacao}
                onChange={e => setObservacao(e.target.value)}
                rows={3}
                placeholder="Detalhes do serviço prestado..."
                className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
                style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
              />
            </div>
          </div>
        )}

        {/* Tab: Itens */}
        {tab === 'itens' && (
          <div className="space-y-3">
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>Adicionar item</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <Input value={itemDescricao} onChange={e => setItemDescricao(e.target.value)} placeholder="Descrição do serviço *" />
                </div>
                <Input value={itemValor} onChange={e => setItemValor(e.target.value)} placeholder="Valor (R$)" inputMode="decimal" />
              </div>
              <Button type="button" onClick={addItem} className="w-full mt-2">+ Adicionar</Button>
            </div>

            {itens.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-muted)' }}>Nenhum item adicionado.</p>
            ) : (
              <div className="space-y-2">
                {itens.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 px-3 py-2 rounded-lg border" style={{ borderColor: 'var(--color-bg-surface)' }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{item.descricao}</p>
                    </div>
                    <input type="text" value={item.valor}
                      onChange={e => updateItemValor(idx, e.target.value)}
                      className="w-24 px-2 py-1 rounded border text-sm text-right"
                      style={{ borderColor: 'var(--color-bg-surface)' }}
                    />
                    <button type="button" onClick={() => removeItem(idx)}
                      className="text-sm hover:text-red-500 transition-colors flex-shrink-0"
                      style={{ color: 'var(--color-text-muted)' }}
                    >✕</button>
                  </div>
                ))}

                <div className="pt-2 border-t flex justify-between text-sm font-bold" style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}>
                  <span>Total</span><span>{formatBRL(valorTotal)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <p className="text-sm p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>{error}</p>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>{isEdit ? 'Salvar alterações' : 'Criar ordem'}</Button>
        </div>
      </form>
    </Modal>
  )
}
