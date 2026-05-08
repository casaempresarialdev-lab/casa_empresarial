'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createCredentialAction, updateCredentialAction } from '../actions'
import type { Credential } from '../queries'

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  credential: Credential | null
}

export function ModalCredential({ open, onClose, companyId, credential }: Props) {
  const router = useRouter()
  const isEditing = !!credential

  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setShowPassword(false)
      setError('')
    }
  }, [open, credential])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const fd = new FormData(e.currentTarget)
    const result = isEditing
      ? await updateCredentialAction(credential!.id, companyId, fd)
      : await createCredentialAction(companyId, fd)

    setLoading(false)
    if ('error' in result) {
      setError(result.error ?? 'Erro desconhecido.')
    } else {
      onClose()
      router.refresh()
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? 'Editar credencial' : 'Nova credencial'}
      description="Os dados são criptografados antes de salvar"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Sistema / Plataforma *"
          name="sistema"
          defaultValue={credential?.sistema ?? ''}
          required
          placeholder="Ex: Banco do Brasil, Instagram, Nota Fiscal"
        />

        <Input
          label="Login / Usuário *"
          name="login"
          defaultValue={credential?.login ?? ''}
          required
          placeholder="email@exemplo.com ou CPF"
        />

        <div className="relative">
          <Input
            label={isEditing ? 'Nova senha (deixe em branco para manter)' : 'Senha *'}
            name="senha"
            type={showPassword ? 'text' : 'password'}
            required={!isEditing}
            placeholder={isEditing ? '••••••••' : 'Digite a senha'}
            className="pr-10"
          />
          <button
            type="button"
            className="absolute right-3 top-8 text-xs"
            style={{ color: 'var(--color-text-muted)' }}
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>

        <Input
          label="URL"
          name="url"
          type="url"
          defaultValue={credential?.url ?? ''}
          placeholder="https://..."
        />

        <Input
          label="Observação"
          name="observacao"
          defaultValue={credential?.observacao ?? ''}
          placeholder="Informações adicionais"
        />

        {error && (
          <p className="text-sm" style={{ color: 'var(--color-error)' }}>{error}</p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>{isEditing ? 'Salvar' : 'Adicionar'}</Button>
        </div>
      </form>
    </Modal>
  )
}
