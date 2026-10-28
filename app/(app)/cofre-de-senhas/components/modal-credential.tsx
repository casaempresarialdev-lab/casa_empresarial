'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { toast } from '@/lib/toast'
import { createCredentialAction, updateCredentialAction } from '../actions'
import type { Credential } from '../queries'

interface Props {
  open: boolean
  onClose: () => void
  credential: Credential | null
}

export function ModalCredential({ open, onClose, credential }: Props) {
  const router = useRouter()
  const isEditing = !!credential

  const formRef = useRef<HTMLFormElement>(null)
  const [showPassword, setShowPassword] = useState(false)
  // Campos destacados com borda vermelha (o aviso vai no toast)
  const [invalid, setInvalid] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setShowPassword(false)
      setInvalid(new Set())
    }
  }, [open, credential])

  // Na edição a senha pode ficar em branco (mantém a atual)
  const required = isEditing ? ['sistema', 'login'] : ['sistema', 'login', 'senha']

  const field = (name: string) => (formRef.current?.elements.namedItem(name) as HTMLInputElement | null)?.value ?? ''

  function clearInvalid(name: string) {
    setInvalid((prev) => {
      if (!prev.has(name)) return prev
      const next = new Set(prev)
      next.delete(name)
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const vazios = required.filter((name) => !field(name).trim())
    if (vazios.length) {
      setInvalid(new Set(vazios))
      toast.error('Preencha todos os campos obrigatórios.')
      return
    }
    setInvalid(new Set())
    setLoading(true)

    const fd = new FormData(e.currentTarget)
    const sistema = fd.get('sistema') as string
    // Resultado do servidor no toast (✓ / ✕); com erro, o modal continua aberto
    const result = await toast.promise(
      isEditing ? updateCredentialAction(credential!.id, fd) : createCredentialAction(fd),
      {
        loading: isEditing ? 'Salvando credencial…' : 'Guardando credencial no cofre…',
        success: isEditing ? `Credencial de ${sistema} atualizada.` : `Credencial de ${sistema} guardada no cofre.`,
        error: 'Não foi possível salvar a credencial.',
      },
    )

    setLoading(false)
    if (!('error' in result)) {
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
      className="sm:max-w-2xl"
    >
      <form ref={formRef} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Identificação *"
            name="sistema"
            defaultValue={credential?.sistema ?? ''}
            placeholder="Ex: Banco do Brasil, Instagram, Nota Fiscal"
            invalid={invalid.has('sistema')}
            onChange={() => clearInvalid('sistema')}
          />
          <Input
            label="Login / Usuário *"
            name="login"
            defaultValue={credential?.login ?? ''}
            placeholder="email@exemplo.com ou CPF"
            invalid={invalid.has('login')}
            onChange={() => clearInvalid('login')}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="relative">
            <Input
              label={isEditing ? 'Nova senha (em branco mantém a atual)' : 'Senha *'}
              name="senha"
              type={showPassword ? 'text' : 'password'}
              placeholder={isEditing ? '••••••••' : 'Digite a senha'}
              className="pr-10"
              autoComplete="new-password"
              invalid={invalid.has('senha')}
              onChange={() => clearInvalid('senha')}
            />
            <button
              type="button"
              className="absolute right-2 top-[30px] p-1 rounded-md hover:bg-gray-100"
              style={{ color: 'var(--color-text-muted)' }}
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            >
              <Icon name={showPassword ? 'eye-off' : 'eye'} size={16} />
            </button>
          </div>
          <Input
            label="URL de acesso"
            name="url"
            type="url"
            defaultValue={credential?.url ?? ''}
            placeholder="https://..."
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="credencial-observacao" className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            Observação
          </label>
          <textarea
            id="credencial-observacao"
            name="observacao"
            rows={3}
            defaultValue={credential?.observacao ?? ''}
            placeholder="Informações adicionais"
            className="w-full rounded-lg border px-3 py-2 text-sm resize-none placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
            style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: '#fff', color: 'var(--color-text-primary)' }}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>{isEditing ? 'Salvar' : 'Adicionar'}</Button>
        </div>
      </form>
    </Modal>
  )
}
