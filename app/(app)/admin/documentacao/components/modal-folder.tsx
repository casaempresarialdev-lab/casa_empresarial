'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'
import { createFolderAction, renameFolderAction } from '../actions'
import type { DocumentFolder } from '../queries'

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  /** Pasta a renomear (null = nova pasta) */
  folder?: DocumentFolder | null
  /** Onde a nova pasta será criada (null = raiz) */
  parentId?: string | null
  /** Nome da pasta de cima, para o subtítulo */
  parentName?: string | null
}

export function ModalFolder({ open, onClose, companyId, folder, parentId = null, parentName = null }: Props) {
  const router = useRouter()
  const isEditing = !!folder
  const [nome, setNome] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setNome(folder?.nome ?? '')
      setInvalid(false)
    }
  }, [open, folder])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!nome.trim()) {
      setInvalid(true)
      toast.error('Preencha todos os campos obrigatórios.')
      return
    }
    setLoading(true)
    const result = await toast.promise(
      isEditing ? renameFolderAction(folder!.id, companyId, nome) : createFolderAction(companyId, nome, parentId),
      {
        loading: isEditing ? 'Renomeando pasta…' : 'Criando pasta…',
        success: isEditing ? `Pasta renomeada para ${nome.trim()}.` : `Pasta ${nome.trim()} criada.`,
        error: 'Não foi possível salvar a pasta.',
      },
    )
    setLoading(false)
    if (!result.error) {
      onClose()
      router.refresh()
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? 'Renomear pasta' : 'Nova pasta'}
      description={isEditing ? undefined : parentName ? `Dentro de ${parentName}` : 'Na raiz da Documentação'}
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Input
          label="Nome da pasta *"
          placeholder="Ex: Contratos com fornecedores"
          value={nome}
          onChange={(e) => { setNome(e.target.value); setInvalid(false) }}
          invalid={invalid}
          autoFocus
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>{isEditing ? 'Salvar' : 'Criar pasta'}</Button>
        </div>
      </form>
    </Modal>
  )
}
