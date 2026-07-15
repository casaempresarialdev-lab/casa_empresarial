'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { RoleBadge, StatusBadge } from '@/components/ui/badge'
import { ModalUsuario } from './modal-usuario'
import { removeMemberAction, cancelInvitationAction } from '../actions'
import type { MemberWithProfile, Invitation } from '../queries'
import { formatDate } from '@/lib/utils'

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
}

function cpfMask(cpf: string | null) {
  if (!cpf) return '—'
  const d = cpf.replace(/\D/g, '')
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`
}

function ThreeDotMenu({ onEdit, onRemove, loading }: { onEdit: () => void; onRemove: () => void; loading: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-lg hover:bg-gray-100 transition-colors"
        style={{ color: 'var(--color-text-muted)' }}
        aria-label="Opções"
      >
        ···
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-36 rounded-xl border shadow-lg py-1 z-20"
          style={{ backgroundColor: 'white', borderColor: 'var(--color-bg-surface)' }}
        >
          <button
            type="button"
            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
            onClick={() => { setOpen(false); onEdit() }}
          >
            Editar
          </button>
          <button
            type="button"
            className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 transition-colors"
            style={{ color: 'var(--color-error)' }}
            onClick={() => { setOpen(false); onRemove() }}
            disabled={loading}
          >
            {loading ? 'Removendo…' : 'Excluir'}
          </button>
        </div>
      )}
    </div>
  )
}

export function UsuariosClient({ members, invitations, companyId, currentProfileId, currentUserRole }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<MemberWithProfile | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  function openAdd() { setEditingMember(null); setModalOpen(true) }
  function openEdit(member: MemberWithProfile) { setEditingMember(member); setModalOpen(true) }

  async function handleRemove(member: MemberWithProfile) {
    if (!confirm(`Remover ${member.profiles?.name ?? 'este membro'} da empresa?`)) return
    setRemovingId(member.id)
    setErrorMsg('')
    const result = await removeMemberAction(member.id, companyId)
    setRemovingId(null)
    if ('error' in result) setErrorMsg(result.error ?? 'Erro ao remover.')
    else router.refresh()
  }

  async function handleCancelInvite(inv: Invitation) {
    if (!confirm(`Cancelar convite para ${inv.email}?`)) return
    setCancellingId(inv.id)
    setErrorMsg('')
    const result = await cancelInvitationAction(inv.id, companyId)
    setCancellingId(null)
    if ('error' in result) setErrorMsg(result.error ?? 'Erro ao cancelar.')
    else router.refresh()
  }

  const active = members.filter((m) => m.status === 'active')
  const inactive = members.filter((m) => m.status !== 'active')

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
            Usuários
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Membros com acesso a esta empresa
          </p>
        </div>
        <Button onClick={openAdd}>+ Adicionar</Button>
      </div>

      {errorMsg && (
        <p className="text-sm mb-4 p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>
          {errorMsg}
        </p>
      )}

      {/* ── Membros ── */}
      <div className="rounded-xl border overflow-x-auto" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
        <table className="w-full min-w-[600px] text-sm">
          <thead style={{ backgroundColor: 'var(--color-bg-surface)' }}>
            <tr>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Nome</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>CPF</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Função</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Status</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Desde</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {active.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-10" style={{ color: 'var(--color-text-muted)' }}>
                  Nenhum membro ativo.
                </td>
              </tr>
            )}
            {[...active, ...inactive].map((m) => (
              <tr
                key={m.id}
                className="border-t"
                style={{ borderColor: 'var(--color-bg-surface)', opacity: m.status !== 'active' ? 0.5 : 1 }}
              >
                <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  <div className="flex items-center gap-2">
                    {m.profiles?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.profiles.avatar_url}
                        alt={m.profiles.name ?? ''}
                        className="w-7 h-7 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-darker)' }}
                      >
                        {m.profiles?.name?.charAt(0).toUpperCase() ?? '?'}
                      </div>
                    )}
                    <span>
                      {m.profiles?.name ?? '—'}
                      {m.profile_id === currentProfileId && (
                        <span className="ml-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>(você)</span>
                      )}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>
                  {cpfMask(m.profiles?.cpf ?? null)}
                </td>
                <td className="px-4 py-3"><RoleBadge role={m.role} /></td>
                <td className="px-4 py-3"><StatusBadge status={m.status} /></td>
                <td className="px-4 py-3" style={{ color: 'var(--color-text-muted)' }}>
                  {formatDate(m.created_at)}
                </td>
                <td className="px-4 py-3">
                  {m.status === 'active' && m.profile_id !== currentProfileId && (
                    <div className="flex justify-end">
                      <ThreeDotMenu
                        onEdit={() => openEdit(m)}
                        onRemove={() => handleRemove(m)}
                        loading={removingId === m.id}
                      />
                    </div>
                  )}
                  {m.status === 'active' && m.profile_id === currentProfileId && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-lg hover:bg-gray-100 transition-colors"
                        style={{ color: 'var(--color-text-muted)' }}
                        onClick={() => openEdit(m)}
                        aria-label="Editar perfil"
                      >
                        ···
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Convites pendentes ── */}
      {invitations.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-secondary)' }}>
            Convites pendentes
          </h2>
          <div className="rounded-xl border overflow-x-auto" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
            <table className="w-full min-w-[500px] text-sm">
              <thead style={{ backgroundColor: 'var(--color-bg-surface)' }}>
                <tr>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>E-mail</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Função</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Enviado em</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Expira em</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {invitations.map((inv) => (
                  <tr key={inv.id} className="border-t" style={{ borderColor: 'var(--color-bg-surface)' }}>
                    <td className="px-4 py-3" style={{ color: 'var(--color-text-primary)' }}>{inv.email}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>
                      {ROLE_LABELS[inv.role] ?? inv.role}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--color-text-muted)' }}>
                      {formatDate(inv.created_at)}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--color-text-muted)' }}>
                      {formatDate(inv.expires_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <Button
                          variant="danger"
                          size="sm"
                          loading={cancellingId === inv.id}
                          onClick={() => handleCancelInvite(inv)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ModalUsuario
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        companyId={companyId}
        member={editingMember}
        currentUserRole={currentUserRole}
      />
    </>
  )
}
