'use client'

import { useRef, useState } from 'react'
import { Icon } from '@/components/ui/icon'
import { toast } from '@/lib/toast'

interface Props {
  /** Prévia atual (link da foto salva ou objeto local) */
  preview: string | null
  onPick: (file: File) => void
  onRemove: () => void
  alt: string
  /** Tamanho máximo em MB (padrão 5) */
  maxMb?: number
  disabled?: boolean
}

// Prévia redonda da foto: clique ou arraste e solte uma imagem
export function FotoPicker({ preview, onPick, onRemove, alt, maxMb = 5, disabled }: Props) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function pickFile(file: File | undefined) {
    if (!file || disabled) return
    if (!file.type.startsWith('image/')) { toast.error('A foto precisa ser uma imagem.'); return }
    if (file.size > maxMb * 1024 * 1024) { toast.error(`A foto passa de ${maxMb} MB.`); return }
    onPick(file)
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files?.[0]) }}
        className="w-40 h-40 rounded-full overflow-hidden flex items-center justify-center border-2 border-dashed transition-colors"
        style={{
          borderColor: dragging ? 'var(--color-brand)' : 'var(--color-card-border)',
          backgroundColor: 'var(--color-brand-light)',
          color: 'var(--color-brand)',
        }}
        aria-label="Escolher foto"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={alt} className="w-full h-full object-cover" />
        ) : (
          <Icon name="user" size={56} />
        )}
      </button>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = '' }} />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-sm px-4 py-2 rounded-lg border transition-colors hover:bg-gray-50"
          style={{ borderColor: 'var(--color-card-border)', color: 'var(--color-sidebar-text)' }}
        >
          {preview ? 'Trocar foto' : 'Escolher foto'}
        </button>
        {preview && (
          <button type="button" onClick={onRemove} className="text-sm hover:underline" style={{ color: '#B91C1C' }}>
            Remover
          </button>
        )}
      </div>
      <span className="text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>Clique ou arraste uma imagem · JPG, PNG ou WEBP · até {maxMb} MB</span>
    </div>
  )
}
