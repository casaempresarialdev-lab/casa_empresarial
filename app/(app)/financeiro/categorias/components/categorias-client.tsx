'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { SummaryCard } from '@/components/modules/dashboard/summary-card'
import { AddButton } from '@/components/ui/add-button'
import { StatusBadge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FilterResult, SearchField } from '@/components/ui/filter-select'
import { Tabs } from '@/components/ui/form-steps'
import { ListEmpty, ListItem } from '@/components/ui/list-item'
import { toast } from '@/lib/toast'
import { deleteCategoryAction } from '../actions'
import type { Category } from '../queries'
import { ModalCategoria } from './modal-categoria'

interface Props {
  categories: Category[]
  companyId: string
  /** true quando renderizado dentro de uma aba de Configurações — esconde o título/breadcrumb próprio */
  embedded?: boolean
}

function buildTree(categories: Category[], tipo: 'receita' | 'despesa') {
  const roots = categories.filter((c) => c.tipo === tipo && c.parent_id === null)
  const children = categories.filter((c) => c.tipo === tipo && c.parent_id !== null)
  return roots.flatMap((r) => [
    { category: r, indent: false },
    ...children.filter((c) => c.parent_id === r.id).map((c) => ({ category: c, indent: true })),
  ])
}

// Categorias de receita e despesa, usadas no Fluxo de Caixa e agrupadas no DRE
export function CategoriasClient({ categories, companyId, embedded }: Props) {
  const router = useRouter()
  const [aba, setAba] = useState(0)
  const [busca, setBusca] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [excluir, setExcluir] = useState<Category | null>(null)
  const [excluindo, setExcluindo] = useState(false)

  const tipoAtual: 'receita' | 'despesa' = aba === 0 ? 'receita' : 'despesa'
  const naoClassificadas = categories.filter((c) => c.dre_grupo === 'nao_classificado').length

  const q = busca.trim().toLowerCase()
  const itens = buildTree(categories, tipoAtual).filter(({ category: c }) => !q || c.nome.toLowerCase().includes(q))

  function abrirNovo() { setEditing(null); setModalOpen(true) }
  function abrirEdicao(c: Category) { setEditing(c); setModalOpen(true) }

  function pedirExclusao(c: Category) {
    const temFilhos = categories.some((cat) => cat.parent_id === c.id)
    if (temFilhos) {
      toast.error(`"${c.nome}" tem subcategorias. Exclua-as primeiro.`)
      return
    }
    setExcluir(c)
  }

  async function confirmarExclusao() {
    if (!excluir) return
    setExcluindo(true)
    const r = await toast.promise(deleteCategoryAction(excluir.id), {
      loading: `Excluindo ${excluir.nome}…`,
      success: `Categoria ${excluir.nome} excluída.`,
      error: 'Não foi possível excluir a categoria.',
    })
    setExcluindo(false)
    setExcluir(null)
    if (!('error' in r)) router.refresh()
  }

  return (
    <>
      {!embedded && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>Categorias</h1>
          <Breadcrumb />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <SummaryCard icon="dollar" title="Categorias cadastradas" value={categories.length} caption={`${categories.filter((c) => c.tipo === 'receita').length} receitas · ${categories.filter((c) => c.tipo === 'despesa').length} despesas`} />
        <SummaryCard icon="check" title="Ativas" value={categories.filter((c) => c.ativo).length} caption="disponíveis nos lançamentos" delay={60} />
        <SummaryCard
          icon="info" title="Sem classificação no DRE" value={naoClassificadas} caption="não entram no relatório"
          accent={naoClassificadas ? 'yellow' : undefined} delay={120}
        />
      </div>

      <Tabs labels={['Receitas', 'Despesas']} step={aba} onSelect={setAba} />

      <div className="app-card p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {itens.length} {itens.length === 1 ? 'categoria' : 'categorias'} de {tipoAtual === 'receita' ? 'receita' : 'despesa'}
          </p>
          <AddButton onClick={abrirNovo} label={tipoAtual === 'receita' ? 'Nova receita' : 'Nova despesa'} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SearchField value={busca} onChange={setBusca} placeholder="Pesquisar por nome..." />
          {busca && <FilterResult total={itens.length} onClear={() => setBusca('')} />}
        </div>

        <ul className="flex flex-col gap-3">
          {itens.length === 0 && (
            <ListEmpty>
              {categories.length === 0
                ? `Crie a primeira categoria de ${tipoAtual === 'receita' ? 'receita' : 'despesa'}.`
                : 'Nenhuma categoria encontrada.'}
            </ListEmpty>
          )}
          {itens.map(({ category: c, indent }) => (
            <ListItem
              key={c.id}
              title={
                <span className="flex items-center gap-1.5">
                  {indent && <span style={{ color: 'var(--color-text-muted)' }}>↳</span>}
                  {c.icone && <span>{c.icone}</span>}
                  {c.nome}
                </span>
              }
              subtitle={c.dre_grupo === 'nao_classificado' ? 'Sem classificação no DRE' : undefined}
              aside={<StatusBadge status={c.ativo ? 'active' : 'inactive'} />}
              onClick={() => abrirEdicao(c)}
              actionsLabel={c.nome}
              actions={[
                { icon: 'pencil', label: 'Editar', onClick: () => abrirEdicao(c) },
                { icon: 'trash', label: 'Excluir', tone: 'danger', onClick: () => pedirExclusao(c) },
              ]}
            />
          ))}
        </ul>
      </div>

      <ModalCategoria
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        companyId={companyId}
        category={editing}
        allCategories={categories}
        defaultTipo={tipoAtual}
      />

      <ConfirmDialog
        open={!!excluir}
        onClose={() => { if (!excluindo) setExcluir(null) }}
        onConfirm={confirmarExclusao}
        loading={excluindo}
        title="Excluir categoria"
        confirmLabel="Excluir"
        message={<p>Excluir <strong>{excluir?.nome}</strong>? Lançamentos que já usam esta categoria não são apagados.</p>}
      />
    </>
  )
}
