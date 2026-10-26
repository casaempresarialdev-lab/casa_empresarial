'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/ui/icon'
import { IconButton } from '@/components/ui/icon-button'
import { AddButton } from '@/components/ui/add-button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { TABLE_WRAPPER_CLASS, TABLE_HEAD_STYLE, TH_CLASS, ROW_CLASS, ROW_STYLE } from '@/components/ui/table-styles'
import { toast } from '@/lib/toast'
import { ModalDocument } from './modal-document'
import { ModalViewer } from './modal-viewer'
import { deleteDocumentAction, getSignedUrlAction } from '../actions'
import type { Document } from '../queries'
import { Breadcrumb } from '@/components/layout/breadcrumb'

// Mesmo critério do dashboard: "vencendo" = até 30 dias
const VENCENDO_DIAS = 30

function formatDate(iso: string) {
  const [year, month, day] = iso.split('T')[0].split('-')
  return `${day}/${month}/${year}`
}

function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Situação do vencimento: selo + cores
function vencimentoStatus(vencimento: string | null, today: string) {
  if (!vencimento) return null
  const venc = vencimento.split('T')[0]
  const dias = Math.round((Date.parse(venc) - Date.parse(today)) / 86400000)
  if (dias < 0) return { label: 'Vencido', bg: '#FEE2E2', color: '#B91C1C' }
  if (dias <= VENCENDO_DIAS) return { label: dias === 0 ? 'Vence hoje' : `Vence em ${dias} ${dias === 1 ? 'dia' : 'dias'}`, bg: '#FEF3C7', color: '#B45309' }
  return { label: 'Válido', bg: '#DCFCE7', color: '#15803D' }
}

interface Props {
  documents: Document[]
  companyId: string
}

