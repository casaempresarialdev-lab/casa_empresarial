'use client'

import { useRef, useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { uploadDocumentAction, deleteDocumentAction, getSignedUrlAction } from '../actions'
import type { Document } from '../queries'

function formatBytes(bytes: number | null) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fileIcon(tipo: string | null) {
  if (!tipo) return '📎'
  if (tipo.startsWith('image/')) return '🖼️'
  if (tipo === 'application/pdf') return '📄'
  if (tipo.includes('spreadsheet') || tipo.includes('excel') || tipo === 'text/csv') return '📊'
  if (tipo.includes('word') || tipo.includes('document')) return '📝'
  if (tipo.startsWith('video/')) return '🎬'
  if (tipo.startsWith('audio/')) return '🎵'
  if (tipo.includes('zip') || tipo.includes('rar') || tipo.includes('compressed')) return '📦'
  return '📎'
}

function ThreeDotMenu({ onView, onDelete, loadingView, loadingDelete }: {
  onView: () => void
  onDelete: () => void
  loadingView: boolean
  loadingDelete: boolean
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const menuRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function handleOpen() {
    const rect = btnRef.current?.getBoundingClientRect()
    if (rect) setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    setOpen((v) => !v)
  }

  return (
    <div>
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-lg hover:bg-gray-100 transition-colors"
        style={{ color: 'var(--color-text-muted)' }}
        aria-label="Opções"
      >
        ···
      </button>
      {open && (
        <div
          ref={menuRef}
          className="fixed w-36 rounded-xl border shadow-lg py-1 z-50"
          style={{ backgroundColor: 'white', borderColor: 'var(--color-bg-surface)', top: pos.top, right: pos.right }}
        >
          <button
            type="button"
            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
            onClick={() => { setOpen(false); onView() }}
            disabled={loadingView}
          >
            {loadingView ? 'Abrindo…' : 'Visualizar'}
          </button>
          <button
            type="button"
            className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 transition-colors"
            style={{ color: 'var(--color-error)' }}
            onClick={() => { setOpen(false); onDelete() }}
            disabled={loadingDelete}
          >
            {loadingDelete ? 'Excluindo…' : 'Excluir'}
          </button>
        </div>
      )}
    </div>
  )
}

interface Props {
  documents: Document[]
  companyId: string
}

export function DocsClient({ documents, companyId }: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [isPending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const filtered = documents.filter((d) =>
    d.nome.toLowerCase().includes(search.toLowerCase()),
  )

  function handleUploadClick() {
    fileInputRef.current?.click()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setErrorMsg('')
    const formData = new FormData()
    formData.set('file', file)
    startTransition(async () => {
      const result = await uploadDocumentAction(companyId, formData)
      if (result.error) {
        setErrorMsg(result.error)
      } else {
        router.refresh()
      }
      if (fileInputRef.current) fileInputRef.current.value = ''
    })
  }

  async function handleDelete(doc: Document) {
    if (!confirm(`Excluir "${doc.nome}"?`)) return
    setDeletingId(doc.id)
    setErrorMsg('')
    const result = await deleteDocumentAction(doc.id, companyId)
    setDeletingId(null)
    if (result.error) setErrorMsg(result.error)
    else router.refresh()
  }

  async function handleDownload(doc: Document) {
    setDownloadingId(doc.id)
    setErrorMsg('')
    const result = await getSignedUrlAction(doc.id, companyId)
    setDownloadingId(null)
    if (result.error) setErrorMsg(result.error)
    else window.open(result.url, '_blank')
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
            Documentação
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Armazene e organize os documentos da empresa
          </p>
        </div>
        <Button onClick={handleUploadClick} loading={isPending}>
          Upload
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Pesquisar pelo nome do arquivo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 w-full rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C19A6B]"
          style={{
            borderColor: 'var(--color-bg-surface)',
            color: 'var(--color-text-primary)',
            backgroundColor: '#fff',
          }}
        />
      </div>

      {errorMsg && (
        <p className="text-sm mb-4 p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>
          {errorMsg}
        </p>
      )}

      <div className="rounded-xl border overflow-x-auto" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
        <table className="w-full min-w-[600px] text-sm">
          <thead style={{ backgroundColor: 'var(--color-bg-surface)' }}>
            <tr>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Arquivo</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Tamanho</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Enviado em</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-10" style={{ color: 'var(--color-text-muted)' }}>
                  {search ? 'Nenhum arquivo encontrado para essa pesquisa.' : 'Nenhum documento enviado ainda.'}
                </td>
              </tr>
            )}
            {filtered.map((doc) => (
              <tr key={doc.id} className="border-t" style={{ borderColor: 'var(--color-bg-surface)' }}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg shrink-0">{fileIcon(doc.tipo)}</span>
                    <span
                      className="font-medium truncate max-w-xs"
                      style={{ color: 'var(--color-text-primary)' }}
                      title={doc.nome}
                    >
                      {doc.nome}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>
                  {formatBytes(doc.tamanho)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>
                  {formatDate(doc.created_at)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <ThreeDotMenu
                      onView={() => handleDownload(doc)}
                      onDelete={() => handleDelete(doc)}
                      loadingView={downloadingId === doc.id}
                      loadingDelete={deletingId === doc.id}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
