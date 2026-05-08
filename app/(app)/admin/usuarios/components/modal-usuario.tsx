'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { addMemberAction, updateMemberRoleAction } from '../actions'
import type { MemberWithProfile } from '../queries'

const ROLE_OPTIONS = [
  { value: 'admin',      label: 'Administrador' },
  { value: 'member',     label: 'Membro' },
  { value: 'accountant', label: 'Contador' },
]

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  member: MemberWithProfile | null
}

function formatCpf(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`
}

export function ModalUsuario({ open, onClose, companyId, member }: Props) {
  const router = useRouter()
  const isEditing = !!member

  const [cpf, setCpf] = useState('')
  const [role, setRole] = useState('member')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setCpf('')
      setRole(member?.role === 'owner' ? 'owner' : (member?.role ?? 'member'))
      setError('')
    }
  }, [open, member])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    let result
    if (isEditing) {
      result = await updateMemberRoleAction(member!.id, role)
    } else {
      result = await addMemberAction(companyId, cpf, role)
    }

    setLoading(false)
    if ('error' in result) {
      setError(result.error ?? 'Erro desconhecido.')
    } else {
      onClose()
      router.refresh()
    }
  }

  const roleOptions = isEditing && member?.role === 'owner'
    ? [{ value: 'owner', label: 'Proprietário' }, ...ROLE_OPTIONS]
    : ROLE_OPTIONS

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? 'Editar membro' : 'Adicionar membro'}
      description={isEditing ? member?.profiles?.name ?? '' : 'Busca por CPF cadastrado no sistema'}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {!isEditing && (
          <Input
            label="CPF do usuário"
            placeholder="000.000.000-00"
            value={cpf}
            onChange={(e) => setCpf(formatCpf(e.target.value))}
            required
          />
        )}

        <Select
          label="Função"
          options={roleOptions}
          value={role}
          onChange={(e) => setRole(e.target.value)}
          disabled={isEditing && member?.role === 'owner'}
        />

        {error && (
          <p className="text-sm" style={{ color: 'var(--color-error)' }}>{error}</p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            {isEditing ? 'Salvar' : 'Adicionar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
