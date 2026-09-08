import type { PdvSaleItem } from '../actions'

interface Props {
  itens: PdvSaleItem[]
  subtotal: number
  desconto: number
  total: number
  formaPagamento: string
  troco: number
  clienteNome: string
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

export function Comprovante({ itens, subtotal, desconto, total, formaPagamento, troco, clienteNome }: Props) {
  const agora = new Date()

  return (
    <div className="font-mono text-sm border rounded-lg p-4" style={{ borderColor: 'var(--color-bg-surface)' }}>
      <div className="text-center pb-2 mb-2 border-b border-dashed" style={{ borderColor: 'var(--color-bg-surface)' }}>
        <p className="font-bold">COMPROVANTE DE VENDA</p>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {agora.toLocaleDateString('pt-BR')} {agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </p>
        {clienteNome && <p className="text-xs mt-1">Cliente: {clienteNome}</p>}
      </div>

      <div className="space-y-1 pb-2 mb-2 border-b border-dashed" style={{ borderColor: 'var(--color-bg-surface)' }}>
        {itens.map((item, idx) => (
          <div key={idx} className="flex justify-between text-xs">
            <span>{item.qtd}x {item.nome}</span>
            <span>{formatBRL(item.subtotal)}</span>
          </div>
        ))}
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span>Subtotal</span><span>{formatBRL(subtotal)}</span>
        </div>
        {desconto > 0 && (
          <div className="flex justify-between text-xs">
            <span>Desconto</span><span>-{formatBRL(desconto)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold">
          <span>TOTAL</span><span>{formatBRL(total)}</span>
        </div>
        <div className="flex justify-between text-xs pt-1">
          <span>Forma de pagamento</span><span>{FORMA_LABELS[formaPagamento] ?? formaPagamento}</span>
        </div>
        {troco > 0 && (
          <div className="flex justify-between text-xs">
            <span>Troco</span><span>{formatBRL(troco)}</span>
          </div>
        )}
      </div>
    </div>
  )
}
