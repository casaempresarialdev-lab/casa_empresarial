'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ModalCheckout } from './modal-checkout'
import { ModalFecharCaixa } from './modal-fechar-caixa'
import type { CashSession, PdvProduct } from '../queries'
import type { PdvSaleItem } from '../actions'

interface Props {
  companyId: string
  cashSession: CashSession
  products: PdvProduct[]
}

function formatBRL(val: number) {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function PDVClient({ companyId, cashSession, products }: Props) {
  const router = useRouter()
  const [busca, setBusca] = useState('')
  const [carrinho, setCarrinho] = useState<PdvSaleItem[]>([])
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [fecharCaixaOpen, setFecharCaixaOpen] = useState(false)

  const produtosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return products
    return products.filter(p =>
      p.nome.toLowerCase().includes(termo) ||
      p.sku?.toLowerCase().includes(termo) ||
      p.codigo_barras?.toLowerCase().includes(termo)
    )
  }, [busca, products])

  const subtotal = carrinho.reduce((sum, i) => sum + i.subtotal, 0)

  function addToCart(p: PdvProduct) {
    if (p.preco_venda === null) return
    const precoVenda = p.preco_venda
    setCarrinho(prev => {
      const existing = prev.find(i => i.product_id === p.id)
      if (existing) {
        return prev.map(i => i.product_id === p.id
          ? { ...i, qtd: i.qtd + 1, subtotal: parseFloat(((i.qtd + 1) * i.preco_unitario).toFixed(2)) }
          : i
        )
      }
      return [...prev, {
        product_id: p.id,
        nome: p.nome,
        qtd: 1,
        preco_unitario: precoVenda,
        subtotal: precoVenda,
        tipo: p.tipo,
      }]
    })
  }

  function updateQtd(productId: string, qtd: number) {
    if (qtd <= 0) {
      setCarrinho(prev => prev.filter(i => i.product_id !== productId))
      return
    }
    setCarrinho(prev => prev.map(i => i.product_id === productId
      ? { ...i, qtd, subtotal: parseFloat((qtd * i.preco_unitario).toFixed(2)) }
      : i
    ))
  }

  function removeItem(productId: string) {
    setCarrinho(prev => prev.filter(i => i.product_id !== productId))
  }

  function handleSaleComplete() {
    setCarrinho([])
    setCheckoutOpen(false)
    router.refresh()
  }

  function handleCaixaFechado() {
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg-default)' }}>
      {/* Header do PDV */}
      <div className="flex items-center justify-between px-4 md:px-6 h-16 border-b shrink-0" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
        <div>
          <h1 className="text-lg font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
            Frente de Caixa
          </h1>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Caixa aberto às {new Date(cashSession.opened_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <Button variant="secondary" onClick={() => setFecharCaixaOpen(true)}>Fechar Caixa</Button>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Grid de produtos */}
        <div className="flex-1 p-4 overflow-y-auto">
          <Input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar produto por nome, SKU ou código de barras..."
            className="mb-4"
            autoFocus
          />

          {produtosFiltrados.length === 0 ? (
            <p className="text-center py-10 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Nenhum produto encontrado.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {produtosFiltrados.map(p => {
                const semEstoque = p.tipo === 'produto' && p.estoque_atual <= 0
                return (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    disabled={p.preco_venda === null || semEstoque}
                    className="text-left p-3 rounded-xl border bg-white transition-all hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ borderColor: 'var(--color-bg-surface)', minHeight: 88 }}
                  >
                    <p className="text-sm font-medium leading-tight line-clamp-2" style={{ color: 'var(--color-text-primary)' }}>
                      {p.nome}
                    </p>
                    <p className="text-sm font-bold mt-1.5" style={{ color: 'var(--color-primary-darker)' }}>
                      {p.preco_venda !== null ? formatBRL(p.preco_venda) : 'Sem preço'}
                    </p>
                    {p.tipo === 'produto' && (
                      <p className="text-xs mt-0.5" style={{ color: semEstoque ? '#C0392B' : 'var(--color-text-muted)' }}>
                        {semEstoque ? 'Sem estoque' : `${p.estoque_atual} ${p.unidade_medida} em estoque`}
                      </p>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Carrinho */}
        <div className="w-full md:w-96 border-t md:border-t-0 md:border-l flex flex-col shrink-0" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-bg-surface)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              Carrinho {carrinho.length > 0 && `(${carrinho.length})`}
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3" style={{ maxHeight: 400 }}>
            {carrinho.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
                Toque em um produto pra adicionar
              </p>
            ) : (
              <div className="space-y-2">
                {carrinho.map(item => (
                  <div key={item.product_id} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{item.nome}</p>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{formatBRL(item.preco_unitario)} un.</p>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={item.qtd}
                      onChange={e => updateQtd(item.product_id as string, parseInt(e.target.value) || 0)}
                      className="w-14 px-1 py-1 rounded border text-sm text-center"
                      style={{ borderColor: 'var(--color-bg-surface)' }}
                    />
                    <span className="w-20 text-right text-sm font-medium shrink-0" style={{ color: 'var(--color-text-primary)' }}>
                      {formatBRL(item.subtotal)}
                    </span>
                    <button
                      onClick={() => removeItem(item.product_id as string)}
                      className="text-sm shrink-0 hover:text-red-500 transition-colors"
                      style={{ color: 'var(--color-text-muted)' }}
                    >✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="px-4 py-4 border-t space-y-3" style={{ borderColor: 'var(--color-bg-surface)' }}>
            <div className="flex justify-between text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>
              <span>Total</span>
              <span>{formatBRL(subtotal)}</span>
            </div>
            <Button
              className="w-full"
              size="lg"
              disabled={carrinho.length === 0}
              onClick={() => setCheckoutOpen(true)}
            >
              Finalizar Venda
            </Button>
          </div>
        </div>
      </div>

      <ModalCheckout
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        companyId={companyId}
        itens={carrinho}
        subtotal={subtotal}
        onComplete={handleSaleComplete}
      />

      <ModalFecharCaixa
        open={fecharCaixaOpen}
        onClose={() => setFecharCaixaOpen(false)}
        cashSession={cashSession}
        onFechado={handleCaixaFechado}
      />
    </div>
  )
}
