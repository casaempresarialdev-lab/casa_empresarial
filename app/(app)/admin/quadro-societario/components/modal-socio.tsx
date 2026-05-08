'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createSocioAction, updateSocioAction } from '../actions'
import type { Socio } from '../queries'

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  socio: Socio | null
}

function formatCpf(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`
}

export function ModalSocio({ open, onClose, companyId, socio }: Props) {
  const router = useRouter()
  const isEditing = !!socio

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [cpf, setCpf] = useState('')

  useEffect(() => {
    if (open) {
      setCpf(socio?.cpf ? formatCpf(socio.cpf) : '')
      setError('')
    }
  }, [open, socio])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const fd = new FormData(e.currentTarget)
    fd.set('cpf', cpf)

    const result = isEditing
      ? await updateSocioAction(socio!.id, fd)
      : await createSocioAction(companyId, fd)

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
      title={isEditing ? 'Editar sócio' : 'Novo sócio'}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Nome *"
          name="nome"
          defaultValue={socio?.nome ?? ''}
          required
          placeholder="Nome completo"
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="CPF"
            placeholder="000.000.000-00"
            value={cpf}
            onChange={(e) => setCpf(formatCpf(e.target.value))}
          />
          <Input
            label="Participação (%)"
            name="participacao"
            type="number"
            min="0"
            max="100"
            step="0.01"
            defaultValue={socio?.participacao ?? ''}
            placeholder="0,00"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Cargo"
            name="cargo"
            defaultValue={socio?.cargo ?? ''}
            placeholder="Ex: Sócio-Administrador"
          />
          <Input
            label="E-mail"
            name="email"
            type="email"
            defaultValue={socio?.email ?? ''}
            placeholder="email@exemplo.com"
          />
        </div>

        <Input
          label="Telefone"
          name="telefone"
          defaultValue={socio?.telefone ?? ''}
          placeholder="(00) 00000-0000"
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
