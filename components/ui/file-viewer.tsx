'use client'

import { useEffect, useState } from 'react'
import { Modal } from './modal'
import { Button } from './button'
import { Icon } from './icon'

type Kind = 'image' | 'pdf' | 'video' | 'audio' | 'text' | 'other'

// O que o navegador consegue mostrar dentro do modal
function kindOf(tipo: string | null, nome: string): Kind {
  const t = tipo ?? ''
  if (t.startsWith('image/')) return 'image'
  if (t === 'application/pdf' || nome.toLowerCase().endsWith('.pdf')) return 'pdf'
  if (t.startsWith('video/')) return 'video'
  if (t.startsWith('audio/')) return 'audio'
  if (t.startsWith('text/') || t === 'application/json') return 'text'
  return 'other'
}

export interface ViewerFile {
  id: string
  /** Título exibido no topo (ex.: descrição do documento) */
  titulo: string
  /** Nome original do arquivo */
  nome: string
  tipo: string | null
}

interface Props {
  file: ViewerFile | null
  /** Gera o link temporário do arquivo para visualização */
  getUrl: (id: string) => Promise<{ url?: string; error?: string }>
  onClose: () => void
  onDownload: (file: ViewerFile) => void
  downloading: boolean
}

// Visualizador de arquivo em modal: mostra PDF, imagem, vídeo, áudio e texto; os demais oferecem download
export function FileViewer({ file, getUrl, onClose, onDownload, downloading }: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!file) return
    let cancelled = false
    setUrl(null)
    setError(null)
    getUrl(file.id).then((result) => {
      if (cancelled) return
      if (result.error || !result.url) setError(result.error ?? 'Não foi possível abrir o arquivo.')
      else setUrl(result.url)
    })
    return () => { cancelled = true }
    // getUrl costuma ser uma função inline: o efeito depende só do arquivo aberto
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file])

  const kind = file ? kindOf(file.tipo, file.nome) : 'other'

  return (
    <Modal open={!!file} onClose={onClose} title={file?.titulo ?? ''} description={file?.nome} className="sm:max-w-5xl">
      <div className="flex flex-col gap-4">
        <div
          className="rounded-xl border flex items-center justify-center overflow-hidden min-h-[50vh]"
          style={{ borderColor: 'var(--color-card-border)', backgroundColor: 'var(--color-bg-surface)' }}
        >
          {error ? (
            <p className="text-sm p-6 text-center" style={{ color: 'var(--color-error)' }}>{error}</p>
          ) : !url ? (
            // Carregando o link do arquivo
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="animate-spin" style={{ color: 'var(--color-brand)' }} aria-label="Carregando">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
              <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          ) : kind === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={file?.titulo} className="max-h-[70vh] max-w-full object-contain" />
          ) : kind === 'pdf' || kind === 'text' ? (
            <iframe src={url} title={file?.titulo} className="w-full h-[70vh] bg-white" />
          ) : kind === 'video' ? (
            <video src={url} controls className="max-h-[70vh] max-w-full" />
          ) : kind === 'audio' ? (
            <audio src={url} controls className="w-full max-w-md m-6" />
          ) : (
            // Formatos que o navegador não mostra (Word, Excel, ZIP…)
            <div className="flex flex-col items-center gap-3 p-8 text-center">
              <span className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}>
                <Icon name="file" size={28} />
              </span>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                Pré-visualização não disponível para este tipo de arquivo.
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Faça o download para abrir no seu computador.</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Fechar</Button>
          {file && (
            <Button type="button" onClick={() => onDownload(file)} loading={downloading}>
              <Icon name="download" size={16} />
              Baixar
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}

/** Baixa um arquivo a partir de um link de download (Content-Disposition: attachment) */
export function triggerDownload(url: string, nome: string) {
  const a = window.document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
}
