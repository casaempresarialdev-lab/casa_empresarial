'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { CUSTOM_TYPE_LABELS, AREA_ICON_OPTIONS, type CustomItemType } from '@/lib/menu/catalog'

export type ItemMenuMode =
  | { kind: 'nova-area' }
  | { kind: 'adicionar'; areaId: string; areaLabel: string }
  | { kind: 'renomear'; itemId: string; currentLabel: string }
  | { kind: 'icone'; areaId: string; currentIcon: string }

interface Props {
  mode: ItemMenuMode | null
  onClose: () => void
  onCreateArea: (label: string) => Promise<void>
  onAddSubItem: (areaId: string, tipo: CustomItemType, label: string) => Promise<void>
  onRename: (itemId: string, label: string) => Promise<void>
  onChangeIcon: (areaId: string, icon: string) => Promise<void>
}

const CUSTOM_TYPES = Object.keys(CUSTOM_TYPE_LABELS) as CustomItemType[]

export function ModalItemMenu({ mode, onClose, onCreateArea, onAddSubItem, onRename, onChangeIcon }: Props) {
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<CustomItemType>('pasta')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!mode) return
    setError('')
    setTipo('pasta')
    setNome(mode.kind === 'renomear' ? mode.currentLabel : '')
  }, [mode])

  if (!mode) return null

  const title = mode.kind === 'nova-area' ? '+ Nova área'
    : mode.kind === 'adicionar' ? `Adicionar em ${mode.areaLabel}`
    : mode.kind === 'renomear' ? 'Renomear'
    : 'Alterar ícone'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!mode) return
    setLoading(true)
    setError('')
    try {
      if (mode.kind === 'nova-area') {
        if (!nome.trim()) { setLoading(false); return }
        await onCreateArea(nome.trim())
      } else if (mode.kind === 'adicionar') {
        if (!nome.trim()) { setLoading(false); return }
        await onAddSubItem(mode.areaId, tipo, nome.trim())
      } else if (mode.kind === 'renomear') {
        if (!nome.trim()) { setLoading(false); return }
        await onRename(mode.itemId, nome.trim())
      }
      onClose()
    } catch {
      setError('Não foi possível salvar. Tente de novo.')
    } finally {
      setLoading(false)
    }
  }

  async function handlePickIcon(icon: string) {
    if (!mode || mode.kind !== 'icone') return
    setLoading(true)
    try {
      await onChangeIcon(mode.areaId, icon)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={!!mode} onClose={onClose} title={title} className="max-w-sm">
      {mode.kind === 'icone' ? (
        <div className="flex flex-wrap gap-2">
          {AREA_ICON_OPTIONS.map(ic => (
            <button
              key={ic}
              type="button"
              disabled={loading}
              onClick={() => handlePickIcon(ic)}
              className="w-10 h-10 rounded-lg flex items-center justify-center text-lg border hover:bg-gray-50 disabled:opacity-50"
              style={{ borderColor: ic === mode.currentIcon ? 'var(--color-primary-darker)' : 'var(--color-bg-surface)' }}
            >
              {ic}
            </button>
          ))}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode.kind === 'adicionar' && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider mb-2 block" style={{ color: 'var(--color-text-muted)' }}>
                O que você quer adicionar?
              </label>
              <div className="flex gap-2 flex-wrap">
                {CUSTOM_TYPES.map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTipo(t)}
                    className="px-3 py-1.5 rounded-lg border text-sm transition-colors"
                    style={tipo === t
                      ? { backgroundColor: 'var(--color-primary)', borderColor: 'var(--color-primary-darker)', color: 'var(--color-primary-darker)' }
                      : { borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-secondary)' }
                    }
                  >
                    {CUSTOM_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider mb-2 block" style={{ color: 'var(--color-text-muted)' }}>
              {mode.kind === 'nova-area' ? 'Nome da área' : 'Nome'}
            </label>
            <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome..." autoFocus />
          </div>

          {error && (
            <p className="text-sm p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={loading}>
              {mode.kind === 'renomear' ? 'Salvar' : mode.kind === 'adicionar' ? 'Adicionar' : 'Criar'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
