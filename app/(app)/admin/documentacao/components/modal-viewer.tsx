'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { getSignedUrlAction } from '../actions'
import type { Document } from '../queries'

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

interface Props {
  document: Document | null
  companyId: string
  onClose: () => void
  onDownload: (doc: Document) => void
  downloading: boolean
}

// Visualizador do documento: busca um link temporário e mostra o arquivo conforme o tipo
export function ModalViewer({ document: doc, companyId, onClose, onDownload, downloading }: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!doc) return
    let cancelled = false
    setUrl(null)
    setError(null)
    getSignedUrlAction(doc.id, companyId).then((result) => {
      if (cancelled) return
      if (result.error || !result.url) setError(result.error ?? 'Não foi possível abrir o documento.')
      else setUrl(result.url)
    })
    return () => { cancelled = true }
  }, [doc, companyId])

  const kind = doc ? kindOf(doc.tipo, doc.nome) : 'other'
  const titulo = doc ? doc.descricao || doc.nome : ''

  return (
    <Modal open={!!doc} onClose={onClose} title={titulo} description={doc?.nome} className="sm:max-w-5xl">
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
            <img src={url} alt={titulo} className="max-h-[70vh] max-w-full object-contain" />
          ) : kind === 'pdf' || kind === 'text' ? (
            <iframe src={url} title={titulo} className="w-full h-[70vh] bg-white" />
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
          {doc && (
            <Button type="button" onClick={() => onDownload(doc)} loading={downloading}>
              <Icon name="download" size={16} />
              Baixar
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
