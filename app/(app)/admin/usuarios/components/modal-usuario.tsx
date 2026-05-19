'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { addMemberAction, updateMemberRoleAction, inviteUserAction } from '../actions'
import type { MemberWithProfile } from '../queries'

const ROLE_OPTIONS = [
  { value: 'admin',      label: 'Administrador' },
  { value: 'member',     label: 'Membro' },
  { value: 'accountant', label: 'Contador' },
]

function formatCpf(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`
}

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  member: MemberWithProfile | null
}

export function ModalUsuario({ open, onClose, companyId, member }: Props) {
  const router = useRouter()
  const isEditing = !!member

  // Tabs: só visíveis ao adicionar (não ao editar)
  const [tab, setTab] = useState<'cpf' | 'invite'>('cpf')

  const [cpf, setCpf] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('member')
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setTab('cpf')
      setCpf('')
      setEmail('')
      setRole(member?.role === 'owner' ? 'owner' : (member?.role ?? 'member'))
      setError('')
      setSuccessMsg('')
    }
  }, [open, member])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccessMsg('')
    setLoading(true)

    let result: { error?: string; success?: boolean; warning?: string }

    if (isEditing) {
      result = await updateMemberRoleAction(member!.id, role)
    } else if (tab === 'cpf') {
      result = await addMemberAction(companyId, cpf, role)
    } else {
      result = await inviteUserAction(companyId, email, role)
    }

    setLoading(false)

    if ('warning' in result && result.warning) {
      setSuccessMsg(result.warning)
      router.refresh()
      return
    }
    if ('error' in result && result.error) {
      setError(result.error)
      return
    }

    onClose()
    router.refresh()
  }

  const roleOptions = isEditing && member?.role === 'owner'
    ? [{ value: 'owner', label: 'Proprietário' }, ...ROLE_OPTIONS]
    : ROLE_OPTIONS

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? 'Editar membro' : 'Adicionar membro'}
      description={isEditing ? (member?.profiles?.name ?? '') : undefined}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">

        {/* Abas — só no modo adição */}
        {!isEditing && (
          <div className="flex rounded-lg p-1" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
            {(['cpf', 'invite'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { setTab(t); setError('') }}
                className="flex-1 py-1.5 text-sm rounded-md transition-all font-medium"
                style={tab === t
                  ? { backgroundColor: 'white', color: 'var(--color-text-primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
                  : { color: 'var(--color-text-muted)' }
                }
              >
                {t === 'cpf' ? 'Buscar por CPF' : 'Convidar por e-mail'}
              </button>
            ))}
          </div>
        )}

        {/* Campos por aba */}
        {!isEditing && tab === 'cpf' && (
          <Input
            label="CPF do usuário"
            placeholder="000.000.000-00"
            value={cpf}
            onChange={(e) => setCpf(formatCpf(e.target.value))}
            required
          />
        )}

        {!isEditing && tab === 'invite' && (
          <Input
            label="E-mail do usuário"
            type="email"
            placeholder="usuario@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            hint="O usuário receberá um e-mail com o link para criar a conta"
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
          <p className="text-sm p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>
            {error}
          </p>
        )}

        {successMsg && (
          <p className="text-sm p-3 rounded-lg bg-yellow-50 text-yellow-800">
            {successMsg}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>
            {isEditing ? 'Salvar' : tab === 'invite' ? 'Enviar convite' : 'Adicionar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
