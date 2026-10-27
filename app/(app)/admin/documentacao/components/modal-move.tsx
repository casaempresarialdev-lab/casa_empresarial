'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { toast } from '@/lib/toast'
import { moveDocumentAction, moveFolderAction } from '../actions'
import { flattenFolders, folderParent, folderSubtree } from '../folder-tree'
import type { DocumentFolder } from '../queries'

// Valor do destino "raiz" no estado (null = nada escolhido ainda)
const RAIZ = ''

/** O que está sendo movido: um documento ou uma pasta */
export type MoveTarget =
  | { kind: 'document'; id: string; titulo: string; folderId: string | null }
  | { kind: 'folder'; folder: DocumentFolder }

interface Props {
  target: MoveTarget | null
  onClose: () => void
  companyId: string
  folders: DocumentFolder[]
}

// "Mover para": raiz ou qualquer pasta, em árvore. O lugar atual fica desativado;
// ao mover uma pasta, ela e as que estão dentro dela também.
export function ModalMove({ target, onClose, companyId, folders }: Props) {
  const router = useRouter()
  const [destino, setDestino] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => { if (target) setDestino(null) }, [target])

  const titulo = !target ? '' : target.kind === 'document' ? target.titulo : target.folder.nome
  const atual = !target
    ? RAIZ
    : target.kind === 'document'
      ? (target.folderId && folders.some((f) => f.id === target.folderId) ? target.folderId : RAIZ)
      : folderParent(folders, target.folder) ?? RAIZ
  const bloqueadas = target?.kind === 'folder' ? folderSubtree(folders, target.folder.id) : new Set<string>()

  const opcoes = [
    { id: RAIZ, nome: 'Raiz da Documentação', depth: 0, raiz: true },
    ...flattenFolders(folders).map(({ folder, depth }) => ({ id: folder.id, nome: folder.nome, depth: depth + 1, raiz: false })),
  ]

  async function handleMove() {
    if (!target || destino === null) return
    const nomeDestino = destino === RAIZ ? 'a raiz' : folders.find((f) => f.id === destino)?.nome
    setLoading(true)
    const action = target.kind === 'document'
      ? moveDocumentAction(target.id, companyId, destino || null)
      : moveFolderAction(target.folder.id, companyId, destino || null)
    const result = await toast.promise(action, {
      loading: `Movendo ${titulo}…`,
      success: `${titulo} foi movido para ${nomeDestino}.`,
      error: target.kind === 'document' ? 'Não foi possível mover o documento.' : 'Não foi possível mover a pasta.',
    })
    setLoading(false)
    if (!result.error) {
      onClose()
      router.refresh()
    }
  }

  return (
    <Modal open={!!target} onClose={onClose} title="Mover para" description={titulo}>
      <ul className="flex flex-col gap-1.5 max-h-[50vh] overflow-y-auto -mx-1 px-1">
        {opcoes.map((o) => {
          const isAtual = o.id === atual
          const dentroDela = bloqueadas.has(o.id)
          const selected = o.id === destino
          return (
            <li key={o.id || 'raiz'} style={{ paddingLeft: Math.min(o.depth, 6) * 20 }}>
              <button
                type="button"
                onClick={() => setDestino(o.id)}
                disabled={isAtual || dentroDela}
                className="w-full flex items-center gap-3 rounded-xl border px-4 py-2.5 text-left transition-colors enabled:hover:bg-gray-50 disabled:cursor-default disabled:opacity-50"
                style={{
                  borderColor: selected ? 'var(--color-brand)' : 'var(--color-card-border)',
                  backgroundColor: selected ? 'var(--color-brand-light)' : undefined,
                }}
              >
                <span className="shrink-0" style={{ color: 'var(--color-brand)' }}>
                  <Icon name={o.raiz ? 'grid' : 'folder'} size={18} />
                </span>
                <span className="flex-1 min-w-0 truncate text-sm font-semibold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
                  {o.nome}
                </span>
                {isAtual && <span className="text-xs shrink-0" style={{ color: 'var(--color-text-muted)' }}>Local atual</span>}
                {!isAtual && dentroDela && (
                  <span className="text-xs shrink-0" style={{ color: 'var(--color-text-muted)' }}>
                    {o.id === (target?.kind === 'folder' ? target.folder.id : '') ? 'Esta pasta' : 'Dentro desta pasta'}
                  </span>
                )}
                {selected && <span className="shrink-0 text-sm font-bold" style={{ color: 'var(--color-brand)' }} aria-hidden="true">✓</span>}
              </button>
            </li>
          )
        })}
      </ul>

      <div className="flex justify-end gap-2 pt-5">
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="button" onClick={handleMove} loading={loading} disabled={destino === null}>Mover</Button>
      </div>
    </Modal>
  )
}
