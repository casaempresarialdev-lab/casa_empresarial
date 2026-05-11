'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { RoleBadge, StatusBadge } from '@/components/ui/badge'
import { ModalUsuario } from './modal-usuario'
import { removeMemberAction } from '../actions'
import type { MemberWithProfile } from '../queries'
import { formatDate } from '@/lib/utils'

interface Props {
  members: MemberWithProfile[]
  companyId: string
  currentProfileId: string
}

function cpfMask(cpf: string | null) {
  if (!cpf) return '—'
  const d = cpf.replace(/\D/g, '')
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`
}

export function UsuariosClient({ members, companyId, currentProfileId }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<MemberWithProfile | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [removeError, setRemoveError] = useState('')

  function openAdd() {
    setEditingMember(null)
    setModalOpen(true)
  }

  function openEdit(member: MemberWithProfile) {
    setEditingMember(member)
    setModalOpen(true)
  }

  async function handleRemove(member: MemberWithProfile) {
    if (!confirm(`Remover ${member.profiles?.name ?? 'este membro'} da empresa?`)) return
    setRemovingId(member.id)
    setRemoveError('')
    const result = await removeMemberAction(member.id, companyId)
    setRemovingId(null)
    if ('error' in result) {
      setRemoveError(result.error ?? 'Erro ao remover.')
    } else {
      router.refresh()
    }
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

      {removeError && (
        <p className="text-sm mb-4 p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>
          {removeError}
        </p>
      )}

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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(m)}
                        >
                          Editar
                        </Button>
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

      <ModalUsuario
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        companyId={companyId}
        member={editingMember}
      />
    </>
  )
}
