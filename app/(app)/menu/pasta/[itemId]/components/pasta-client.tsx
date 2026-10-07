'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { uploadDocumentAction, deleteDocumentAction, getSignedUrlAction } from '@/app/(app)/admin/documentacao/actions'
import type { Document } from '@/app/(app)/admin/documentacao/queries'

interface Props {
  companyId: string
  menuItemId: string
  nome: string
  documents: Document[]
}

function formatBytes(bytes: number | null) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(d: string | null) {
  if (!d) return null
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

export function PastaClient({ companyId, menuItemId, nome, documents }: Props) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [vencimento, setVencimento] = useState('')
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')

    const fd = new FormData()
    fd.set('file', file)
    if (vencimento) fd.set('vencimento', vencimento)

    const result = await uploadDocumentAction(companyId, fd, menuItemId)
    setUploading(false)
    if (result.error) { setError(result.error); return }
    if (fileRef.current) fileRef.current.value = ''
    setVencimento('')
    router.refresh()
  }

  async function handleDelete(doc: Document) {
    if (!confirm(`Excluir "${doc.nome}"? Essa ação não pode ser desfeita.`)) return
    setDeletingId(doc.id)
    const result = await deleteDocumentAction(doc.id, companyId)
    setDeletingId(null)
    if (result.error) { setError(result.error); return }
    router.refresh()
  }

  async function handleDownload(doc: Document) {
    const result = await getSignedUrlAction(doc.id, companyId)
    if (result.url) window.open(result.url, '_blank')
    else setError(result.error ?? 'Erro ao gerar link.')
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
          📁 {nome}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Anexe qualquer documento aqui — é uma pasta simples, sem subpastas.
        </p>
      </div>

      <form onSubmit={handleUpload} className="rounded-xl border p-4 mb-6 flex items-end gap-3 flex-wrap"
        style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-secondary)' }}>Arquivo</label>
          <input ref={fileRef} type="file" className="text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-secondary)' }}>Validade (opcional)</label>
          <Input type="date" value={vencimento} onChange={e => setVencimento(e.target.value)} />
        </div>
        <Button type="submit" loading={uploading}>Anexar</Button>
      </form>

      {error && (
        <p className="text-sm p-3 rounded-lg bg-red-50 mb-4" style={{ color: 'var(--color-error)' }}>{error}</p>
      )}

      {documents.length === 0 ? (
        <div className="rounded-xl border p-10 text-center" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Nenhum documento nesta pasta ainda.</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
          <table className="w-full text-sm">
            <thead style={{ backgroundColor: 'var(--color-bg-surface)' }}>
              <tr>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Nome</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Tamanho</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Validade</th>
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody>
              {documents.map(doc => (
                <tr key={doc.id} className="border-t" style={{ borderColor: 'var(--color-bg-surface)' }}>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text-primary)' }}>{doc.nome}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>{formatBytes(doc.tamanho)}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>{formatDate(doc.vencimento) ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <Button variant="ghost" size="sm" onClick={() => handleDownload(doc)}>Abrir</Button>
                      <Button variant="danger" size="sm" loading={deletingId === doc.id} onClick={() => handleDelete(doc)}>Excluir</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
