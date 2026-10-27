'use client'

import { useEffect, useRef, useState } from 'react'
import { Icon } from './icon'
import { toast } from '@/lib/toast'

interface FileDropZoneProps {
  file?: File | null
  /** Recebe o arquivo escolhido (clique ou arrastar e soltar), já validado pelo tamanho */
  onFile?: (file: File) => void
  /** Modo vários arquivos: recebe todos os escolhidos (os grandes demais ficam de fora) */
  onFiles?: (files: File[]) => void
  maxBytes: number
  invalid?: boolean
  /** Texto auxiliar quando nenhum arquivo foi escolhido */
  hint?: string
  accept?: string
}

// Área de arquivo: clique para escolher ou arraste e solte (destaca enquanto o arquivo está por cima)
export function FileDropZone({ file = null, onFile, onFiles, maxBytes, invalid, hint = 'Qualquer formato', accept }: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const maxMb = Math.round(maxBytes / 1024 / 1024)
  const multiple = !!onFiles

  // Soltar o arquivo fora da área não faz o navegador abrir o arquivo (e sair da página)
  useEffect(() => {
    const block = (e: DragEvent) => e.preventDefault()
    window.addEventListener('dragover', block)
    window.addEventListener('drop', block)
    return () => {
      window.removeEventListener('dragover', block)
      window.removeEventListener('drop', block)
    }
  }, [])

  function pick(f: File | undefined | null) {
    if (!f) return
    if (f.size > maxBytes) {
      toast.error(`Arquivo muito grande. O máximo é ${maxMb} MB.`)
      return
    }
    onFile?.(f)
  }

  function pickMany(list: FileList | null | undefined) {
    const all = Array.from(list ?? [])
    const ok = all.filter((f) => f.size <= maxBytes)
    if (ok.length < all.length) toast.error(`${all.length - ok.length} arquivo(s) passam de ${maxMb} MB e ficaram de fora.`)
    if (ok.length) onFiles?.(ok)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    if (!dragging) setDragging(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    // Ignora quando o cursor só passou para um elemento de dentro da área
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const files = e.dataTransfer.files
    if (multiple) { pickMany(files); return }
    if (files.length > 1) toast.error('Solte um arquivo por vez. Só o primeiro foi considerado.')
    pick(files[0])
  }

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`w-full flex items-center gap-3 rounded-xl border-2 border-dashed px-4 py-5 text-left transition-colors ${
          dragging ? 'bg-[var(--color-brand-light)]' : invalid ? 'border-red-400 bg-red-50/40' : 'hover:bg-[var(--color-brand-light)]'
        }`}
        style={dragging
          ? { borderColor: 'var(--color-brand)' }
          : invalid ? undefined : { borderColor: file ? 'var(--color-brand)' : 'var(--color-card-border-hover)' }}
      >
        <span
          className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-transform ${dragging ? 'scale-110' : ''}`}
          style={dragging
            ? { backgroundColor: 'var(--color-brand)', color: '#fff' }
            : { backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}
        >
          <Icon name="file" size={20} />
        </span>
        <span className="flex-1 min-w-0 pointer-events-none">
          <span className="block text-sm font-medium truncate" style={{ color: file || dragging ? 'var(--color-text-primary)' : 'var(--color-sidebar-text)' }}>
            {multiple
              ? dragging ? 'Solte os arquivos aqui' : 'Arraste os arquivos para cá ou clique para selecionar'
              : dragging ? 'Solte o arquivo aqui' : file ? file.name : 'Arraste o arquivo para cá ou clique para selecionar'}
          </span>
          <span className="block text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {file && !dragging
              ? `${(file.size / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB · arraste outro ou clique para trocar`
              : `${hint} · até ${maxMb} MB${multiple ? ' cada' : ''}`}
          </span>
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => { if (multiple) pickMany(e.target.files); else pick(e.target.files?.[0]); e.target.value = '' }}
      />
    </>
  )
}
