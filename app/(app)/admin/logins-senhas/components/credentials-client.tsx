'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/ui/icon'
import { IconButton } from '@/components/ui/icon-button'
import { ListItem, ListEmpty } from '@/components/ui/list-item'
import { AddButton } from '@/components/ui/add-button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'
import { ModalCredential } from './modal-credential'
import { deleteCredentialAction, revealPasswordAction } from '../actions'
import type { Credential } from '../queries'
import { Breadcrumb } from '@/components/layout/breadcrumb'

interface Props {
  credentials: Credential[]
  companyId: string
}

export function CredentialsClient({ credentials, companyId }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCredential, setEditingCredential] = useState<Credential | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<Credential | null>(null)
  const [infoTarget, setInfoTarget] = useState<Credential | null>(null)
  const [revealingId, setRevealingId] = useState<string | null>(null)
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')

  const filtered = credentials.filter((c) => {
    const q = search.toLowerCase()
    return (
      c.sistema.toLowerCase().includes(q) ||
      c.login.toLowerCase().includes(q) ||
      (c.observacao ?? '').toLowerCase().includes(q)
    )
  })

  function openAdd() { setEditingCredential(null); setModalOpen(true) }
  function openEdit(c: Credential) { setEditingCredential(c); setModalOpen(true) }

  // Remoção confirmada no modal; o resultado aparece no toast (✓ / ✕)
  async function confirmDelete() {
    const c = confirmTarget
    if (!c) return
    setDeletingId(c.id)
    const result = await toast.promise(deleteCredentialAction(c.id, companyId), {
      loading: `Removendo credencial de ${c.sistema}…`,
      success: `Credencial de ${c.sistema} removida do cofre.`,
      error: 'Não foi possível remover a credencial.',
    })
    setDeletingId(null)
    setConfirmTarget(null)
    if (!('error' in result)) router.refresh()
  }

  async function handleReveal(c: Credential) {
    if (revealedPasswords[c.id]) {
      setRevealedPasswords((prev) => { const n = { ...prev }; delete n[c.id]; return n })
      return
    }
    setRevealingId(c.id)
    const result = await revealPasswordAction(c.id, companyId)
    setRevealingId(null)
    if ('error' in result) {
      toast.error(result.error ?? 'Erro ao revelar a senha.')
    } else {
      setRevealedPasswords((prev) => ({ ...prev, [c.id]: result.password! }))
    }
  }

  return (
    <>
      <div className="mb-6">
        {/* Título e breadcrumb na mesma linha */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>
            Cofre de senhas
          </h1>
          <Breadcrumb />
        </div>
        <p className="text-sm mt-1 animate-enter" style={{ color: 'var(--color-text-muted)', animationDelay: '60ms' }}>
          Logins e senhas de acesso da empresa, guardados com criptografia
        </p>
      </div>

      <div className="app-card p-5 flex flex-col gap-4">
        {/* Barra do box: resumo + busca + adicionar */}
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-semibold shrink-0" style={{ color: 'var(--color-sidebar-text)' }}>
            {credentials.length} {credentials.length === 1 ? 'credencial' : 'credenciais'}
          </p>
          <div className="flex-1 min-w-[200px] flex items-center gap-2 h-9 px-3 rounded-lg border" style={{ borderColor: 'var(--color-card-border)' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0" style={{ color: 'var(--color-text-muted)' }}>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Pesquisar por identificação, login ou observação..."
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
            <ListEmpty>{search ? 'Nenhuma credencial encontrada para essa pesquisa.' : 'Nenhuma credencial cadastrada.'}</ListEmpty>
          )}
          {filtered.map((c) => {
            const revealed = revealedPasswords[c.id]
            return (
              <ListItem
                key={c.id}
                icon="lock"
                title={c.sistema}
                subtitle={<span className="font-mono text-xs">{c.login}</span>}
                aside={
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
                }
                actionsLabel={c.sistema}
                actions={[
                  ...(c.url ? [{ icon: 'external' as const, label: 'Abrir site', onClick: () => window.open(c.url!, '_blank', 'noopener,noreferrer') }] : []),
                  { icon: 'info', label: c.observacao ? 'Observação' : 'Sem observação', onClick: () => setInfoTarget(c) },
                  { icon: 'pencil', label: 'Editar', onClick: () => openEdit(c) },
                  { icon: 'trash', label: 'Remover', tone: 'danger', onClick: () => setConfirmTarget(c), disabled: deletingId === c.id },
                ]}
              />
            )
          })}
        </ul>
      </div>

      <ModalCredential
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        companyId={companyId}
        credential={editingCredential}
      />

      {/* Observação da credencial */}
      <Modal open={!!infoTarget} onClose={() => setInfoTarget(null)} title={`Observação · ${infoTarget?.sistema ?? ''}`}>
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
            {infoTarget?.observacao || 'Nenhuma observação cadastrada para esta credencial.'}
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
        title="Remover credencial"
        message={<p>Remover a credencial de <strong>{confirmTarget?.sistema}</strong> do cofre de senhas?</p>}
      />
    </>
  )
}
