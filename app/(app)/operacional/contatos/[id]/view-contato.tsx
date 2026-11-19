'use client'

import { useRouter } from 'next/navigation'
import type { Contact, PedidoDoContato } from '../queries'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { Icon } from '@/components/ui/icon'

function formatDoc(doc: string | null, tipo: 'PF' | 'PJ') {
  if (!doc) return '—'
  const d = doc.replace(/\D/g, '')
  if (tipo === 'PF') {
    if (d.length !== 11) return doc
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
  }
  if (d.length !== 14) return doc
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

function formatDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function Selo({ texto, fundo, cor }: { texto: string; fundo: string; cor: string }) {
  return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap" style={{ backgroundColor: fundo, color: cor }}>{texto}</span>
}

const PAPEL_SELO: Record<Contact['papel'], { texto: string; fundo: string; cor: string }> = {
  cliente: { texto: 'Cliente', fundo: '#DBEAFE', cor: '#1D4ED8' },
  fornecedor: { texto: 'Fornecedor', fundo: '#FEF3C7', cor: '#B45309' },
  ambos: { texto: 'Cliente e Fornecedor', fundo: '#F3F4F6', cor: '#6B7280' },
}

// Mesma paleta usada em pedidos-compra-client.tsx / pedidos-venda-client.tsx
const STATUS_COMPRA: Record<string, { texto: string; fundo: string; cor: string }> = {
  rascunho: { texto: 'Rascunho', fundo: '#F3F4F6', cor: '#6B7280' },
  enviado: { texto: 'Enviado', fundo: '#DBEAFE', cor: '#1D4ED8' },
  confirmado: { texto: 'Confirmado', fundo: '#FEF3C7', cor: '#B45309' },
  recebido: { texto: 'Recebido', fundo: '#DCFCE7', cor: '#15803D' },
  cancelado: { texto: 'Cancelado', fundo: '#FEE2E2', cor: '#B91C1C' },
}
const STATUS_VENDA: Record<string, { texto: string; fundo: string; cor: string }> = {
  rascunho: { texto: 'Rascunho', fundo: '#F3F4F6', cor: '#6B7280' },
  confirmado: { texto: 'Confirmado', fundo: '#DBEAFE', cor: '#1D4ED8' },
  em_producao: { texto: 'Em Produção', fundo: '#FEF3C7', cor: '#B45309' },
  enviado: { texto: 'Enviado', fundo: '#F3E8FF', cor: '#7E22CE' },
  entregue: { texto: 'Entregue', fundo: '#DCFCE7', cor: '#15803D' },
  cancelado: { texto: 'Cancelado', fundo: '#FEE2E2', cor: '#B91C1C' },
}

// Produtos que já apareceram em algum pedido deste contato — calculado a partir do histórico,
// sem precisar de nenhum cadastro manual de "quais produtos esse contato trabalha"
function produtosRelacionados(pedidosCompra: PedidoDoContato[], pedidosVenda: PedidoDoContato[]) {
  const mapa = new Map<string, { nome: string; vezes: number }>()
  for (const pedido of [...pedidosCompra, ...pedidosVenda]) {
    for (const item of pedido.itens ?? []) {
      const key = item.product_id ?? item.nome
      const atual = mapa.get(key)
      if (atual) atual.vezes += 1
      else mapa.set(key, { nome: item.nome, vezes: 1 })
    }
  }
  return [...mapa.values()].sort((a, b) => b.vezes - a.vezes)
}

interface Props {
  contact: Contact
  pedidosCompra: PedidoDoContato[]
  pedidosVenda: PedidoDoContato[]
}

export function ViewContato({ contact, pedidosCompra, pedidosVenda }: Props) {
  const router = useRouter()

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

  const endereco = contact.endereco ?? {}
  const enderecoFormatado = [
    endereco.logradouro && `${endereco.logradouro}${endereco.numero ? ', ' + endereco.numero : ''}`,
    endereco.complemento,
    endereco.bairro,
    endereco.cidade && `${endereco.cidade}${endereco.uf ? ' - ' + endereco.uf : ''}`,
    endereco.cep && `CEP: ${endereco.cep}`,
  ].filter(Boolean).join(' · ')

  const produtos = produtosRelacionados(pedidosCompra, pedidosVenda)

  const historico = [
    ...pedidosCompra.map((p) => ({ ...p, origem: 'compra' as const })),
    ...pedidosVenda.map((p) => ({ ...p, origem: 'venda' as const })),
  ].sort((a, b) => b.data.localeCompare(a.data))

  return (
    <div>
      {/* Cabeçalho */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/operacional/contatos')}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 14L6 9l5-5" />
          </svg>
        </button>
        {contact.foto_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={contact.foto_url} alt="" className="w-12 h-12 rounded-full object-cover shrink-0 border" style={{ borderColor: 'var(--color-bg-surface)' }} />
        ) : (
          <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-muted)' }}>
            <Icon name={contact.tipo === 'PJ' ? 'briefcase' : 'user'} size={20} />
          </div>
        )}
        <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>
            {contact.nome}
          </h1>
          <Selo {...PAPEL_SELO[contact.papel]} />
          <Breadcrumb />
        </div>
      </div>

      <div className="space-y-4">
        {/* Dados principais */}
        <div className="app-card p-6">
          <p style={sectionTitle}>Dados do Contato</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <span style={fieldLabel}>{contact.tipo === 'PF' ? 'CPF' : 'CNPJ'}</span>
              <span style={fieldValue}>{formatDoc(contact.cpf_cnpj, contact.tipo)}</span>
            </div>
            <div>
              <span style={fieldLabel}>Telefone</span>
              <span style={fieldValue}>{contact.telefone ?? '—'}</span>
            </div>
            <div className="col-span-2">
              <span style={fieldLabel}>E-mail</span>
              <span style={fieldValue}>{contact.email ?? '—'}</span>
            </div>
            {enderecoFormatado && (
              <div className="col-span-2">
                <span style={fieldLabel}>Endereço</span>
                <span style={fieldValue}>{enderecoFormatado}</span>
              </div>
            )}
            {contact.observacao && (
              <div className="col-span-2">
                <span style={fieldLabel}>Observação</span>
                <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{contact.observacao}</p>
              </div>
            )}
            {contact.tags && contact.tags.length > 0 && (
              <div className="col-span-2">
                <span style={fieldLabel}>Tags</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {contact.tags.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-secondary)' }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Produtos relacionados */}
        <div className="app-card p-6">
          <p style={sectionTitle}>Produtos Relacionados</p>
          {produtos.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Nenhum produto ainda — aparece aqui automaticamente quando esse contato entrar em um Pedido de Compra ou de Venda.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {produtos.map((p) => (
                <span
                  key={p.nome}
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{ backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-secondary)' }}
                >
                  {p.nome}{p.vezes > 1 ? ` · ${p.vezes}x` : ''}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Histórico de pedidos */}
        <div className="app-card p-6">
          <p style={sectionTitle}>Histórico de Pedidos</p>
          {historico.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Nenhum pedido de compra ou de venda com este contato ainda.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {historico.map((p) => {
                const selo = p.origem === 'compra' ? STATUS_COMPRA[p.status] : STATUS_VENDA[p.status]
                const href = p.origem === 'compra' ? `/operacional/pedidos-compra/${p.id}` : `/operacional/pedidos-venda/${p.id}`
                return (
                  <li key={`${p.origem}-${p.id}`}>
                    <button
                      onClick={() => router.push(href)}
                      className="w-full flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left hover:bg-gray-50/70 transition-colors"
                      style={{ borderColor: 'var(--color-card-border)' }}
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>
                          {p.origem === 'compra' ? 'Pedido de Compra' : 'Pedido de Venda'} #{String(p.numero).padStart(3, '0')}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{formatDate(p.data)}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>{formatBRL(p.valor_total)}</span>
                        {selo && <Selo {...selo} />}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Metadados */}
        <div className="app-card p-6">
          <p style={sectionTitle}>Informações do Cadastro</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <span style={fieldLabel}>Criado em</span>
              <span style={fieldValue}>{formatDate(contact.created_at)}</span>
            </div>
            <div>
              <span style={fieldLabel}>Atualizado em</span>
              <span style={fieldValue}>{formatDate(contact.updated_at)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
