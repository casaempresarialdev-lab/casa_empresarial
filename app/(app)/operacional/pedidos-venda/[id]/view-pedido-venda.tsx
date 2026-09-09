'use client'

import { useRouter } from 'next/navigation'
import type { SaleOrder } from '../queries'

const STATUS_LABELS: Record<string, string> = {
  rascunho: 'Rascunho',
  confirmado: 'Confirmado',
  em_producao: 'Em Produção',
  enviado: 'Enviado',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  rascunho:    { bg: '#F2F3F4', text: '#717D7E' },
  confirmado:  { bg: '#EBF5FB', text: '#2471A3' },
  em_producao: { bg: '#FEF9E7', text: '#D4AC0D' },
  enviado:     { bg: '#F4ECF7', text: '#8E44AD' },
  entregue:    { bg: '#E9F7EF', text: '#1E8449' },
  cancelado:   { bg: '#FDEDEC', text: '#C0392B' },
}

const FORMA_LABELS: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  credito: 'Cartão de Crédito',
  debito: 'Cartão de Débito',
  boleto: 'Boleto',
  outro: 'Outro',
}

function formatBRL(val: number) {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(d: string | null) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

interface Props { order: SaleOrder }

export function ViewPedidoVenda({ order }: Props) {
  const router = useRouter()
  const colors = STATUS_COLORS[order.status] ?? { bg: '#F2F3F4', text: '#717D7E' }

  const subtotalItens = order.itens.reduce((sum, i) => sum + i.subtotal, 0)

  const sectionTitle: React.CSSProperties = {
    color: 'var(--color-primary-darker)',
    fontSize: '0.8rem',
    fontWeight: 600,
    marginBottom: 12,
    paddingBottom: 6,
    borderBottom: '1px solid var(--color-bg-surface)',
  }

  const fieldLabel: React.CSSProperties = {
    color: 'var(--color-text-muted)',
    fontSize: '0.7rem',
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: 2,
    display: 'block',
  }

  const fieldValue: React.CSSProperties = {
    color: 'var(--color-text-primary)',
    fontSize: '0.875rem',
    fontWeight: 500,
  }

  return (
    <div>
      {/* Cabeçalho */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/operacional/pedidos-venda')}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 14L6 9l5-5" />
          </svg>
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
              Pedido #{String(order.numero).padStart(3, '0')}
            </h1>
            <span
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: colors.bg, color: colors.text }}
            >
              {STATUS_LABELS[order.status]}
            </span>
          </div>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Pedido de Venda</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Dados */}
        <div className="rounded-xl border p-6" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
          <p style={sectionTitle}>Dados do Pedido</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <span style={fieldLabel}>Cliente</span>
              <span style={fieldValue}>{order.cliente?.nome ?? '—'}</span>
            </div>
            <div>
              <span style={fieldLabel}>Status</span>
              <span style={fieldValue}>{STATUS_LABELS[order.status]}</span>
            </div>
            <div>
              <span style={fieldLabel}>Data do Pedido</span>
              <span style={fieldValue}>{formatDate(order.data)}</span>
            </div>
            <div>
              <span style={fieldLabel}>Previsão de Entrega</span>
              <span style={fieldValue}>{formatDate(order.data_entrega)}</span>
            </div>
            <div>
              <span style={fieldLabel}>Forma de Pagamento</span>
              <span style={fieldValue}>
                {order.forma_pagamento ? (FORMA_LABELS[order.forma_pagamento] ?? order.forma_pagamento) : '—'}
              </span>
            </div>
            <div>
              <span style={fieldLabel}>Desconto</span>
              <span style={fieldValue}>{order.desconto > 0 ? formatBRL(order.desconto) : '—'}</span>
            </div>
            {order.observacao && (
              <div className="col-span-2">
                <span style={fieldLabel}>Observação</span>
                <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{order.observacao}</p>
              </div>
            )}
          </div>
        </div>

        {/* Itens */}
        <div className="rounded-xl border p-6" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
          <p style={sectionTitle}>Itens do Pedido</p>
          {order.itens.length === 0 ? (
            <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-muted)' }}>Nenhum item.</p>
          ) : (
            <div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--color-bg-surface)' }}>
                    <th className="text-left pb-2 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Item</th>
                    <th className="text-right pb-2 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Qtd</th>
                    <th className="text-right pb-2 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Preço Unit.</th>
                    <th className="text-right pb-2 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {order.itens.map((item, idx) => (
                    <tr key={idx} className="border-b" style={{ borderColor: 'var(--color-bg-surface)' }}>
                      <td className="py-2.5" style={{ color: 'var(--color-text-primary)' }}>{item.nome}</td>
                      <td className="py-2.5 text-right" style={{ color: 'var(--color-text-secondary)' }}>{item.qtd}</td>
                      <td className="py-2.5 text-right" style={{ color: 'var(--color-text-secondary)' }}>{formatBRL(item.preco_unitario)}</td>
                      <td className="py-2.5 text-right font-medium" style={{ color: 'var(--color-text-primary)' }}>{formatBRL(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="pt-3 mt-2 border-t space-y-1.5" style={{ borderColor: 'var(--color-bg-surface)' }}>
                <div className="flex justify-between text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  <span>Subtotal</span><span>{formatBRL(subtotalItens)}</span>
                </div>
                {order.desconto > 0 && (
                  <div className="flex justify-between text-sm" style={{ color: '#C0392B' }}>
                    <span>Desconto</span><span>-{formatBRL(order.desconto)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base" style={{ color: 'var(--color-text-primary)' }}>
                  <span>Total</span><span>{formatBRL(order.valor_total)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
