'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ModalProduto } from './modal-produto'
import { deleteProductAction, toggleProductAtivoAction } from '../actions'
import type { Product } from '../queries'

interface Props {
  products: Product[]
  companyId: string
}

function formatBRL(val: number | null) {
  if (val === null) return '—'
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatMargem(val: number | null) {
  if (val === null) return '—'
  return `${val.toFixed(1)}%`
}

export function ProdutosClient({ products, companyId }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterTipo, setFilterTipo] = useState<'todos' | 'produto' | 'servico'>('todos')
  const [filterAtivo, setFilterAtivo] = useState<'todos' | 'ativo' | 'inativo'>('todos')

  const filtered = products.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = q
      ? p.nome.toLowerCase().includes(q) ||
        (p.sku ?? '').toLowerCase().includes(q) ||
        (p.categoria ?? '').toLowerCase().includes(q) ||
        (p.codigo_barras ?? '').includes(q)
      : true
    const matchTipo = filterTipo === 'todos' || p.tipo === filterTipo
    const matchAtivo =
      filterAtivo === 'todos' ||
      (filterAtivo === 'ativo' && p.ativo) ||
      (filterAtivo === 'inativo' && !p.ativo)
    return matchSearch && matchTipo && matchAtivo
  })

  const totalProdutos = products.filter(p => p.tipo === 'produto').length
  const totalServicos = products.filter(p => p.tipo === 'servico').length
  const estoqueBaixo = products.filter(p => p.tipo === 'produto' && p.estoque_atual <= p.estoque_minimo && p.ativo).length

  function openAdd() { setEditingProduct(null); setModalOpen(true) }
  function openEdit(p: Product) { setEditingProduct(p); setModalOpen(true) }

  async function handleToggleAtivo(p: Product) {
    setTogglingId(p.id)
    await toggleProductAtivoAction(p.id, !p.ativo)
    setTogglingId(null)
    router.refresh()
  }

  async function handleDelete(p: Product) {
    if (!confirm(`Excluir "${p.nome}"? Esta ação não pode ser desfeita.`)) return
    setDeletingId(p.id)
    const result = await deleteProductAction(p.id)
    setDeletingId(null)
    if ('error' in result) alert(result.error)
    else router.refresh()
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
            Produtos e Serviços
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Catálogo de itens para venda
          </p>
        </div>
        <Button onClick={openAdd}>Adicionar</Button>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="p-3 rounded-xl border text-center" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
          <div className="text-2xl font-bold" style={{ color: 'var(--color-primary-darker)' }}>{totalProdutos}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Produtos</div>
        </div>
        <div className="p-3 rounded-xl border text-center" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
          <div className="text-2xl font-bold" style={{ color: 'var(--color-primary-darker)' }}>{totalServicos}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Serviços</div>
        </div>
        <div
          className="p-3 rounded-xl border text-center"
          style={{
            borderColor: estoqueBaixo > 0 ? '#C0392B' : 'var(--color-bg-surface)',
            backgroundColor: estoqueBaixo > 0 ? '#FDEDEC' : 'white',
          }}
        >
          <div className="text-2xl font-bold" style={{ color: estoqueBaixo > 0 ? '#C0392B' : 'var(--color-primary-darker)' }}>
            {estoqueBaixo}
          </div>
          <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Estoque baixo</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <input
          type="text"
          placeholder="Buscar por nome, SKU, categoria ou cód. barras..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] px-4 py-2 rounded-lg border text-sm"
          style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white', color: 'var(--color-text-primary)' }}
        />
        <select
          value={filterTipo}
          onChange={e => setFilterTipo(e.target.value as typeof filterTipo)}
          className="px-3 py-2 rounded-lg border text-sm"
          style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white', color: 'var(--color-text-primary)' }}
        >
          <option value="todos">Produto e Serviço</option>
          <option value="produto">Produto</option>
          <option value="servico">Serviço</option>
        </select>
        <select
          value={filterAtivo}
          onChange={e => setFilterAtivo(e.target.value as typeof filterAtivo)}
          className="px-3 py-2 rounded-lg border text-sm"
          style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white', color: 'var(--color-text-primary)' }}
        >
          <option value="todos">Ativos e Inativos</option>
          <option value="ativo">Somente ativos</option>
          <option value="inativo">Somente inativos</option>
        </select>
      </div>

      <div className="rounded-xl border overflow-x-auto" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
        <table className="w-full min-w-[800px] text-sm">
          <thead style={{ backgroundColor: 'var(--color-bg-surface)' }}>
            <tr>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Nome</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>SKU</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Tipo</th>
              <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Preço Venda</th>
              <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Margem</th>
              <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Estoque</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-10" style={{ color: 'var(--color-text-muted)' }}>
                  {search || filterTipo !== 'todos' || filterAtivo !== 'todos'
                    ? 'Nenhum resultado encontrado.'
                    : 'Nenhum produto ou serviço cadastrado.'}
                </td>
              </tr>
            )}
            {filtered.map(p => {
              const estoqueCritico = p.tipo === 'produto' && p.estoque_atual <= p.estoque_minimo
              return (
                <tr key={p.id} className="border-t" style={{ borderColor: 'var(--color-bg-surface)', opacity: p.ativo ? 1 : 0.5 }}>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-primary)' }}>
                    <div className="font-medium">{p.nome}</div>
                    {p.categoria && (
                      <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{p.categoria}</div>
                    )}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>{p.sku ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: p.tipo === 'produto' ? '#EAF4F4' : '#F4ECF7',
                        color: p.tipo === 'produto' ? '#17A589' : '#8E44AD',
                      }}
                    >
                      {p.tipo === 'produto' ? 'Produto' : 'Serviço'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right" style={{ color: 'var(--color-text-primary)' }}>
                    {formatBRL(p.preco_venda)}
                  </td>
                  <td className="px-4 py-3 text-right" style={{ color: p.margem !== null && p.margem >= 0 ? '#1E8449' : '#C0392B' }}>
                    {formatMargem(p.margem)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {p.tipo === 'produto' ? (
                      <span
                        className="font-medium"
                        style={{ color: estoqueCritico ? '#C0392B' : 'var(--color-text-primary)' }}
                      >
                        {p.estoque_atual}
                        <span className="text-xs ml-1" style={{ color: 'var(--color-text-muted)' }}>{p.unidade_medida}</span>
                        {estoqueCritico && <span className="ml-1 text-xs">⚠️</span>}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleAtivo(p)}
                      disabled={togglingId === p.id}
                      className="relative w-9 h-5 rounded-full transition-colors flex-shrink-0"
                      style={{ backgroundColor: p.ativo ? 'var(--color-primary-dark)' : '#D1D5DB' }}
                      title={p.ativo ? 'Desativar' : 'Ativar'}
                    >
                      <span
                        className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all"
                        style={{ left: p.ativo ? '1.125rem' : '0.125rem' }}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>Editar</Button>
                      <Button variant="danger" size="sm" loading={deletingId === p.id} onClick={() => handleDelete(p)}>
                        Excluir
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <ModalProduto
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        companyId={companyId}
        product={editingProduct}
      />
    </>
  )
}
