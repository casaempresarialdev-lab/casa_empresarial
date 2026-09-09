'use client'

import { useRouter } from 'next/navigation'
import type { PurchaseOrder } from '../queries'

const STATUS_LABELS: Record<string, string> = {
  rascunho: 'Rascunho',
  enviado: 'Enviado',
  confirmado: 'Confirmado',
  recebido: 'Recebido',
  cancelado: 'Cancelado',
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  rascunho:   { bg: '#F2F3F4', text: '#717D7E' },
  enviado:    { bg: '#EBF5FB', text: '#2471A3' },
  confirmado: { bg: '#FEF9E7', text: '#D4AC0D' },
  recebido:   { bg: '#E9F7EF', text: '#1E8449' },
  cancelado:  { bg: '#FDEDEC', text: '#C0392B' },
}

function formatBRL(val: number) {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(d: string | null) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function formatCnpj(cnpj: string | null | undefined) {
  if (!cnpj) return '—'
  const digits = cnpj.replace(/\D/g, '')
  if (digits.length === 14) {
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  }
  if (digits.length === 11) {
    return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  }
  return cnpj
}

interface Props {
  order: PurchaseOrder
  companyName: string
  companyCnpj: string
}

export function ViewPedidoCompra({ order, companyName, companyCnpj }: Props) {
  const router = useRouter()
  const colors = STATUS_COLORS[order.status] ?? { bg: '#F2F3F4', text: '#717D7E' }

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

  function handleDownloadPDF() {
    const win = window.open('', '_blank')
    if (!win) return

    const numPedido = `#${String(order.numero).padStart(3, '0')}`
    const fornNome = order.fornecedor?.nome ?? '—'
    const fornCnpj = formatCnpj(order.fornecedor?.cpf_cnpj)
    const fornTipo = order.fornecedor?.tipo === 'PJ' ? 'Razão Social' : 'Nome'

    const itensRows = order.itens.map(item => `
      <tr>
        <td>${item.nome}</td>
        <td style="text-align:center">${item.qtd}</td>
        <td style="text-align:right">${formatBRL(item.preco_unitario)}</td>
        <td style="text-align:right">${formatBRL(item.subtotal)}</td>
      </tr>`).join('')

    win.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Pedido de Compra ${numPedido}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #222; padding: 32px; max-width: 800px; margin: 0 auto; }
    h1 { font-size: 20px; font-weight: 700; margin-bottom: 2px; }
    h2 { font-size: 13px; font-weight: 600; color: #444; margin-bottom: 16px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 2px solid #222; padding-bottom: 16px; }
    .company-block { }
    .company-name { font-size: 16px; font-weight: 700; }
    .company-cnpj { font-size: 11px; color: #555; margin-top: 2px; }
    .doc-title { text-align: right; }
    .doc-num { font-size: 22px; font-weight: 700; color: #1a3a6b; }
    .doc-status { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; background: #e8f4fd; color: #1a3a6b; margin-top: 4px; }
    .section { margin-bottom: 20px; }
    .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #888; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 10px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; }
    .field-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: #888; margin-bottom: 2px; }
    .field-value { font-size: 12px; color: #222; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f5f5f5; text-align: left; padding: 6px 8px; font-size: 11px; font-weight: 600; border-bottom: 1px solid #ddd; }
    th:not(:first-child) { text-align: right; }
    td { padding: 6px 8px; border-bottom: 1px solid #eee; font-size: 12px; }
    .total-row { font-weight: 700; font-size: 13px; border-top: 2px solid #222; }
    .total-row td { padding-top: 8px; border-bottom: none; }
    .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 10px; color: #aaa; text-align: center; }
    @media print {
      body { padding: 16px; }
      button { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="company-block">
      <div class="company-name">${companyName || 'Empresa'}</div>
      ${companyCnpj ? `<div class="company-cnpj">CNPJ: ${formatCnpj(companyCnpj)}</div>` : ''}
    </div>
    <div class="doc-title">
      <div style="font-size:11px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:.06em">Pedido de Compra</div>
      <div class="doc-num">${numPedido}</div>
      <div class="doc-status">${STATUS_LABELS[order.status]}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Fornecedor</div>
    <div class="grid">
      <div>
        <div class="field-label">${fornTipo}</div>
        <div class="field-value">${fornNome}</div>
      </div>
      <div>
        <div class="field-label">CNPJ / CPF</div>
        <div class="field-value">${fornCnpj}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Dados do Pedido</div>
    <div class="grid">
      <div>
        <div class="field-label">Data do Pedido</div>
        <div class="field-value">${formatDate(order.data)}</div>
      </div>
      <div>
        <div class="field-label">Previsão de Entrega</div>
        <div class="field-value">${formatDate(order.data_entrega)}</div>
      </div>
      ${order.numero_nota ? `
      <div>
        <div class="field-label">Nº da Nota Fiscal</div>
        <div class="field-value">${order.numero_nota}</div>
      </div>` : ''}
      ${order.observacao ? `
      <div style="grid-column:1/-1">
        <div class="field-label">Observação</div>
        <div class="field-value">${order.observacao}</div>
      </div>` : ''}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Itens do Pedido</div>
    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th style="text-align:center">Qtd</th>
          <th style="text-align:right">Preço Unit.</th>
          <th style="text-align:right">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${itensRows}
      </tbody>
      <tfoot>
        <tr class="total-row">
          <td colspan="3" style="text-align:right">Total</td>
          <td style="text-align:right">${formatBRL(order.valor_total)}</td>
        </tr>
      </tfoot>
    </table>
  </div>

  <div class="footer">Documento gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>

  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`)
    win.document.close()
  }

  return (
    <div>
      {/* Cabeçalho */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/operacional/pedidos-compra')}
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
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Pedido de Compra</p>
        </div>
        <button
          onClick={handleDownloadPDF}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ backgroundColor: 'var(--color-primary-darker)', color: 'white' }}
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7.5 10V2M4 7l3.5 3.5L11 7" />
            <path d="M1 12h13" />
          </svg>
          Baixar PDF
        </button>
      </div>

      <div className="space-y-4">
        {/* Fornecedor */}
        <div className="rounded-xl border p-6" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
          <p style={sectionTitle}>Fornecedor</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <span style={fieldLabel}>{order.fornecedor?.tipo === 'PJ' ? 'Razão Social' : 'Nome'}</span>
              <span style={fieldValue}>{order.fornecedor?.nome ?? '—'}</span>
            </div>
            <div>
              <span style={fieldLabel}>CNPJ / CPF</span>
              <span style={fieldValue}>{formatCnpj(order.fornecedor?.cpf_cnpj)}</span>
            </div>
          </div>
        </div>

        {/* Dados */}
        <div className="rounded-xl border p-6" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
          <p style={sectionTitle}>Dados do Pedido</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <span style={fieldLabel}>Status</span>
              <span style={fieldValue}>{STATUS_LABELS[order.status]}</span>
            </div>
            <div>
              <span style={fieldLabel}>Nº da Nota Fiscal</span>
              <span style={fieldValue}>{order.numero_nota ?? '—'}</span>
            </div>
            <div>
              <span style={fieldLabel}>Data do Pedido</span>
              <span style={fieldValue}>{formatDate(order.data)}</span>
            </div>
            <div>
              <span style={fieldLabel}>Previsão de Entrega</span>
              <span style={fieldValue}>{formatDate(order.data_entrega)}</span>
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
              <div className="flex justify-end pt-3 mt-2 border-t" style={{ borderColor: 'var(--color-bg-surface)' }}>
                <span className="font-bold text-base" style={{ color: 'var(--color-text-primary)' }}>
                  Total: {formatBRL(order.valor_total)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
