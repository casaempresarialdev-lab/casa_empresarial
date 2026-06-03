'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createCategoryAction, updateCategoryAction } from '../actions'
import type { Category } from '../queries'

const ICONE_OPTIONS = ['📦', '🏠', '🚗', '💡', '🍽️', '👕', '💊', '📱', '✈️', '🎓', '💼', '🔧', '📣', '💰', '🏦', '📊']
const COR_OPTIONS = ['#EF4444', '#F97316', '#EAB308', '#22C55E', '#14B8A6', '#3B82F6', '#8B5CF6', '#EC4899', '#6B7280', '#C19A6B']

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  category: Category | null
  allCategories: Category[]
  defaultTipo?: 'receita' | 'despesa'
}

export function ModalCategoria({ open, onClose, companyId, category, allCategories, defaultTipo = 'despesa' }: Props) {
  const router = useRouter()
  const isEdit = !!category

  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<'receita' | 'despesa'>(defaultTipo)
  const [parentId, setParentId] = useState('')
  const [cor, setCor] = useState('')
  const [icone, setIcone] = useState('')
  const [ativo, setAtivo] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setNome(category?.nome ?? '')
      setTipo(category?.tipo ?? defaultTipo)
      setParentId(category?.parent_id ?? '')
      setCor(category?.cor ?? '')
      setIcone(category?.icone ?? '')
      setAtivo(category?.ativo ?? true)
      setError('')
    }
  }, [open, category, defaultTipo])

  // Apenas categorias raiz (sem parent) do mesmo tipo, excluindo a própria categoria
  const parentOptions = allCategories.filter(
    c => c.tipo === tipo && c.parent_id === null && c.id !== category?.id
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const fd = new FormData()
    fd.set('nome', nome)
    fd.set('tipo', tipo)
    fd.set('parent_id', parentId)
    fd.set('cor', cor)
    fd.set('icone', icone)
    fd.set('ativo', String(ativo))

    const result = isEdit
      ? await updateCategoryAction(category.id, fd)
      : await createCategoryAction(companyId, fd)

    setLoading(false)
    if ('error' in result) { setError(result.error ?? 'Erro'); return }
    router.refresh()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar categoria' : 'Nova categoria'}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Tipo — só editável na criação */}
        {!isEdit && (
          <div className="flex gap-2">
            {(['receita', 'despesa'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => { setTipo(t); setParentId('') }}
                className="flex-1 py-2 rounded-lg text-sm font-medium border transition-colors capitalize"
                style={{
                  backgroundColor: tipo === t ? 'var(--color-primary)' : 'white',
                  borderColor: tipo === t ? 'var(--color-primary-dark)' : 'var(--color-bg-surface)',
                  color: tipo === t ? 'var(--color-primary-darker)' : 'var(--color-text-secondary)',
                }}
              >
                {t === 'receita' ? '📈 Receita' : '📉 Despesa'}
              </button>
            ))}
          </div>
        )}

        <Input
          label="Nome *"
          value={nome}
          onChange={e => setNome(e.target.value)}
          placeholder="Ex: Salários, Vendas, Aluguel..."
          required
        />

        {/* Categoria pai (opcional) */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            Categoria pai (opcional)
          </label>
          <select
            value={parentId}
            onChange={e => setParentId(e.target.value)}
            className="h-10 w-full rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C19A6B]"
            style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: 'white' }}
          >
            <option value="">Nenhuma (categoria raiz)</option>
            {parentOptions.map(p => (
              <option key={p.id} value={p.id}>{p.icone ? `${p.icone} ` : ''}{p.nome}</option>
            ))}
          </select>
        </div>

        {/* Ícone */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Ícone (opcional)</label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setIcone('')}
              className="w-8 h-8 rounded-lg border text-xs flex items-center justify-center transition-colors"
              style={{
                borderColor: !icone ? 'var(--color-primary-dark)' : 'var(--color-bg-surface)',
                backgroundColor: !icone ? 'var(--color-primary)' : 'white',
              }}
            >
              —
            </button>
            {ICONE_OPTIONS.map(ic => (
              <button
                key={ic}
                type="button"
                onClick={() => setIcone(ic)}
                className="w-8 h-8 rounded-lg border text-base flex items-center justify-center transition-colors"
                style={{
                  borderColor: icone === ic ? 'var(--color-primary-dark)' : 'var(--color-bg-surface)',
                  backgroundColor: icone === ic ? 'var(--color-primary)' : 'white',
                }}
              >
                {ic}
              </button>
            ))}
          </div>
        </div>

        {/* Cor */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Cor (opcional)</label>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setCor('')}
              className="w-7 h-7 rounded-full border-2 text-xs flex items-center justify-center"
              style={{ borderColor: !cor ? '#374151' : 'transparent', backgroundColor: '#E5E7EB' }}
            >
              —
            </button>
            {COR_OPTIONS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setCor(c)}
                className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                style={{ backgroundColor: c, borderColor: cor === c ? '#374151' : 'transparent' }}
              />
            ))}
          </div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer select-none">
          <div
            onClick={() => setAtivo(!ativo)}
            className="relative w-10 h-6 rounded-full transition-colors cursor-pointer"
            style={{ backgroundColor: ativo ? 'var(--color-primary-dark)' : '#D1D5DB' }}
          >
            <div
              className="absolute top-1 w-4 h-4 rounded-full bg-white transition-transform shadow"
              style={{ left: ativo ? '22px' : '4px' }}
            />
          </div>
          <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {ativo ? 'Ativa' : 'Inativa'}
          </span>
        </label>

        {error && (
          <p className="text-sm p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>{error}</p>
        )}

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading} className="flex-1">
            {isEdit ? 'Salvar' : 'Criar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
