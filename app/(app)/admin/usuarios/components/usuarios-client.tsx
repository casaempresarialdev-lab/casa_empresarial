'use client'

import { useState } from 'react'
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
}

function cpfMask(cpf: string | null) {
  if (!cpf) return '—'
  const d = cpf.replace(/\D/g, '')
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`
}

export function UsuariosClient({ members, invitations, companyId, currentProfileId }: Props) {
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
                  {m.profiles?.name ?? '—'}
                  {m.profile_id === currentProfileId && (
                    <span className="ml-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>(você)</span>
                  )}
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
                  <div className="flex items-center gap-2 justify-end">
                    {m.status === 'active' && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(m)}>Editar</Button>
                        {m.profile_id !== currentProfileId && (
                          <Button
                            variant="danger"
                            size="sm"
                            loading={removingId === m.id}
                            onClick={() => handleRemove(m)}
                          >
                            Remover
                          </Button>
                        )}
                      </>
                    )}
                  </div>
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
      />
    </>
  )
}
