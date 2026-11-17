'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { SummaryCard } from '@/components/modules/dashboard/summary-card'
import { AddButton } from '@/components/ui/add-button'
import { StatusBadge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FilterResult, FilterSelect, SearchField } from '@/components/ui/filter-select'
import { ListEmpty, ListItem } from '@/components/ui/list-item'
import { toast } from '@/lib/toast'
import { deleteProductAction, toggleProductAtivoAction } from '../actions'
import type { Product } from '../queries'
import { ModalProduto } from './modal-produto'

function formatBRL(val: number | null) {
  if (val === null) return '—'
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const FILTRO_TIPO = [
  { value: 'todos', label: 'Produto e Serviço' },
  { value: 'produto', label: 'Produto' },
  { value: 'servico', label: 'Serviço' },
]
const FILTRO_STATUS = [
  { value: 'todos', label: 'Ativos e Inativos' },
  { value: 'ativo', label: 'Somente ativos' },
  { value: 'inativo', label: 'Somente inativos' },
]

interface Props {
  products: Product[]
  companyId: string
}

// Catálogo de produtos e serviços, usado nos Pedidos de Compra/Venda e na Frente de Caixa
export function ProdutosClient({ products, companyId }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [excluir, setExcluir] = useState<Product | null>(null)
  const [excluindo, setExcluindo] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroStatus, setFiltroStatus] = useState('todos')

  const q = busca.trim().toLowerCase()
  const visiveis = products
    .filter((p) => filtroTipo === 'todos' || p.tipo === filtroTipo)
    .filter((p) => filtroStatus === 'todos' || (filtroStatus === 'ativo' ? p.ativo : !p.ativo))
    .filter((p) => !q || p.nome.toLowerCase().includes(q) || (p.sku ?? '').toLowerCase().includes(q) || (p.categoria ?? '').toLowerCase().includes(q) || (p.codigo_barras ?? '').includes(q))

  const totalProdutos = products.filter((p) => p.tipo === 'produto').length
  const totalServicos = products.filter((p) => p.tipo === 'servico').length
  const estoqueBaixo = products.filter((p) => p.tipo === 'produto' && p.estoque_atual <= p.estoque_minimo && p.ativo).length

  function abrirNovo() { setEditingProduct(null); setModalOpen(true) }
  function abrirEdicao(p: Product) { setEditingProduct(p); setModalOpen(true) }

  async function handleToggleAtivo(p: Product) {
    setTogglingId(p.id)
    const r = await toast.promise(toggleProductAtivoAction(p.id, !p.ativo), {
      loading: p.ativo ? 'Desativando…' : 'Ativando…',
      success: p.ativo ? `${p.nome} desativado.` : `${p.nome} ativado.`,
      error: 'Não foi possível atualizar o item.',
    })
    setTogglingId(null)
    if (!('error' in r)) router.refresh()
  }

  async function confirmarExclusao() {
    if (!excluir) return
    setExcluindo(true)
    const r = await toast.promise(deleteProductAction(excluir.id), {
      loading: `Excluindo ${excluir.nome}…`,
      success: `${excluir.nome} excluído.`,
      error: 'Não foi possível excluir o item.',
    })
    setExcluindo(false)
    setExcluir(null)
    if (!('error' in r)) router.refresh()
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>Produtos e Serviços</h1>
        <Breadcrumb />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <SummaryCard icon="briefcase" title="Produtos" value={totalProdutos} caption="itens com controle de estoque" />
        <SummaryCard icon="file" title="Serviços" value={totalServicos} caption="sem controle de estoque" delay={60} />
        <SummaryCard icon="info" title="Estoque baixo" value={estoqueBaixo} caption="no mínimo ou abaixo" accent={estoqueBaixo ? 'red' : undefined} delay={120} />
      </div>

      <div className="app-card p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {products.length} {products.length === 1 ? 'item cadastrado' : 'itens cadastrados'}
          </p>
          <AddButton onClick={abrirNovo} label="Novo item" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SearchField value={busca} onChange={setBusca} placeholder="Pesquisar por nome, SKU, categoria ou cód. barras..." />
          <FilterSelect value={filtroTipo} onChange={setFiltroTipo} label="Filtrar por tipo" options={FILTRO_TIPO} />
          <FilterSelect value={filtroStatus} onChange={setFiltroStatus} label="Filtrar por status" options={FILTRO_STATUS} />
          {(busca || filtroTipo !== 'todos' || filtroStatus !== 'todos') && (
            <FilterResult total={visiveis.length} onClear={() => { setBusca(''); setFiltroTipo('todos'); setFiltroStatus('todos') }} />
          )}
        </div>

        <ul className="flex flex-col gap-3">
          {visiveis.length === 0 && (
            <ListEmpty>{products.length === 0 ? 'Cadastre o primeiro produto ou serviço.' : 'Nenhum resultado encontrado.'}</ListEmpty>
          )}
          {visiveis.map((p) => {
            const estoqueCritico = p.tipo === 'produto' && p.estoque_atual <= p.estoque_minimo
            return (
              <ListItem
                key={p.id}
                media={p.foto_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.foto_url} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                ) : undefined}
                icon={p.foto_url ? undefined : (p.tipo === 'produto' ? 'briefcase' : 'file')}
                title={p.nome}
                subtitle={[
                  p.categoria,
                  p.sku && `SKU ${p.sku}`,
                  p.tipo === 'produto' ? `${p.estoque_atual} ${p.unidade_medida} em estoque${estoqueCritico ? ' ⚠️' : ''}` : 'Serviço',
                ].filter(Boolean).join(' · ')}
                aside={
                  <>
                    <span className="text-sm font-semibold tabular-nums whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>{formatBRL(p.preco_venda)}</span>
                    <StatusBadge status={p.ativo ? 'active' : 'inactive'} />
                  </>
                }
                onClick={() => abrirEdicao(p)}
                actionsLabel={p.nome}
                actions={[
                  { icon: p.ativo ? 'eye-off' : 'eye', label: p.ativo ? 'Desativar' : 'Ativar', disabled: togglingId === p.id, onClick: () => handleToggleAtivo(p) },
                  { icon: 'pencil', label: 'Editar', onClick: () => abrirEdicao(p) },
                  { icon: 'trash', label: 'Excluir', tone: 'danger', onClick: () => setExcluir(p) },
                ]}
              />
            )
          })}
        </ul>
      </div>

      <ModalProduto open={modalOpen} onClose={() => setModalOpen(false)} companyId={companyId} product={editingProduct} />

      <ConfirmDialog
        open={!!excluir}
        onClose={() => { if (!excluindo) setExcluir(null) }}
        onConfirm={confirmarExclusao}
        loading={excluindo}
        title="Excluir item"
        confirmLabel="Excluir"
        message={<p>Excluir <strong>{excluir?.nome}</strong>? Pedidos que já usam este item não são apagados.</p>}
      />
    </>
  )
}
