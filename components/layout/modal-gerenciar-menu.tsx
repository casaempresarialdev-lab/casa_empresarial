'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  createAreaAction, addSubItemAction, renameItemAction,
  changeAreaIconAction, deleteItemAction, moveItemAction,
} from '@/lib/menu/actions'
import { AREA_ICON_OPTIONS, CUSTOM_TYPE_LABELS, CUSTOM_TYPE_IMPLEMENTED, type CustomItemType } from '@/lib/menu/catalog'
import type { MenuArea } from '@/lib/menu/queries'

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  tree: MenuArea[]
}

const CUSTOM_TYPES = Object.keys(CUSTOM_TYPE_LABELS) as CustomItemType[]

export function ModalGerenciarMenu({ open, onClose, companyId, tree }: Props) {
  const router = useRouter()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [novaAreaLabel, setNovaAreaLabel] = useState('')
  const [addingArea, setAddingArea] = useState(false)
  const [iconPickerFor, setIconPickerFor] = useState<string | null>(null)
  const [subForm, setSubForm] = useState<Record<string, { tipo: CustomItemType; nome: string }>>({})

  function toggle(areaId: string) {
    setExpanded(prev => ({ ...prev, [areaId]: !prev[areaId] }))
  }

  async function run(id: string, fn: () => Promise<{ error?: string }>) {
    setBusyId(id)
    setError('')
    const result = await fn()
    setBusyId(null)
    if (result.error) setError(result.error)
    else router.refresh()
  }

  async function handleAddArea(e: React.FormEvent) {
    e.preventDefault()
    if (!novaAreaLabel.trim()) return
    setAddingArea(true)
    const result = await createAreaAction(companyId, novaAreaLabel)
    setAddingArea(false)
    if (result.error) { setError(result.error); return }
    setNovaAreaLabel('')
    router.refresh()
  }

  function subFormFor(areaId: string) {
    return subForm[areaId] ?? { tipo: 'pasta' as CustomItemType, nome: '' }
  }

  async function handleAddSub(areaId: string) {
    const f = subFormFor(areaId)
    if (!f.nome.trim()) return
    await run(areaId, async () => addSubItemAction(companyId, areaId, f.tipo, f.nome))
    setSubForm(prev => ({ ...prev, [areaId]: { tipo: 'pasta', nome: '' } }))
  }

  const lbl: React.CSSProperties = { color: 'var(--color-text-secondary)', fontSize: '0.75rem', fontWeight: 500, marginBottom: 4, display: 'block' }

  return (
    <Modal open={open} onClose={onClose} title="Gerenciar menu" description="Renomeie, reordene, troque o ícone ou adicione áreas e itens personalizados">
      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        {tree.map((area, areaIdx) => {
          const isExpanded = !!expanded[area.id]
          const canDeleteArea = area.natureza === 'personalizada'
          const f = subFormFor(area.id)

          return (
            <div key={area.id} className="rounded-lg border" style={{ borderColor: 'var(--color-bg-surface)', opacity: busyId === area.id ? 0.5 : 1 }}>
              <div className="flex items-center gap-2 p-2.5">
                <button type="button" onClick={() => toggle(area.id)} className="text-xs w-5 shrink-0" style={{ color: 'var(--color-text-muted)' }}>
                  {isExpanded ? '▾' : '▸'}
                </button>

                <button
                  type="button"
                  onClick={() => setIconPickerFor(iconPickerFor === area.id ? null : area.id)}
                  className="w-7 h-7 rounded flex items-center justify-center text-base shrink-0 hover:bg-gray-100"
                  title="Trocar ícone"
                >
                  {area.icon}
                </button>

                <input
                  defaultValue={area.displayLabel}
                  onBlur={e => { if (e.target.value.trim() && e.target.value !== area.displayLabel) run(area.id, () => renameItemAction(area.id, companyId, e.target.value)) }}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                  className="flex-1 min-w-0 text-sm px-2 py-1 rounded border font-medium"
                  style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                />

                {area.natureza === 'nativa' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-muted)' }}>
                    Método
                  </span>
                )}

                <div className="flex items-center gap-0.5 shrink-0">
                  <button type="button" onClick={() => run(area.id, () => moveItemAction(companyId, area.id, 'up'))} disabled={areaIdx === 0}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 disabled:opacity-25 text-sm" style={{ color: 'var(--color-text-muted)' }}>↑</button>
                  <button type="button" onClick={() => run(area.id, () => moveItemAction(companyId, area.id, 'down'))} disabled={areaIdx === tree.length - 1}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 disabled:opacity-25 text-sm" style={{ color: 'var(--color-text-muted)' }}>↓</button>
                </div>

                {canDeleteArea && (
                  <button
                    type="button"
                    onClick={() => { if (confirm(`Excluir a área "${area.displayLabel}" e todas as suas sub-áreas? Essa ação não pode ser desfeita.`)) run(area.id, () => deleteItemAction(area.id, companyId)) }}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 text-sm shrink-0"
                    style={{ color: 'var(--color-error)' }}
                  >🗑</button>
                )}
              </div>

              {iconPickerFor === area.id && (
                <div className="flex flex-wrap gap-1 px-2.5 pb-2.5">
                  {AREA_ICON_OPTIONS.map(ic => (
                    <button key={ic} type="button"
                      onClick={() => { run(area.id, () => changeAreaIconAction(area.id, companyId, ic)); setIconPickerFor(null) }}
                      className="w-7 h-7 rounded flex items-center justify-center text-base hover:bg-gray-100"
                    >{ic}</button>
                  ))}
                </div>
              )}

              {isExpanded && (
                <div className="pl-9 pr-2.5 pb-2.5 space-y-1.5">
                  {area.children.length === 0 && (
                    <p className="text-xs py-1" style={{ color: 'var(--color-text-muted)' }}>Nenhuma sub-área ainda.</p>
                  )}
                  {area.children.map((sub, subIdx) => (
                    <div key={sub.id} className="flex items-center gap-2" style={{ opacity: busyId === sub.id ? 0.5 : 1 }}>
                      <span className="text-sm shrink-0 w-5 text-center">{sub.icon || '•'}</span>
                      <input
                        defaultValue={sub.displayLabel}
                        onBlur={e => { if (e.target.value.trim() && e.target.value !== sub.displayLabel) run(sub.id, () => renameItemAction(sub.id, companyId, e.target.value)) }}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                        className="flex-1 min-w-0 text-sm px-2 py-1 rounded border"
                        style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                      />
                      {sub.natureza === 'personalizada' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-muted)' }}>
                          {CUSTOM_TYPE_LABELS[sub.tipo as CustomItemType]}
                          {!CUSTOM_TYPE_IMPLEMENTED[sub.tipo as CustomItemType] && ' · em breve'}
                        </span>
                      )}
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button type="button" onClick={() => run(sub.id, () => moveItemAction(companyId, sub.id, 'up'))} disabled={subIdx === 0}
                          className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 disabled:opacity-25 text-sm" style={{ color: 'var(--color-text-muted)' }}>↑</button>
                        <button type="button" onClick={() => run(sub.id, () => moveItemAction(companyId, sub.id, 'down'))} disabled={subIdx === area.children.length - 1}
                          className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 disabled:opacity-25 text-sm" style={{ color: 'var(--color-text-muted)' }}>↓</button>
                      </div>
                      {sub.natureza === 'personalizada' && (
                        <button
                          type="button"
                          onClick={() => { if (confirm(`Excluir "${sub.displayLabel}"? Essa ação não pode ser desfeita.`)) run(sub.id, () => deleteItemAction(sub.id, companyId)) }}
                          className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 text-sm shrink-0"
                          style={{ color: 'var(--color-error)' }}
                        >🗑</button>
                      )}
                    </div>
                  ))}

                  {/* Adicionar sub-área personalizada */}
                  <div className="flex items-center gap-2 pt-2">
                    <select
                      value={f.tipo}
                      onChange={e => setSubForm(prev => ({ ...prev, [area.id]: { ...f, tipo: e.target.value as CustomItemType } }))}
                      className="text-xs px-2 py-1.5 rounded border shrink-0"
                      style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                    >
                      {CUSTOM_TYPES.map(t => <option key={t} value={t}>{CUSTOM_TYPE_LABELS[t]}</option>)}
                    </select>
                    <input
                      value={f.nome}
                      onChange={e => setSubForm(prev => ({ ...prev, [area.id]: { ...f, nome: e.target.value } }))}
                      placeholder="Nome..."
                      className="flex-1 min-w-0 text-xs px-2 py-1.5 rounded border"
                      style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                    />
                    <Button type="button" size="sm" onClick={() => handleAddSub(area.id)} loading={busyId === area.id}>+ Adicionar</Button>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        <form onSubmit={handleAddArea} className="flex items-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--color-bg-surface)' }}>
          <div className="flex-1">
            <label style={lbl}>Nova área</label>
            <Input value={novaAreaLabel} onChange={e => setNovaAreaLabel(e.target.value)} placeholder="Ex: Projetos" />
          </div>
          <Button type="submit" loading={addingArea}>+ Nova área</Button>
        </form>

        {error && (
          <p className="text-sm p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>{error}</p>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
        </div>
      </div>
    </Modal>
  )
}
