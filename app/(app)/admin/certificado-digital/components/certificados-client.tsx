'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { IconButton } from '@/components/ui/icon-button'
import { ListItem, ListEmpty } from '@/components/ui/list-item'
import { AddButton } from '@/components/ui/add-button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { triggerDownload } from '@/components/ui/file-viewer'
import { toast } from '@/lib/toast'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { ModalCertificado } from './modal-certificado'
import { deleteCertificateAction, getCertificateDownloadUrlAction, revealCertificatePasswordAction } from '../actions'
import type { Certificate } from '../queries'

function formatDate(iso: string) {
  const [year, month, day] = iso.split('T')[0].split('-')
  return `${day}/${month}/${year}`
}

interface Props {
  certificates: Certificate[]
  /** Erro ao ler a lista (ex.: tabela ainda não criada no banco) */
  loadError: string | null
  companyId: string
}

export function CertificadosClient({ certificates, loadError, companyId }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Certificate | null>(null)
  const [search, setSearch] = useState('')
  const [confirmTarget, setConfirmTarget] = useState<Certificate | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [revealingId, setRevealingId] = useState<string | null>(null)
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({})

  const filtered = certificates.filter((c) => {
    const q = search.toLowerCase()
    return c.identificacao.toLowerCase().includes(q) || c.nome_arquivo.toLowerCase().includes(q)
  })

  function openAdd() { setEditing(null); setModalOpen(true) }
  function openEdit(c: Certificate) { setEditing(c); setModalOpen(true) }

  async function handleReveal(c: Certificate) {
    if (revealedPasswords[c.id]) {
      setRevealedPasswords((prev) => { const n = { ...prev }; delete n[c.id]; return n })
      return
    }
    setRevealingId(c.id)
    const result = await revealCertificatePasswordAction(c.id, companyId)
    setRevealingId(null)
    if (result.error || result.password === undefined) toast.error(result.error ?? 'Erro ao revelar a senha.')
    else setRevealedPasswords((prev) => ({ ...prev, [c.id]: result.password! }))
  }

  async function handleDownload(c: Certificate) {
    setDownloadingId(c.id)
    const result = await getCertificateDownloadUrlAction(c.id, companyId)
    setDownloadingId(null)
    if (result.error || !result.url) toast.error(result.error ?? 'Não foi possível baixar o certificado.')
    else triggerDownload(result.url, c.nome_arquivo)
  }

  // Remoção confirmada no modal; o resultado aparece no toast (✓ / ✕)
  async function confirmDelete() {
    const c = confirmTarget
    if (!c) return
    setDeletingId(c.id)
    const result = await toast.promise(deleteCertificateAction(c.id, companyId), {
      loading: `Removendo ${c.identificacao}…`,
      success: `${c.identificacao} foi removido dos certificados.`,
      error: 'Não foi possível remover o certificado.',
    })
    setDeletingId(null)
    setConfirmTarget(null)
    if (!('error' in result)) router.refresh()
  }

  return (
    <>
      <div className="mb-6">
        {/* Título e breadcrumb na mesma linha */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>
            Certificado digital
          </h1>
          <Breadcrumb />
        </div>
        <p className="text-sm mt-1 animate-enter" style={{ color: 'var(--color-text-muted)', animationDelay: '60ms' }}>
          Certificados da empresa, com as senhas guardadas com criptografia
        </p>
      </div>

      <div className="app-card p-5 flex flex-col gap-4">
        {loadError && (
          <p className="text-sm p-4 rounded-lg" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
            Os certificados ainda não estão disponíveis: {loadError}
          </p>
        )}

        {/* Barra do box: resumo + busca + adicionar */}
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-semibold shrink-0" style={{ color: 'var(--color-sidebar-text)' }}>
            {certificates.length} {certificates.length === 1 ? 'certificado' : 'certificados'}
          </p>
          <div className="flex-1 min-w-[200px] flex items-center gap-2 h-9 px-3 rounded-lg border" style={{ borderColor: 'var(--color-card-border)' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0" style={{ color: 'var(--color-text-muted)' }}>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Pesquisar por identificação ou arquivo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-0 bg-transparent text-sm outline-none"
              style={{ color: 'var(--color-text-primary)' }}
            />
          </div>
          <AddButton onClick={openAdd} />
        </div>

        <ul className="flex flex-col gap-3">
          {filtered.length === 0 && (
            <ListEmpty>{search ? 'Nenhum certificado encontrado para essa pesquisa.' : 'Nenhum certificado cadastrado.'}</ListEmpty>
          )}
          {filtered.map((c) => {
            const revealed = revealedPasswords[c.id]
            return (
              <ListItem
                key={c.id}
                icon="shield"
                title={c.identificacao}
                subtitle={`${c.nome_arquivo} · Cadastrado em ${formatDate(c.created_at)}`}
                aside={c.tem_senha ? (
                  // Senha escondida, com o olho para mostrar
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-xs min-w-20 text-right" style={{ color: 'var(--color-text-secondary)' }}>
                      {revealed ?? '••••••••'}
                    </span>
                    <IconButton
                      icon={revealed ? 'eye-off' : 'eye'}
                      label={revealed ? 'Ocultar senha' : 'Ver senha'}
                      onClick={() => handleReveal(c)}
                      disabled={revealingId === c.id}
                    />
                  </div>
                ) : (
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Sem senha</span>
                )}
                actionsLabel={c.identificacao}
                actions={[
                  { icon: 'download', label: 'Baixar', onClick: () => handleDownload(c), disabled: downloadingId === c.id },
                  { icon: 'pencil', label: 'Editar', onClick: () => openEdit(c) },
                  { icon: 'trash', label: 'Remover', tone: 'danger', onClick: () => setConfirmTarget(c), disabled: deletingId === c.id },
                ]}
              />
            )
          })}
        </ul>
      </div>

      <ModalCertificado
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null) }}
        companyId={companyId}
        certificate={editing}
      />

      <ConfirmDialog
        open={!!confirmTarget}
        onClose={() => { if (!deletingId) setConfirmTarget(null) }}
        onConfirm={confirmDelete}
        loading={!!deletingId}
        title="Remover certificado"
        message={<p>Remover <strong>{confirmTarget?.identificacao}</strong> dos certificados? O arquivo também será apagado.</p>}
      />
    </>
  )
}