export function DocsClient({ documents, companyId }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingDoc, setEditingDoc] = useState<Document | null>(null)
  const [search, setSearch] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [viewTarget, setViewTarget] = useState<Document | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<Document | null>(null)
  const [infoTarget, setInfoTarget] = useState<Document | null>(null)

  const today = todayIso()

  const filtered = documents.filter((d) => {
    const q = search.toLowerCase()
    return (
      d.nome.toLowerCase().includes(q) ||
      (d.descricao ?? '').toLowerCase().includes(q) ||
      (d.observacao ?? '').toLowerCase().includes(q)
    )
  })

  function openAdd() { setEditingDoc(null); setModalOpen(true) }
  function openEdit(d: Document) { setEditingDoc(d); setModalOpen(true) }

  // Remoção confirmada no modal; o resultado aparece no toast (✓ / ✕)
  async function confirmDelete() {
    const d = confirmTarget
    if (!d) return
    const titulo = d.descricao || d.nome
    setDeletingId(d.id)
    const result = await toast.promise(deleteDocumentAction(d.id, companyId), {
      loading: `Removendo ${titulo}…`,
      success: `${titulo} foi removido da documentação.`,
      error: 'Não foi possível remover o documento.',
    })
    setDeletingId(null)
    setConfirmTarget(null)
    if (!('error' in result && result.error)) router.refresh()
  }

  // Download com o nome original do arquivo (link temporário com Content-Disposition: attachment)
  async function handleDownload(d: Document) {
    setDownloadingId(d.id)
    const result = await getSignedUrlAction(d.id, companyId, true)
    setDownloadingId(null)
    if (result.error || !result.url) {
      toast.error(result.error ?? 'Não foi possível baixar o documento.')
      return
    }
    const a = window.document.createElement('a')
    a.href = result.url
    a.download = d.nome
    a.click()
  }

  return (
    <>
      <div className="mb-6">
        {/* Título e breadcrumb na mesma linha */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>
            Documentação
          </h1>
          <Breadcrumb />
        </div>
        <p className="text-sm mt-1 animate-enter" style={{ color: 'var(--color-text-muted)', animationDelay: '60ms' }}>
          Armazene e organize os documentos da empresa
        </p>
      </div>

      <div className="app-card p-5 flex flex-col gap-4">
        {/* Barra do box: resumo + busca + adicionar */}
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-semibold shrink-0" style={{ color: 'var(--color-sidebar-text)' }}>
            {documents.length} {documents.length === 1 ? 'documento' : 'documentos'}
          </p>
          <div className="flex-1 min-w-[200px] flex items-center gap-2 h-9 px-3 rounded-lg border" style={{ borderColor: 'var(--color-card-border)' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0" style={{ color: 'var(--color-text-muted)' }}>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Pesquisar por documento, arquivo ou observação..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-0 bg-transparent text-sm outline-none"
              style={{ color: 'var(--color-text-primary)' }}
            />
          </div>
          <AddButton onClick={openAdd} />
        </div>

        <div className={TABLE_WRAPPER_CLASS}>
          <table className="w-full min-w-[640px] text-sm">
            <thead style={TABLE_HEAD_STYLE}>
              <tr>
                <th className={TH_CLASS}>Documento</th>
                <th className={TH_CLASS}>Vencimento</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center py-10" style={{ color: 'var(--color-text-muted)' }}>
                    {search ? 'Nenhum documento encontrado para essa pesquisa.' : 'Nenhum documento enviado ainda.'}
                  </td>
                </tr>
              )}
              {filtered.map((d) => {
                const status = vencimentoStatus(d.vencimento, today)
                const titulo = d.descricao || d.nome
                return (
                  <tr key={d.id} className={ROW_CLASS} style={ROW_STYLE}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {/* ⓘ abre a observação (mais apagado quando não há observação) */}
                        <button
                          type="button"
                          onClick={() => setInfoTarget(d)}
                          className="p-1 -ml-1 rounded-md transition-colors hover:bg-gray-100 shrink-0"
                          style={{ color: d.observacao ? 'var(--color-brand)' : 'var(--color-text-muted)', opacity: d.observacao ? 1 : 0.5 }}
                          title={d.observacao ? 'Ver observação' : 'Sem observação'}
                          aria-label={`Observação de ${titulo}`}
                        >
                          <Icon name="info" size={16} />
                        </button>
                        <div className="min-w-0">
                          <p className="font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{titulo}</p>
                          <p className="flex items-center gap-1 text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                            <Icon name="file" size={12} />
                            {d.nome}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {status && d.vencimento ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: status.bg, color: status.color }}>
                            {status.label}
                          </span>
                          <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{formatDate(d.vencimento)}</span>
                        </div>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Sem vencimento</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <IconButton icon="eye" label={`Visualizar ${titulo}`} onClick={() => setViewTarget(d)} />
                        <IconButton icon="download" label={`Baixar ${titulo}`} onClick={() => handleDownload(d)} disabled={downloadingId === d.id} />
                        <IconButton icon="pencil" label={`Editar ${titulo}`} onClick={() => openEdit(d)} />
                        <IconButton
                          icon="trash"
                          label={`Remover ${titulo}`}
                          tone="danger"
                          onClick={() => setConfirmTarget(d)}
                          disabled={deletingId === d.id}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ModalDocument
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingDoc(null) }}
        companyId={companyId}
        document={editingDoc}
      />

      <ModalViewer
        document={viewTarget}
        companyId={companyId}
        onClose={() => setViewTarget(null)}
        onDownload={handleDownload}
        downloading={!!viewTarget && downloadingId === viewTarget.id}
      />

      {/* Observação do documento */}
      <Modal open={!!infoTarget} onClose={() => setInfoTarget(null)} title={`Observação · ${infoTarget ? infoTarget.descricao || infoTarget.nome : ''}`}>
        <div className="flex items-start gap-4">
          <span
            className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}
          >
            <Icon name="info" size={20} />
          </span>
          <p
            className="text-sm pt-2.5 whitespace-pre-wrap break-words flex-1 min-w-0"
            style={{ color: infoTarget?.observacao ? 'var(--color-text-secondary)' : 'var(--color-text-muted)' }}
          >
            {infoTarget?.observacao || 'Nenhuma observação cadastrada para este documento.'}
          </p>
        </div>
        <div className="flex justify-end pt-6">
          <Button type="button" onClick={() => setInfoTarget(null)}>Fechar</Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmTarget}
        onClose={() => { if (!deletingId) setConfirmTarget(null) }}
        onConfirm={confirmDelete}
        loading={!!deletingId}
        title="Remover documento"
        message={<p>Remover <strong>{confirmTarget ? confirmTarget.descricao || confirmTarget.nome : ''}</strong> da documentação?</p>}
      />
    </>
  )
}
