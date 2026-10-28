'use client'

import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { FileDropZone } from '@/components/ui/file-drop-zone'

export const MAX_DOC_BYTES = 50 * 1024 * 1024

export interface QueueItem {
  key: string
  file: File
  descricao: string
}

export function formatSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
}

// Novos itens da fila: descrição começa com o nome do arquivo (sem extensão)
export function toQueueItems(files: File[]): QueueItem[] {
  return files.map((f) => ({
    key: `${f.name}-${f.size}-${f.lastModified}-${Math.random()}`,
    file: f,
    descricao: f.name.replace(/\.[^/.]+$/, ''),
  }))
}

interface Props {
  queue: QueueItem[]
  onChange: (queue: QueueItem[]) => void
  disabled?: boolean
  /** Enter numa descrição (ex.: enviar todos). Sem ele, o Enter segue o padrão do formulário. */
  onEnter?: () => void
}

// Área de soltar arquivos + fila de arquivos a enviar, cada um com descrição editável
export function DocumentosFila({ queue, onChange, disabled, onEnter }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <FileDropZone
        onFiles={(files) => onChange([...queue, ...toQueueItems(files)])}
        maxBytes={MAX_DOC_BYTES}
        hint="RG, CNH, comprovante de residência… (vários de uma vez)"
      />
      {queue.length > 0 && (
        <ul className="flex flex-col gap-2">
          {queue.map((q) => (
            <li key={q.key} className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <Input
                  aria-label={`Descrição de ${q.file.name}`}
                  value={q.descricao}
                  onChange={(e) => onChange(queue.map((x) => (x.key === q.key ? { ...x, descricao: e.target.value } : x)))}
                  onKeyDown={onEnter && ((e) => { if (e.key === 'Enter') { e.preventDefault(); onEnter() } })}
                  placeholder="Descrição (ex: RG, Comprovante de residência)"
                  disabled={disabled}
                />
                <p className="text-xs mt-1 truncate" style={{ color: 'var(--color-text-muted)' }}>
                  {q.file.name} · {formatSize(q.file.size)}
                </p>
              </div>
              <IconButton
                icon="trash"
                label={`Tirar ${q.file.name} da lista`}
                tone="danger"
                onClick={() => onChange(queue.filter((x) => x.key !== q.key))}
                disabled={disabled}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
