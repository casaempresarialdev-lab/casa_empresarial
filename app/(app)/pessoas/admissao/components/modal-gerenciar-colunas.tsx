'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createStageAction, updateStageAction, deleteStageAction, moveStageAction } from '../actions'
import type { AdmissionStage } from '../queries'

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  stages: AdmissionStage[]
}

export function ModalGerenciarColunas({ open, onClose, companyId, stages }: Props) {
  const router = useRouter()
  const [novoLabel, setNovoLabel] = useState('')
  const [novoColor, setNovoColor] = useState('#818cf8')
  const [adding, setAdding] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!novoLabel.trim()) return
    setAdding(true)
    setError('')
    const result = await createStageAction(companyId, novoLabel, novoColor)
    setAdding(false)
    if ('error' in result) { setError(result.error ?? 'Erro ao criar coluna.'); return }
    setNovoLabel('')
    router.refresh()
  }

  async function handleRename(stage: AdmissionStage, label: string) {
    if (!label.trim() || label === stage.label) return
    setBusyId(stage.id)
    const result = await updateStageAction(stage.id, companyId, { label })
    setBusyId(null)
    if ('error' in result) setError(result.error ?? 'Erro ao renomear.')
    else router.refresh()
  }

  async function handleColor(stage: AdmissionStage, color: string) {
    setBusyId(stage.id)
    const result = await updateStageAction(stage.id, companyId, { color })
    setBusyId(null)
    if ('error' in result) setError(result.error ?? 'Erro ao trocar cor.')
    else router.refresh()
  }

  async function handleSetFinal(stage: AdmissionStage) {
    if (stage.is_final) return
    if (!confirm(`Marcar "${stage.label}" como a coluna final do fluxo?`)) return
    setBusyId(stage.id)
    const result = await updateStageAction(stage.id, companyId, { is_final: true })
    setBusyId(null)
    if ('error' in result) setError(result.error ?? 'Erro ao definir coluna final.')
    else router.refresh()
  }

  async function handleMove(stage: AdmissionStage, direction: 'left' | 'right') {
    setBusyId(stage.id)
    const result = await moveStageAction(companyId, stage.id, direction)
    setBusyId(null)
    if ('error' in result) setError(result.error ?? 'Erro ao mover.')
    else router.refresh()
  }

  async function handleDelete(stage: AdmissionStage) {
    if (!confirm(`Excluir a coluna "${stage.label}"?`)) return
    setBusyId(stage.id)
    setError('')
    const result = await deleteStageAction(stage.id, companyId)
    setBusyId(null)
    if ('error' in result) setError(result.error ?? 'Erro ao excluir.')
    else router.refresh()
  }

  const lbl: React.CSSProperties = { color: 'var(--color-text-secondary)', fontSize: '0.75rem', fontWeight: 500, marginBottom: 4, display: 'block' }

  return (
    <Modal open={open} onClose={onClose} title="Gerenciar colunas" description="Adicione, renomeie, recolorize, reordene ou exclua as etapas do fluxo">
      <div className="space-y-3">
        {stages.map((stage, idx) => (
          <div
            key={stage.id}
            className="flex items-center gap-2 p-2.5 rounded-lg border"
            style={{ borderColor: 'var(--color-bg-surface)', opacity: busyId === stage.id ? 0.5 : 1 }}
          >
            <input
              type="color"
              value={stage.color}
              onChange={e => handleColor(stage, e.target.value)}
              className="w-7 h-7 rounded cursor-pointer shrink-0 border-0"
              title="Cor da coluna"
            />
            <input
              defaultValue={stage.label}
              onBlur={e => handleRename(stage, e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              className="flex-1 min-w-0 text-sm px-2 py-1 rounded border"
              style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
            />
            {stage.is_final ? (
              <span className="text-xs px-2 py-1 rounded-full shrink-0" style={{ backgroundColor: '#E9F7EF', color: '#1E8449' }}>
                Final
              </span>
            ) : (
              <button
                type="button"
                onClick={() => handleSetFinal(stage)}
                className="text-xs px-2 py-1 rounded-full border shrink-0 hover:bg-gray-50"
                style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-muted)' }}
                title="Marcar como coluna final do fluxo"
              >
                Marcar final
              </button>
            )}
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                onClick={() => handleMove(stage, 'left')}
                disabled={idx === 0}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 disabled:opacity-25 text-sm"
                style={{ color: 'var(--color-text-muted)' }}
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => handleMove(stage, 'right')}
                disabled={idx === stages.length - 1}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 disabled:opacity-25 text-sm"
                style={{ color: 'var(--color-text-muted)' }}
              >
                →
              </button>
            </div>
            <button
              type="button"
              onClick={() => handleDelete(stage)}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 text-sm shrink-0"
              style={{ color: 'var(--color-error)' }}
              title="Excluir coluna"
            >
              🗑
            </button>
          </div>
        ))}

        <form onSubmit={handleAdd} className="flex items-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--color-bg-surface)' }}>
          <div className="flex-1">
            <label style={lbl}>Nova coluna</label>
            <Input value={novoLabel} onChange={e => setNovoLabel(e.target.value)} placeholder="Ex: Aguard. Exame Toxicológico" />
          </div>
          <input
            type="color"
            value={novoColor}
            onChange={e => setNovoColor(e.target.value)}
            className="w-10 h-10 rounded cursor-pointer border-0 shrink-0"
            title="Cor da nova coluna"
          />
          <Button type="submit" loading={adding}>+ Adicionar</Button>
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
