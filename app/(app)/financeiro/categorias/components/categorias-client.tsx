'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ModalCategoria } from './modal-categoria'
import { deleteCategoryAction } from '../actions'
import type { Category } from '../queries'

interface Props {
  categories: Category[]
  companyId: string
}

function buildTree(categories: Category[], tipo: 'receita' | 'despesa') {
  const roots = categories.filter(c => c.tipo === tipo && c.parent_id === null)
  const children = categories.filter(c => c.tipo === tipo && c.parent_id !== null)
  return roots.map(r => ({ ...r, children: children.filter(c => c.parent_id === r.id) }))
}

interface CategoryRowProps {
  category: Category & { children?: Category[] }
  indent?: boolean
  onEdit: (c: Category) => void
  onDelete: (c: Category) => void
  deletingId: string | null
}

function CategoryRow({ category, indent, onEdit, onDelete, deletingId }: CategoryRowProps) {
  return (
    <>
      <tr className="border-t" style={{ borderColor: 'var(--color-bg-surface)' }}>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2" style={{ paddingLeft: indent ? '20px' : '0' }}>
            {indent && <span style={{ color: 'var(--color-text-muted)' }}>└</span>}
            {category.cor && (
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: category.cor }} />
            )}
            <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
              {category.icone && <span className="mr-1">{category.icone}</span>}
              {category.nome}
            </span>
          </div>
        </td>
        <td className="px-4 py-3">
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
            style={{
              backgroundColor: category.ativo ? '#E9F7EF' : '#F2F3F4',
              color: category.ativo ? '#1E8449' : '#717D7E',
            }}
          >
            {category.ativo ? 'Ativa' : 'Inativa'}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => onEdit(category)}>Editar</Button>
            <Button variant="danger" size="sm" loading={deletingId === category.id} onClick={() => onDelete(category)}>Excluir</Button>
          </div>
        </td>
      </tr>
      {category.children?.map(child => (
        <CategoryRow key={child.id} category={child} indent onEdit={onEdit} onDelete={onDelete} deletingId={deletingId} />
      ))}
    </>
  )
}

function SectionTable({
  tipo,
  tree,
  onEdit,
  onDelete,
  deletingId,
}: {
  tipo: 'receita' | 'despesa'
  tree: (Category & { children?: Category[] })[]
  onEdit: (c: Category) => void
  onDelete: (c: Category) => void
  deletingId: string | null
}) {
  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
      <div
        className="px-4 py-3 flex items-center gap-2 border-b"
        style={{
          borderColor: 'var(--color-bg-surface)',
          backgroundColor: tipo === 'receita' ? '#F0FFF4' : '#FFF5F5',
        }}
      >
        <span>{tipo === 'receita' ? '📈' : '📉'}</span>
        <span className="font-semibold text-sm capitalize" style={{ color: tipo === 'receita' ? '#1E8449' : '#C0392B' }}>
          {tipo === 'receita' ? 'Receitas' : 'Despesas'}
        </span>
        <span className="text-xs ml-1" style={{ color: 'var(--color-text-muted)' }}>
          ({tree.length} {tree.length === 1 ? 'categoria' : 'categorias'})
        </span>
      </div>
      <table className="w-full text-sm">
        <thead style={{ backgroundColor: 'var(--color-bg-surface)' }}>
          <tr>
            <th className="text-left px-4 py-2 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Nome</th>
            <th className="text-left px-4 py-2 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Status</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {tree.length === 0 && (
            <tr>
              <td colSpan={3} className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
                Nenhuma categoria de {tipo} cadastrada.
              </td>
            </tr>
          )}
          {tree.map(c => (
            <CategoryRow key={c.id} category={c} onEdit={onEdit} onDelete={onDelete} deletingId={deletingId} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function CategoriasClient({ categories, companyId }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [defaultTipo, setDefaultTipo] = useState<'receita' | 'despesa'>('despesa')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState('')

  const receitaTree = buildTree(categories, 'receita')
  const despesaTree = buildTree(categories, 'despesa')

  function openAdd(tipo: 'receita' | 'despesa') {
    setEditing(null)
    setDefaultTipo(tipo)
    setModalOpen(true)
  }
  function openEdit(c: Category) { setEditing(c); setModalOpen(true) }

  async function handleDelete(c: Category) {
    const hasChildren = categories.some(cat => cat.parent_id === c.id)
    if (hasChildren) {
      setDeleteError(`"${c.nome}" possui subcategorias. Exclua-as primeiro.`)
      return
    }
    if (!confirm(`Excluir "${c.nome}"? Esta ação não pode ser desfeita.`)) return
    setDeletingId(c.id)
    setDeleteError('')
    const result = await deleteCategoryAction(c.id)
    setDeletingId(null)
    if ('error' in result) setDeleteError(result.error ?? 'Erro ao excluir.')
    else router.refresh()
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
            Categorias
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Classifique receitas e despesas por categoria
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => openAdd('receita')}>+ Receita</Button>
          <Button onClick={() => openAdd('despesa')}>+ Despesa</Button>
        </div>
      </div>

      {deleteError && (
        <p className="text-sm mb-4 p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>{deleteError}</p>
      )}

      <div className="flex flex-col gap-4">
        <SectionTable tipo="receita" tree={receitaTree} onEdit={openEdit} onDelete={handleDelete} deletingId={deletingId} />
        <SectionTable tipo="despesa" tree={despesaTree} onEdit={openEdit} onDelete={handleDelete} deletingId={deletingId} />
      </div>

      <ModalCategoria
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        companyId={companyId}
        category={editing}
        allCategories={categories}
        defaultTipo={defaultTipo}
      />
    </>
  )
}
