'use client'

import { Fragment, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/ui/icon'
import { ListItem, ListEmpty } from '@/components/ui/list-item'
import { AddButton } from '@/components/ui/add-button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'
import { ModalDocument } from './modal-document'
import { ModalFolder } from './modal-folder'
import { ModalMove, type MoveTarget } from './modal-move'
import { FileViewer, triggerDownload } from '@/components/ui/file-viewer'
import { deleteDocumentAction, deleteFolderAction, getSignedUrlAction } from '../actions'
import { folderParent, folderPath, folderSubtree } from '../folder-tree'
import type { Document, DocumentFolder } from '../queries'
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

// Conteúdo da pasta: "2 pastas · 3 documentos" / "Nenhum documento ainda"
function conteudo(pastas: number, docs: number) {
  const partes = [
    pastas ? `${pastas} ${pastas === 1 ? 'pasta' : 'pastas'}` : null,
    docs ? (docs === 1 ? '1 documento arquivado' : `${docs} documentos arquivados`) : null,
  ].filter(Boolean)
  return partes.length ? partes.join(' · ') : 'Nenhum documento ainda'
}

interface Props {
  documents: Document[]
  folders: DocumentFolder[]
  /** Erro ao ler as pastas (ex.: tabela ainda não criada) — mostra a lista de documentos sem pastas */
  foldersError: string | null
  companyId: string
}

export function DocsClient({ documents, folders, foldersError, companyId }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingDoc, setEditingDoc] = useState<Document | null>(null)
  const [search, setSearch] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [viewTarget, setViewTarget] = useState<Document | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<Document | null>(null)
  const [infoTarget, setInfoTarget] = useState<Document | null>(null)
  const [moveTarget, setMoveTarget] = useState<MoveTarget | null>(null)
  // Pastas: pasta aberta (null = raiz), modal de criar/renomear e exclusão
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [folderModalOpen, setFolderModalOpen] = useState(false)
  const [editingFolder, setEditingFolder] = useState<DocumentFolder | null>(null)
  const [confirmFolder, setConfirmFolder] = useState<DocumentFolder | null>(null)
  const [deletingFolder, setDeletingFolder] = useState(false)

  const today = todayIso()
  const usaPastas = !foldersError
  const folderIds = new Set(folders.map((f) => f.id))
  // Documento sem pasta (ou de pasta que não existe mais) fica na raiz (null)
  const pastaDoDoc = (d: Document) => (d.folder_id && folderIds.has(d.folder_id) ? d.folder_id : null)

  // Pasta aberta que deixou de existir (ex.: excluída) volta para a raiz
  const current = folders.find((f) => f.id === currentId) ?? null
  const caminho = folderPath(folders, current?.id ?? null)

  const q = search.toLowerCase()
  const matchDoc = (d: Document) =>
    d.nome.toLowerCase().includes(q) ||
    (d.descricao ?? '').toLowerCase().includes(q) ||
    (d.observacao ?? '').toLowerCase().includes(q)

  // Sem busca: conteúdo da pasta aberta. Com busca: pastas e documentos de todas as pastas
  const visibleFolders = !usaPastas
    ? []
    : search
      ? folders.filter((f) => f.nome.toLowerCase().includes(q))
      : folders.filter((f) => folderParent(folders, f) === (current?.id ?? null))
  const visibleDocs = !usaPastas
    ? documents.filter(matchDoc)
    : search
      ? documents.filter(matchDoc)
      : documents.filter((d) => pastaDoDoc(d) === (current?.id ?? null))

  const nomeCaminho = (folderId: string | null) =>
    folderId ? folderPath(folders, folderId).map((p) => p.nome).join(' / ') : 'Raiz'

  function goTo(id: string | null) {
    setCurrentId(id)
    setSearch('')
  }

  function openAdd() { setEditingDoc(null); setModalOpen(true) }
  function openEdit(d: Document) { setEditingDoc(d); setModalOpen(true) }
  function openAddFolder() { setEditingFolder(null); setFolderModalOpen(true) }

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

  async function confirmDeleteFolder() {
    const f = confirmFolder
    if (!f) return
    setDeletingFolder(true)
    const result = await toast.promise(deleteFolderAction(f.id, companyId), {
      loading: `Excluindo a pasta ${f.nome}…`,
      success: `A pasta ${f.nome} foi excluída.`,
      error: 'Não foi possível excluir a pasta.',
    })
    setDeletingFolder(false)
    setConfirmFolder(null)
    if (!result.error) {
      // Estava dentro da pasta excluída: volta para a pasta de cima
      if (current && folderSubtree(folders, f.id).has(current.id)) goTo(folderParent(folders, f))
      router.refresh()
    }
  }

  // Download com o nome original do arquivo (link temporário com Content-Disposition: attachment)
  async function handleDownload(d: { id: string; nome: string }) {
    setDownloadingId(d.id)
    const result = await getSignedUrlAction(d.id, companyId, true)
    setDownloadingId(null)
    if (result.error || !result.url) {
      toast.error(result.error ?? 'Não foi possível baixar o documento.')
      return
    }
    triggerDownload(result.url, d.nome)
  }

  function renderFolder(f: DocumentFolder) {
    const subpastas = folders.filter((x) => folderParent(folders, x) === f.id).length
    const docs = documents.filter((d) => pastaDoDoc(d) === f.id).length
    // Vencidos em qualquer nível dentro da pasta
    const dentro = folderSubtree(folders, f.id)
    const vencidos = documents.filter((d) => {
      const p = pastaDoDoc(d)
      return p && dentro.has(p) && vencimentoStatus(d.vencimento, today)?.label === 'Vencido'
    }).length
    return (
      <ListItem
        key={`f-${f.id}`}
        icon="folder"
        title={f.nome}
        subtitle={search ? `${nomeCaminho(folderParent(folders, f))} · ${conteudo(subpastas, docs)}` : conteudo(subpastas, docs)}
        onClick={() => goTo(f.id)}
        aside={
          <>
            {vencidos > 0 && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ backgroundColor: '#FEE2E2', color: '#B91C1C' }}>
                {vencidos} {vencidos === 1 ? 'vencido' : 'vencidos'}
              </span>
            )}
            {f.sistema && (
              // Pasta padrão: não pode ser movida, renomeada nem excluída
              <span
                className="inline-flex items-center"
                style={{ color: 'var(--color-text-muted)' }}
                title="Pasta padrão do sistema: não pode ser movida, renomeada nem excluída"
                aria-label="Pasta padrão"
              >
                <Icon name="lock" size={16} />
              </span>
            )}
          </>
        }
        actionsLabel={f.nome}
        actions={[
          { icon: 'folder', label: 'Abrir', onClick: () => goTo(f.id) },
          { icon: 'external', label: f.sistema ? 'Mover para… (pasta padrão)' : 'Mover para…', onClick: () => setMoveTarget({ kind: 'folder', folder: f }), disabled: f.sistema },
          { icon: 'pencil', label: f.sistema ? 'Renomear (pasta padrão)' : 'Renomear', onClick: () => { setEditingFolder(f); setFolderModalOpen(true) }, disabled: f.sistema },
          { icon: 'trash', label: f.sistema ? 'Excluir (pasta padrão)' : 'Excluir', tone: 'danger', onClick: () => setConfirmFolder(f), disabled: f.sistema },
        ]}
      />
    )
  }

  function renderDoc(d: Document) {
    const status = vencimentoStatus(d.vencimento, today)
    const titulo = d.descricao || d.nome
    const detalhes = [search && usaPastas ? nomeCaminho(pastaDoDoc(d)) : null, d.nome, d.vencimento ? `Vence em ${formatDate(d.vencimento)}` : null]
    return (
      <ListItem
        key={`d-${d.id}`}
        icon="file"
        title={titulo}
        subtitle={detalhes.filter(Boolean).join(' · ')}
        aside={status && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ backgroundColor: status.bg, color: status.color }}>
            {status.label}
          </span>
        )}
        actionsLabel={titulo}
        actions={[
          { icon: 'eye', label: 'Visualizar', onClick: () => setViewTarget(d) },
          { icon: 'download', label: 'Baixar', onClick: () => handleDownload(d), disabled: downloadingId === d.id },
          { icon: 'info', label: d.observacao ? 'Observação' : 'Sem observação', onClick: () => setInfoTarget(d) },
          ...(usaPastas ? [{ icon: 'external' as const, label: 'Mover para…', onClick: () => setMoveTarget({ kind: 'document', id: d.id, titulo, folderId: pastaDoDoc(d) }) }] : []),
          { icon: 'pencil', label: 'Editar', onClick: () => openEdit(d) },
          { icon: 'trash', label: 'Remover', tone: 'danger', onClick: () => setConfirmTarget(d), disabled: deletingId === d.id },
        ]}
      />
    )
  }

  const totalAqui = visibleFolders.length + visibleDocs.length

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
        {foldersError && (
          <p className="text-sm p-4 rounded-lg" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
            As pastas ainda não estão disponíveis: {foldersError}
          </p>
        )}

        {/* Caminho das pastas: Raiz / Pasta / Subpasta (cada nível é clicável) */}
        {usaPastas && current && (
          <nav aria-label="Caminho da pasta" className="flex flex-wrap items-center gap-1 text-sm">
            <button
              type="button"
              onClick={() => goTo(folderParent(folders, current))}
              className="inline-flex items-center h-8 px-1.5 -ml-1.5 rounded-lg transition-colors hover:bg-gray-50"
              style={{ color: 'var(--color-text-muted)' }}
              aria-label="Voltar"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button type="button" onClick={() => goTo(null)} className="hover:underline" style={{ color: 'var(--color-text-muted)' }}>
              Raiz
            </button>
            {caminho.map((p, i) => {
              const last = i === caminho.length - 1
              return (
                <Fragment key={p.id}>
                  <span style={{ color: 'var(--color-text-muted)' }}>/</span>
                  {last ? (
                    <span className="flex items-center gap-1.5 font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
                      <span style={{ color: 'var(--color-brand)' }}><Icon name="folder" size={16} /></span>
                      {p.nome}
                    </span>
                  ) : (
                    <button type="button" onClick={() => goTo(p.id)} className="hover:underline" style={{ color: 'var(--color-text-muted)' }}>
                      {p.nome}
                    </button>
                  )}
                </Fragment>
              )
            })}
          </nav>
        )}

        {/* Barra do box: resumo + busca + adicionar pasta / documento */}
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-semibold shrink-0" style={{ color: 'var(--color-sidebar-text)' }}>
            {search
              ? `${totalAqui} ${totalAqui === 1 ? 'resultado' : 'resultados'}`
              : usaPastas
                ? conteudo(visibleFolders.length, visibleDocs.length).replace('Nenhum documento ainda', 'Vazia')
                : `${documents.length} ${documents.length === 1 ? 'documento' : 'documentos'}`}
          </p>
          <div className="flex-1 min-w-[200px] flex items-center gap-2 h-9 px-3 rounded-lg border" style={{ borderColor: 'var(--color-card-border)' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0" style={{ color: 'var(--color-text-muted)' }}>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder={usaPastas ? 'Pesquisar pastas e documentos...' : 'Pesquisar por documento, arquivo ou observação...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-0 bg-transparent text-sm outline-none"
              style={{ color: 'var(--color-text-primary)' }}
            />
          </div>
          {usaPastas && <AddButton onClick={openAddFolder} label="Nova pasta" />}
          <AddButton onClick={openAdd} label={usaPastas ? 'Documento' : 'Adicionar'} />
        </div>

        {/* Pastas e documentos do nível atual (ou resultados da busca) */}
        <ul className="flex flex-col gap-3">
          {totalAqui === 0 && (
            <ListEmpty>
              {search
                ? 'Nenhuma pasta ou documento encontrado para essa pesquisa.'
                : !usaPastas
                  ? 'Nenhum documento enviado ainda.'
                  : current ? 'Esta pasta está vazia.' : 'Nenhuma pasta ou documento ainda.'}
            </ListEmpty>
          )}
          {visibleFolders.map(renderFolder)}
          {visibleDocs.map(renderDoc)}
        </ul>
      </div>

      <ModalDocument
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingDoc(null) }}
        companyId={companyId}
        document={editingDoc}
        folders={folders}
        defaultFolderId={current?.id ?? null}
      />

      <ModalFolder
        open={folderModalOpen}
        onClose={() => { setFolderModalOpen(false); setEditingFolder(null) }}
        companyId={companyId}
        folder={editingFolder}
        parentId={current?.id ?? null}
        parentName={current?.nome ?? null}
      />

      <ModalMove target={moveTarget} onClose={() => setMoveTarget(null)} companyId={companyId} folders={folders} />

      <FileViewer
        file={viewTarget && { id: viewTarget.id, titulo: viewTarget.descricao || viewTarget.nome, nome: viewTarget.nome, tipo: viewTarget.tipo }}
        getUrl={(id) => getSignedUrlAction(id, companyId)}
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

      <ConfirmDialog
        open={!!confirmFolder}
        onClose={() => { if (!deletingFolder) setConfirmFolder(null) }}
        onConfirm={confirmDeleteFolder}
        loading={deletingFolder}
        title="Excluir pasta"
        message={
          <p>
            Excluir a pasta <strong>{confirmFolder?.nome}</strong>? Nada é apagado: os documentos e as pastas dentro dela passam para{' '}
            <strong>{confirmFolder ? nomeCaminho(folderParent(folders, confirmFolder)) : ''}</strong>.
          </p>
        }
      />
    </>
  )
}
