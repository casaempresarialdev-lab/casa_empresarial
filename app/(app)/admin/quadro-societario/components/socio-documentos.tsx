'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/ui/icon'
import { ActionMenu } from '@/components/ui/action-menu'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DocumentosFila, formatSize, type QueueItem } from './documentos-fila'
import { FileViewer, triggerDownload, type ViewerFile } from '@/components/ui/file-viewer'
import { toast } from '@/lib/toast'
import {
  listSocioDocumentsAction,
  uploadSocioDocumentAction,
  deleteSocioDocumentAction,
  getSocioDocumentUrlAction,
  type SocioDocument,
} from '../actions'

function formatDate(iso: string) {
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

interface Props {
  socioId: string
  socioNome: string
  companyId: string
}

// Documentos de um sócio: envio (arrastar e soltar), lista, visualizar, baixar e remover
export function SocioDocumentos({ socioId, socioNome, companyId }: Props) {
  const router = useRouter()
  const [docs, setDocs] = useState<SocioDocument[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  // Fila de envio: vários arquivos, cada um com sua descrição
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [uploading, setUploading] = useState(false)
  const [viewTarget, setViewTarget] = useState<ViewerFile | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<SocioDocument | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const result = await listSocioDocumentsAction(socioId, companyId)
    if (result.error) setLoadError(result.error)
    else { setLoadError(null); setDocs(result.documents ?? []) }
  }, [socioId, companyId])

  useEffect(() => { load() }, [load])

  // Envia um por vez; os que falharem continuam na fila para tentar de novo
  async function sendAll(items: QueueItem[]) {
    const falhas: QueueItem[] = []
    for (const item of items) {
      const fd = new FormData()
      fd.set('file', item.file)
      fd.set('descricao', item.descricao)
      const result = await uploadSocioDocumentAction(socioId, companyId, fd)
      if ('error' in result) falhas.push(item)
    }
    setQueue(falhas)
    const enviados = items.length - falhas.length
    if (falhas.length) return { error: `${enviados} de ${items.length} enviados. ${falhas.length} falharam e continuam na lista.` }
    return { success: true, enviados }
  }

  async function handleUpload() {
    if (!queue.length) return
    const items = queue
    const n = items.length
    setUploading(true)
    await toast.promise(sendAll(items), {
      loading: n === 1 ? `Enviando ${items[0].descricao.trim() || items[0].file.name}…` : `Enviando ${n} documentos…`,
      success: n === 1 ? `Documento adicionado aos documentos de ${socioNome}.` : `${n} documentos adicionados aos documentos de ${socioNome}.`,
      error: 'Não foi possível enviar todos os documentos.',
    })
    setUploading(false)
    // Recarrega mesmo com falha parcial (parte dos arquivos pode ter sido enviada)
    await load()
    router.refresh() // atualiza a contagem de documentos na tabela
  }

  async function handleDownload(d: { id: string; nome: string }) {
    setDownloadingId(d.id)
    const result = await getSocioDocumentUrlAction(d.id, companyId, true)
    setDownloadingId(null)
    if (result.error || !result.url) toast.error(result.error ?? 'Não foi possível baixar o documento.')
    else triggerDownload(result.url, d.nome)
  }

  async function confirmDelete() {
    const d = confirmTarget
    if (!d) return
    const titulo = d.descricao || d.nome
    setDeletingId(d.id)
    const result = await toast.promise(deleteSocioDocumentAction(d.id, companyId), {
      loading: `Removendo ${titulo}…`,
      success: `${titulo} foi removido.`,
      error: 'Não foi possível remover o documento.',
    })
    setDeletingId(null)
    setConfirmTarget(null)
    if (!('error' in result)) {
      await load()
      router.refresh()
    }
  }

  if (loadError) {
    // Ex.: tabela socio_documents ainda não criada no banco
    return (
      <p className="text-sm p-4 rounded-lg" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
        Os documentos ainda não estão disponíveis: {loadError}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Envio */}
      <div className="flex flex-col gap-3">
        {/* Arquivos a enviar: descrição editável (Enter envia todos) */}
        <DocumentosFila queue={queue} onChange={setQueue} disabled={uploading} onEnter={handleUpload} />
        {queue.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setQueue([])} disabled={uploading}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleUpload} loading={uploading}>
                {queue.length === 1 ? 'Enviar' : `Enviar ${queue.length} arquivos`}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Lista */}
      {docs === null ? (
        <p className="text-sm py-4 text-center" style={{ color: 'var(--color-text-muted)' }}>Carregando documentos…</p>
      ) : docs.length === 0 ? (
        <p className="text-sm py-4 text-center" style={{ color: 'var(--color-text-muted)' }}>Nenhum documento enviado para este sócio.</p>
      ) : (
        <ul className="rounded-xl border divide-y overflow-hidden" style={{ borderColor: 'var(--color-card-border)' }}>
          {docs.map((d) => {
            const titulo = d.descricao || d.nome
            return (
              <li key={d.id} className="flex items-center gap-3 px-3 py-2.5" style={{ borderColor: 'var(--color-card-border)' }}>
                <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}>
                  <Icon name="file" size={18} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{titulo}</p>
                  <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                    {[d.nome !== titulo ? d.nome : null, formatSize(d.tamanho), formatDate(d.created_at)].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {/* Ações no menu "..." padrão do sistema */}
                <div className="shrink-0">
                  <ActionMenu
                    label={`Ações de ${titulo}`}
                    items={[
                      { icon: 'eye', label: 'Visualizar', onClick: () => setViewTarget({ id: d.id, titulo, nome: d.nome, tipo: d.tipo }) },
                      { icon: 'download', label: 'Baixar', onClick: () => handleDownload(d), disabled: downloadingId === d.id },
                      { icon: 'trash', label: 'Remover', tone: 'danger', onClick: () => setConfirmTarget(d), disabled: deletingId === d.id },
                    ]}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <FileViewer
        file={viewTarget}
        getUrl={(id) => getSocioDocumentUrlAction(id, companyId)}
        onClose={() => setViewTarget(null)}
        onDownload={handleDownload}
        downloading={!!viewTarget && downloadingId === viewTarget.id}
      />

      <ConfirmDialog
        open={!!confirmTarget}
        onClose={() => { if (!deletingId) setConfirmTarget(null) }}
        onConfirm={confirmDelete}
        loading={!!deletingId}
        title="Remover documento"
        message={<p>Remover <strong>{confirmTarget ? confirmTarget.descricao || confirmTarget.nome : ''}</strong> dos documentos de {socioNome}?</p>}
      />
    </div>
  )
}
