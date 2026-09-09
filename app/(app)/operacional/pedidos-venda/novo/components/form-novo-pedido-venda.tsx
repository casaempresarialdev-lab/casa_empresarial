'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createSaleOrderAction } from '../../actions'
import type { PedidoVendaItem } from '../../queries'

interface Props {
  companyId: string
  contacts: { id: string; nome: string; tipo: string }[]
  products: { id: string; nome: string; preco_venda: number | null; unidade_medida: string }[]
}

function formatBRL(val: number) {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function FormNovoPedidoVenda({ companyId, contacts, products }: Props) {
  const router = useRouter()

  const [clienteId, setClienteId] = useState('')
  const [data, setData] = useState(new Date().toISOString().slice(0, 10))
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

  function resetItemForm() {
    setItemProductId('')
    setItemNome('')
    setItemQtd('1')
    setItemPreco('')
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
    if (!itemProductId || !itemNome.trim()) return
    const qtd = parseFloat(itemQtd) || 1
    const preco = parseFloat(itemPreco.replace(',', '.')) || 0
    const subtotal = parseFloat((qtd * preco).toFixed(2))
    setItens(prev => [...prev, { product_id: itemProductId, nome: itemNome.trim(), qtd, preco_unitario: preco, subtotal }])
    resetItemForm()
  }

  function removeItem(idx: number) {
    setItens(prev => prev.filter((_, i) => i !== idx))
  }

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
    const result = await createSaleOrderAction(companyId, fd)
    setLoading(false)
    if ('error' in result) { setError(result.error ?? 'Erro ao salvar.'); return }
    router.push('/operacional/pedidos-venda')
  }

  const labelStyle: React.CSSProperties = { color: 'var(--color-text-secondary)', fontSize: '0.75rem', fontWeight: 500, marginBottom: 4, display: 'block' }
  const sectionTitle: React.CSSProperties = { color: 'var(--color-primary-darker)', fontSize: '0.8rem', fontWeight: 600, marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid var(--color-bg-surface)' }

  return (
    <form onSubmit={handleSubmit}>
      {/* Cabeçalho */}
      <div className="flex items-center gap-3 mb-6">
        <button type="button" onClick={() => router.push('/operacional/pedidos-venda')}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors" style={{ color: 'var(--color-text-muted)' }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 14L6 9l5-5" />
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>Novo Pedido de Venda</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Registrar venda para cliente</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Dados do Pedido */}
        <div className="rounded-xl border p-6" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
          <p style={sectionTitle}>Dados do Pedido</p>
          <div className="space-y-3">
            <div>
              <label style={labelStyle}>Cliente</label>
              <select value={clienteId} onChange={e => setClienteId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}>
                <option value="">Sem cliente</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.nome} ({c.tipo})</option>)}
              </select>
              {contacts.length === 0 && (
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Nenhum contato cadastrado. Cadastre em Financeiro → Contatos.</p>
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
                <select value={formaPagamento} onChange={e => setFormaPagamento(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}>
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
                <Input value={desconto} onChange={e => setDesconto(e.target.value)} placeholder="0,00" inputMode="decimal" />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}>
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
              <textarea value={observacao} onChange={e => setObservacao(e.target.value)} rows={3}
                placeholder="Instruções de entrega, condições..."
                className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
                style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }} />
            </div>
          </div>
        </div>

        {/* Itens do Pedido */}
        <div className="rounded-xl border p-6" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
          <p style={sectionTitle}>Itens do Pedido</p>

          {/* Adicionar item */}
          <div className="p-3 rounded-lg mb-3" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>Adicionar item</p>
            <div className="space-y-2">
              <select value={itemProductId} onChange={e => handleProductSelect(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm bg-white"
                style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}>
                <option value="">Selecionar produto do catálogo...</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
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

          {/* Lista */}
          {itens.length === 0 ? (
            <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-muted)' }}>Nenhum item adicionado.</p>
          ) : (
            <div className="space-y-2">
              {itens.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 px-3 py-2 rounded-lg border" style={{ borderColor: 'var(--color-bg-surface)' }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{item.nome}</p>
                  </div>
                  <input type="number" min="0.01" step="any" value={item.qtd} onChange={e => updateItemQtd(idx, e.target.value)}
                    className="w-16 px-2 py-1 rounded border text-sm text-center" style={{ borderColor: 'var(--color-bg-surface)' }} />
                  <input type="text" value={item.preco_unitario} onChange={e => updateItemPreco(idx, e.target.value)}
                    className="w-24 px-2 py-1 rounded border text-sm text-right" style={{ borderColor: 'var(--color-bg-surface)' }} />
                  <span className="w-24 text-right text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{formatBRL(item.subtotal)}</span>
                  <button type="button" onClick={() => removeItem(idx)}
                    className="text-sm hover:text-red-500 transition-colors flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>✕</button>
                </div>
              ))}
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

        {error && <p className="text-sm p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>{error}</p>}
      </div>

      {/* Rodapé */}
      <div className="flex gap-3 justify-end mt-4">
        <Button type="button" variant="ghost" onClick={() => router.push('/operacional/pedidos-venda')}>Cancelar</Button>
        <Button type="submit" loading={loading}>Criar Pedido</Button>
      </div>
    </form>
  )
}
