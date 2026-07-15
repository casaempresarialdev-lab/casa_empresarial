'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { uploadDocumentAction, updateDocumentAction } from '../actions'
import type { Document } from '../queries'

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  document?: Document | null
}

export function ModalDocument({ open, onClose, companyId, document }: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isEditing = !!document

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setSelectedFile(null)
      setError('')
    }
  }, [open, document])

  function handleClose() {
    setSelectedFile(null)
    setError('')
    onClose()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSelectedFile(e.target.files?.[0] ?? null)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!isEditing && !selectedFile) { setError('Selecione um arquivo.'); return }
    setError('')
    setLoading(true)

    const fd = new FormData(e.currentTarget)
    let result: { error?: string }

    if (isEditing) {
      result = await updateDocumentAction(document!.id, companyId, fd)
    } else {
      fd.set('file', selectedFile!)
      result = await uploadDocumentAction(companyId, fd)
    }

    setLoading(false)
    if (result.error) {
      setError(result.error)
    } else {
      handleClose()
      router.refresh()
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isEditing ? 'Editar documento' : 'Novo documento'}
      description={isEditing ? document?.nome : 'Faça o upload de um arquivo e preencha as informações'}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">

        {/* Seleção de arquivo — apenas no modo criação */}
        {!isEditing && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>
              Arquivo *
            </p>
            <div
              className="flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors"
              style={{ borderColor: 'var(--color-bg-surface)' }}
              onClick={() => fileInputRef.current?.click()}
            >
              <span className="text-lg">📎</span>
              <span className="text-sm truncate flex-1" style={{ color: selectedFile ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
                {selectedFile ? selectedFile.name : 'Clique para selecionar o arquivo'}
              </span>
              <Button type="button" variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}>
                Selecionar
              </Button>
            </div>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Máximo 50 MB</p>
          </div>
        )}

        <Input
          label="Descrição *"
          name="descricao"
          placeholder="Ex: Contrato Social, Alvará de Funcionamento"
          defaultValue={document?.descricao ?? ''}
          required
        />

        <Input
          label="Vencimento"
          name="vencimento"
          type="date"
          defaultValue={document?.vencimento?.split('T')[0] ?? ''}
        />

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
            Observação
          </label>
          <textarea
            name="observacao"
            rows={3}
            placeholder="Informações adicionais sobre o documento"
            defaultValue={document?.observacao ?? ''}
            className="w-full rounded-lg border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#C19A6B]"
            style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: '#fff' }}
          />
        </div>

        {error && (
          <p className="text-sm p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>{isEditing ? 'Salvar' : 'Enviar'}</Button>
        </div>
      </form>
    </Modal>
  )
}
