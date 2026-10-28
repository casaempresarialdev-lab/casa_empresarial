'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RoleBadge, StatusBadge } from '@/components/ui/badge'
import { AddButton } from '@/components/ui/add-button'
import { ListItem, ListEmpty } from '@/components/ui/list-item'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Icon } from '@/components/ui/icon'
import { ModalUsuario } from './modal-usuario'
import { removeMemberAction, cancelInvitationAction, resendInvitationAction } from '../actions'
import type { MemberWithProfile, Invitation } from '../queries'
import { formatDate } from '@/lib/utils'
import { toast } from '@/lib/toast'
import { ModalPainelUsuario } from './modal-painel-usuario'
import { Breadcrumb } from '@/components/layout/breadcrumb'

const ROLE_LABELS: Record<string, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  member: 'Membro',
  accountant: 'Contador',
}

interface Props {
  members: MemberWithProfile[]
  invitations: Invitation[]
  companyId: string
  currentProfileId: string
  currentUserRole: string
  currentUserEmail: string
}

function cpfMask(cpf: string | null) {
  if (!cpf) return null
  const d = cpf.replace(/\D/g, '')
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`
}

// Foto (ou inicial) do usuário, no lugar do ícone do cartão
function Avatar({ src, alt, children }: { src?: string | null; alt: string; children: React.ReactNode }) {
  return (
    <span
      className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center shrink-0 text-sm font-bold"
      style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="w-full h-full object-cover" />
      ) : children}
    </span>
  )
}

export function UsuariosClient({ members, invitations, companyId, currentProfileId, currentUserRole, currentUserEmail }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<MemberWithProfile | null>(null)
  const [painelOpen, setPainelOpen] = useState(false)
  const [painelMember, setPainelMember] = useState<MemberWithProfile | null>(null)
  const [removeTarget, setRemoveTarget] = useState<MemberWithProfile | null>(null)
  const [removing, setRemoving] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<Invitation | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [resendingId, setResendingId] = useState<string | null>(null)

  function openAdd() { setEditingMember(null); setModalOpen(true) }
  function openEdit(member: MemberWithProfile) { setEditingMember(member); setModalOpen(true) }

  // Remoção confirmada no modal; o resultado aparece no toast (✓ / ✕)
  async function confirmRemove() {
    const m = removeTarget
    if (!m) return
    const nome = m.profiles?.name ?? 'O membro'
    setRemoving(true)
    const result = await toast.promise(removeMemberAction(m.id, companyId), {
      loading: `Removendo ${nome}…`,
      success: `${nome} foi removido da empresa.`,
      error: 'Não foi possível remover o membro.',
    })
    setRemoving(false)
    setRemoveTarget(null)
    if (!('error' in result)) router.refresh()
  }

  async function confirmCancelInvite() {
    const inv = cancelTarget
    if (!inv) return
    setCancelling(true)
    const result = await toast.promise(cancelInvitationAction(inv.id, companyId), {
      loading: `Cancelando convite para ${inv.email}…`,
      success: `Convite para ${inv.email} cancelado.`,
      error: 'Não foi possível cancelar o convite.',
    })
    setCancelling(false)
    setCancelTarget(null)
    if (!('error' in result)) router.refresh()
  }

  async function handleResendInvite(inv: Invitation) {
    setResendingId(inv.id)
    // Erros do servidor aparecem no próprio toast (✕) — inclusive quando o e-mail não saiu
    const envio = resendInvitationAction(inv.id, companyId).then((r) =>
      'emailEnviado' in r && r.emailEnviado === false ? { error: r.notice } : r,
    )
    await toast.promise(envio, {
      loading: `Reenviando convite para ${inv.email}…`,
      success: (r) => ('notice' in r && r.notice) || `Convite reenviado para ${inv.email}.`,
      error: 'Erro ao reenviar convite.',
    })
    setResendingId(null)
    router.refresh() // a pessoa pode ter entrado direto na empresa
  }

  const active = members.filter((m) => m.status === 'active')
  const inactive = members.filter((m) => m.status !== 'active')

  return (
    <>
      <div className="mb-6">
        {/* Título e breadcrumb na mesma linha */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>
            Usuários
          </h1>
          <Breadcrumb />
        </div>
        <p className="text-sm mt-1 animate-enter" style={{ color: 'var(--color-text-muted)', animationDelay: '60ms' }}>
          Membros com acesso a esta empresa
        </p>
      </div>

      <div className="app-card p-5 flex flex-col gap-4">
        {/* Barra do box: resumo + adicionar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm" style={{ color: 'var(--color-sidebar-text)' }}>
            <span className="font-semibold">{active.length} {active.length === 1 ? 'membro ativo' : 'membros ativos'}</span>
            {invitations.length > 0 && (
              <span style={{ color: 'var(--color-text-muted)' }}>
                {' '}· {invitations.length} {invitations.length === 1 ? 'convite pendente' : 'convites pendentes'}
              </span>
            )}
          </p>
          <AddButton onClick={openAdd} />
        </div>

        {/* Membros (inativos por último, mais apagados) */}
        <ul className="flex flex-col gap-3">
          {members.length === 0 && <ListEmpty>Nenhum membro cadastrado.</ListEmpty>}
          {[...active, ...inactive].map((m) => {
            const nome = m.profiles?.name ?? '—'
            const isSelf = m.profile_id === currentProfileId
            const cpf = cpfMask(m.profiles?.cpf ?? null)
            return (
              <div key={m.id} style={{ opacity: m.status !== 'active' ? 0.55 : 1 }}>
                <ListItem
                  media={<Avatar src={m.profiles?.avatar_url} alt={nome}>{nome.charAt(0).toUpperCase()}</Avatar>}
                  title={
                    <>
                      {nome}
                      {isSelf && <span className="ml-2 text-xs font-normal" style={{ color: 'var(--color-text-muted)' }}>(você)</span>}
                    </>
                  }
                  subtitle={[cpf ? `CPF ${cpf}` : null, `Desde ${formatDate(m.created_at)}`].filter(Boolean).join(' · ')}
                  aside={
                    <>
                      <span className="hidden sm:inline-flex"><RoleBadge role={m.role} /></span>
                      <StatusBadge status={m.status} />
                    </>
                  }
                  actionsLabel={nome}
                  actions={
                    m.status !== 'active'
                      ? [{ icon: 'pencil', label: 'Sem ações para membro inativo', onClick: () => {}, disabled: true }]
                      : isSelf
                        ? [
                            { icon: 'eye', label: 'Visualizar', onClick: () => { setPainelMember(m); setPainelOpen(true) } },
                            { icon: 'pencil', label: 'Editar', onClick: () => openEdit(m) },
                          ]
                        : [
                            { icon: 'pencil', label: 'Editar', onClick: () => openEdit(m) },
                            { icon: 'trash', label: 'Remover', tone: 'danger', onClick: () => setRemoveTarget(m), disabled: removing && removeTarget?.id === m.id },
                          ]
                  }
                />
              </div>
            )
          })}
        </ul>
      </div>

      {/* Convites pendentes */}
      {invitations.length > 0 && (
        <div className="app-card p-5 flex flex-col gap-4 mt-6">
          <h2 className="text-lg font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
            Convites pendentes
          </h2>
          <ul className="flex flex-col gap-3">
            {invitations.map((inv) => (
              <ListItem
                key={inv.id}
                media={<Avatar src={inv.avatar_url} alt={inv.email}><Icon name="mail" size={18} /></Avatar>}
                title={inv.email}
                subtitle={`Enviado em ${formatDate(inv.created_at)} · Expira em ${formatDate(inv.expires_at)}`}
                aside={
                  <span
                    className="hidden sm:inline-flex text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
                    style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}
                  >
                    {ROLE_LABELS[inv.role] ?? inv.role}
                  </span>
                }
                actionsLabel={`convite de ${inv.email}`}
                actions={[
                  { icon: 'mail', label: resendingId === inv.id ? 'Reenviando…' : 'Reenviar convite', onClick: () => handleResendInvite(inv), disabled: resendingId === inv.id },
                  { icon: 'trash', label: 'Cancelar convite', tone: 'danger', onClick: () => setCancelTarget(inv), disabled: cancelling && cancelTarget?.id === inv.id },
                ]}
              />
            ))}
          </ul>
        </div>
      )}

      <ModalUsuario
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        companyId={companyId}
        member={editingMember}
        currentUserRole={currentUserRole}
      />

      <ModalPainelUsuario
        open={painelOpen}
        onClose={() => { setPainelOpen(false); setPainelMember(null) }}
        member={painelMember}
        email={currentUserEmail}
      />

      <ConfirmDialog
        open={!!removeTarget}
        onClose={() => { if (!removing) setRemoveTarget(null) }}
        onConfirm={confirmRemove}
        loading={removing}
        title="Remover membro"
        message={<p>Remover <strong>{removeTarget?.profiles?.name ?? 'este membro'}</strong> da empresa? Ele perde o acesso imediatamente.</p>}
      />

      <ConfirmDialog
        open={!!cancelTarget}
        onClose={() => { if (!cancelling) setCancelTarget(null) }}
        onConfirm={confirmCancelInvite}
        loading={cancelling}
        title="Cancelar convite"
        message={<p>Cancelar o convite enviado para <strong>{cancelTarget?.email}</strong>?</p>}
      />
    </>
  )
}
