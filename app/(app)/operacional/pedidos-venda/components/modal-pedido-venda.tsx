'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createSaleOrderAction, updateSaleOrderAction } from '../actions'
import type { SaleOrder, PedidoVendaItem } from '../queries'

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  order: SaleOrder | null
  contacts: { id: string; nome: string; tipo: string }[]
  products: { id: string; nome: string; preco_venda: number | null; unidade_medida: string }[]
}

function formatBRL(val: number) {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function ModalPedidoVenda({ open, onClose, companyId, order, contacts, products }: Props) {
  const router = useRouter()
  const isEdit = !!order

  const [tab, setTab] = useState<'dados' | 'itens'>('dados')
  const [clienteId, setClienteId] = useState('')
  const [data, setData] = useState('')
  const [dataEntrega, setDataEntrega] = useState('')
  const [status, setStatus] = useState('rascunho')
  const [formaPagamento, setFormaPagamento] = useState('')
  const [desconto, setDesconto] = useState('')
  const [observacao, setObservacao] = useState('')
  const [itens, setItens] = useState<PedidoVendaItem[]>([])

  const [itemProductId, setItemProductId] = useState('')
  const [itemNome, setItemNome] = useState('')
  const [itemQtd, setItemQtd] = useState('1')
  const [itemPreco, setItemPreco] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const subtotalItens = itens.reduce((sum, i) => sum + i.subtotal, 0)
  const descontoVal = parseFloat(desconto.replace(',', '.')) || 0
  const valorTotal = Math.max(0, subtotalItens - descontoVal)

  useEffect(() => {
    if (!open) return
    setError('')
    setTab('dados')
    if (order) {
      setClienteId(order.cliente_id ?? '')
      setData(order.data)
      setDataEntrega(order.data_entrega ?? '')
      setStatus(order.status)
      setFormaPagamento(order.forma_pagamento ?? '')
      setDesconto(order.desconto > 0 ? String(order.desconto) : '')
      setObservacao(order.observacao ?? '')
      setItens(order.itens ?? [])
    } else {
      setClienteId(''); setData(new Date().toISOString().slice(0, 10))
      setDataEntrega(''); setStatus('rascunho'); setFormaPagamento('')
      setDesconto(''); setObservacao(''); setItens([])
    }
    resetItemForm()
  }, [open, order])

  function resetItemForm() {
    setItemProductId(''); setItemNome(''); setItemQtd('1'); setItemPreco('')
  }

  function handleProductSelect(productId: string) {
    setItemProductId(productId)
    if (!productId) { setItemNome(''); setItemPreco(''); return }
    const p = products.find(p => p.id === productId)
    if (p) {
      setItemNome(p.nome)
      setItemPreco(p.preco_venda !== null ? String(p.preco_venda) : '')
    }
  }

  function addItem() {
    if (!itemNome.trim()) return
    const qtd = parseFloat(itemQtd) || 1
    const preco = parseFloat(itemPreco.replace(',', '.')) || 0
    const subtotal = parseFloat((qtd * preco).toFixed(2))
    setItens(prev => [...prev, { product_id: itemProductId || null, nome: itemNome.trim(), qtd, preco_unitario: preco, subtotal }])
    resetItemForm()
  }

  function removeItem(idx: number) { setItens(prev => prev.filter((_, i) => i !== idx)) }

  function updateItemQtd(idx: number, val: string) {
    const qtd = parseFloat(val) || 0
    setItens(prev => prev.map((item, i) =>
      i === idx ? { ...item, qtd, subtotal: parseFloat((qtd * item.preco_unitario).toFixed(2)) } : item
    ))
  }

  function updateItemPreco(idx: number, val: string) {
    const preco = parseFloat(val.replace(',', '.')) || 0
    setItens(prev => prev.map((item, i) =>
      i === idx ? { ...item, preco_unitario: preco, subtotal: parseFloat((item.qtd * preco).toFixed(2)) } : item
    ))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const fd = new FormData()
    fd.set('cliente_id', clienteId)
    fd.set('data', data)
    fd.set('data_entrega', dataEntrega)
    fd.set('status', status)
    fd.set('forma_pagamento', formaPagamento)
    fd.set('desconto', desconto)
    fd.set('observacao', observacao)
    fd.set('itens', JSON.stringify(itens))

    const result = isEdit
      ? await updateSaleOrderAction(order!.id, fd)
      : await createSaleOrderAction(companyId, fd)

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
    <Modal open={open} onClose={onClose} title={isEdit ? `Editar Pedido #${String(order!.numero).padStart(3, '0')}` : 'Novo Pedido de Venda'}>
      <form onSubmit={handleSubmit} className="space-y-4">

        <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
          <button type="button" style={tabStyle(tab === 'dados')} onClick={() => setTab('dados')}>Dados do Pedido</button>
          <button type="button" style={tabStyle(tab === 'itens')} onClick={() => setTab('itens')}>
            Itens {itens.length > 0 && `(${itens.length})`}
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
                <label style={labelStyle}>Data do Pedido</label>
                <Input type="date" value={data} onChange={e => setData(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Previsão de Entrega</label>
                <Input type="date" value={dataEntrega} onChange={e => setDataEntrega(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
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
              <div>
                <label style={labelStyle}>Desconto (R$)</label>
                <Input
                  value={desconto}
                  onChange={e => setDesconto(e.target.value)}
                  placeholder="0,00"
                  inputMode="decimal"
                />
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
                <option value="rascunho">Rascunho</option>
                <option value="confirmado">Confirmado</option>
                <option value="em_producao">Em Produção</option>
                <option value="enviado">Enviado</option>
                <option value="entregue">Entregue</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Observação</label>
              <textarea
                value={observacao}
                onChange={e => setObservacao(e.target.value)}
                rows={3}
                placeholder="Instruções de entrega, condições..."
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
              <div className="space-y-2">
                <select
                  value={itemProductId}
                  onChange={e => handleProductSelect(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm bg-white"
                  style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                >
                  <option value="">Selecionar do catálogo (opcional)...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
                <Input value={itemNome} onChange={e => setItemNome(e.target.value)} placeholder="Ou digite o nome do item *" />
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label style={{ ...labelStyle, marginBottom: 2 }}>Qtd</label>
                    <Input type="number" min="0.01" step="any" value={itemQtd} onChange={e => setItemQtd(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, marginBottom: 2 }}>Preço unit. (R$)</label>
                    <Input value={itemPreco} onChange={e => setItemPreco(e.target.value)} placeholder="0,00" inputMode="decimal" />
                  </div>
                  <div className="flex items-end">
                    <Button type="button" onClick={addItem} className="w-full">+ Adicionar</Button>
                  </div>
                </div>
              </div>
            </div>

            {itens.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-muted)' }}>Nenhum item adicionado.</p>
            ) : (
              <div className="space-y-2">
                {itens.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 px-3 py-2 rounded-lg border" style={{ borderColor: 'var(--color-bg-surface)' }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{item.nome}</p>
                    </div>
                    <input type="number" min="0.01" step="any" value={item.qtd}
                      onChange={e => updateItemQtd(idx, e.target.value)}
                      className="w-16 px-2 py-1 rounded border text-sm text-center"
                      style={{ borderColor: 'var(--color-bg-surface)' }}
                    />
                    <input type="text" value={item.preco_unitario}
                      onChange={e => updateItemPreco(idx, e.target.value)}
                      className="w-24 px-2 py-1 rounded border text-sm text-right"
                      style={{ borderColor: 'var(--color-bg-surface)' }}
                    />
                    <span className="w-24 text-right text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      {formatBRL(item.subtotal)}
                    </span>
                    <button type="button" onClick={() => removeItem(idx)}
                      className="text-sm hover:text-red-500 transition-colors flex-shrink-0"
                      style={{ color: 'var(--color-text-muted)' }}
                    >✕</button>
                  </div>
                ))}

                {/* Resumo financeiro */}
                <div className="pt-2 border-t space-y-1" style={{ borderColor: 'var(--color-bg-surface)' }}>
                  <div className="flex justify-between text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    <span>Subtotal</span><span>{formatBRL(subtotalItens)}</span>
                  </div>
                  {descontoVal > 0 && (
                    <div className="flex justify-between text-sm" style={{ color: '#C0392B' }}>
                      <span>Desconto</span><span>-{formatBRL(descontoVal)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
                    <span>Total</span><span>{formatBRL(valorTotal)}</span>
                  </div>
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
          <Button type="submit" loading={loading}>{isEdit ? 'Salvar alterações' : 'Criar pedido'}</Button>
        </div>
      </form>
    </Modal>
  )
}
