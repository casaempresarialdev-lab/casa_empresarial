'use client'

import { useRef, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ModalDocument } from './modal-document'
import { deleteDocumentAction, getSignedUrlAction } from '../actions'
import type { Document } from '../queries'

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

function formatDate(iso: string | null) {
  if (!iso) return '—'
  const [year, month, day] = iso.split('T')[0].split('-')
  return `${day}/${month}/${year}`
}

function isExpired(vencimento: string | null) {
  if (!vencimento) return false
  return new Date(vencimento) < new Date()
}

function isNearExpiry(vencimento: string | null) {
  if (!vencimento) return false
  const diff = new Date(vencimento).getTime() - Date.now()
  return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000
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
  const [modalOpen, setModalOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const filtered = documents.filter((d) => {
    const q = search.toLowerCase()
    return (
      d.nome.toLowerCase().includes(q) ||
      (d.descricao ?? '').toLowerCase().includes(q) ||
      (d.observacao ?? '').toLowerCase().includes(q)
    )
  })

  async function handleDelete(doc: Document) {
    if (!confirm(`Excluir "${doc.nome}"?`)) return
    setDeletingId(doc.id)
    setErrorMsg('')
    const result = await deleteDocumentAction(doc.id, companyId)
    setDeletingId(null)
    if (result.error) setErrorMsg(result.error)
    else router.refresh()
  }

  async function handleView(doc: Document) {
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
        <Button onClick={() => setModalOpen(true)}>Adicionar</Button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Pesquisar por arquivo, descrição ou observação..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 w-full rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C19A6B]"
          style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: '#fff' }}
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
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Descrição</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Vencimento</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-10" style={{ color: 'var(--color-text-muted)' }}>
                  {search ? 'Nenhum documento encontrado.' : 'Nenhum documento enviado ainda.'}
                </td>
              </tr>
            )}
            {filtered.map((doc) => (
              <tr key={doc.id} className="border-t" style={{ borderColor: 'var(--color-bg-surface)' }}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg shrink-0">{fileIcon(doc.tipo)}</span>
                    <span className="font-medium truncate max-w-[180px]" style={{ color: 'var(--color-text-primary)' }} title={doc.nome}>
                      {doc.nome}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>
                  {doc.descricao ? (
                    <div>
                      <span>{doc.descricao}</span>
                      {doc.observacao && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{doc.observacao}</p>
                      )}
                    </div>
                  ) : '—'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {doc.vencimento ? (
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: isExpired(doc.vencimento) ? '#FEE2E2' : isNearExpiry(doc.vencimento) ? '#FEF3C7' : 'var(--color-bg-surface)',
                        color: isExpired(doc.vencimento) ? 'var(--color-error)' : isNearExpiry(doc.vencimento) ? '#92400E' : 'var(--color-text-secondary)',
                      }}
                    >
                      {formatDate(doc.vencimento)}
                    </span>
                  ) : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <ThreeDotMenu
                      onView={() => handleView(doc)}
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

      <ModalDocument
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        companyId={companyId}
      />
    </>
  )
}
