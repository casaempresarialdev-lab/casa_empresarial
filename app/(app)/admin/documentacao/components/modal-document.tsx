'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { FileDropZone } from '@/components/ui/file-drop-zone'
import { toast } from '@/lib/toast'
import { uploadDocumentAction, updateDocumentAction } from '../actions'
import type { Document, DocumentFolder } from '../queries'
import { flattenFolders, folderPath } from '../folder-tree'

const MAX_FILE_BYTES = 50 * 1024 * 1024

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  document?: Document | null
  /** Pastas disponíveis (vazio = tabela de pastas ainda não criada: o campo some) */
  folders: DocumentFolder[]
  /** Pasta já escolhida ao adicionar de dentro de uma pasta */
  defaultFolderId?: string | null
}

export function ModalDocument({ open, onClose, companyId, document, folders, defaultFolderId = null }: Props) {
  const router = useRouter()
  const isEditing = !!document

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [descricao, setDescricao] = useState('')
  const [folderId, setFolderId] = useState('')
  // Campos destacados com borda vermelha (o aviso vai no toast)
  const [invalid, setInvalid] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setSelectedFile(null)
      setDescricao(document?.descricao ?? '')
      setFolderId((document ? document.folder_id : defaultFolderId) ?? '')
      setInvalid(new Set())
    }
  }, [open, document, defaultFolderId])

  function handleClose() {
    setSelectedFile(null)
    setInvalid(new Set())
    onClose()
  }

  function clearInvalid(name: string) {
    setInvalid((prev) => {
      if (!prev.has(name)) return prev
      const next = new Set(prev)
      next.delete(name)
      return next
    })
  }

  // Arquivo escolhido no clique ou solto na área; sugere a descrição pelo nome
  function handleFile(file: File) {
    setSelectedFile(file)
    clearInvalid('file')
    if (!descricao) {
      setDescricao(file.name.replace(/\.[^/.]+$/, ''))
      clearInvalid('descricao')
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const vazios = [
      ...(!isEditing && !selectedFile ? ['file'] : []),
      ...(!descricao.trim() ? ['descricao'] : []),
    ]
    if (vazios.length) {
      setInvalid(new Set(vazios))
      toast.error('Preencha todos os campos obrigatórios.')
      return
    }
    setInvalid(new Set())
    setLoading(true)

    const fd = new FormData(e.currentTarget)
    if (!isEditing) fd.set('file', selectedFile!)
    if (folders.length) fd.set('folder_id', folderId)

    // Resultado do servidor no toast (✓ / ✕); com erro, o modal continua aberto
    const result = await toast.promise(
      isEditing ? updateDocumentAction(document!.id, companyId, fd) : uploadDocumentAction(companyId, fd),
      {
        loading: isEditing ? 'Salvando documento…' : 'Enviando documento…',
        success: isEditing ? `${descricao} foi atualizado.` : `${descricao} foi enviado para a documentação.`,
        error: 'Não foi possível salvar o documento.',
      },
    )

    setLoading(false)
    if (!result.error) {
      handleClose()
      router.refresh()
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isEditing ? 'Editar documento' : 'Novo documento'}
      description={isEditing ? document?.nome : 'Envie o arquivo e preencha as informações'}
      className="sm:max-w-2xl"
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">

        {/* Seleção de arquivo — apenas no cadastro (clique ou arraste e solte) */}
        {!isEditing && (
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Arquivo *</p>
            <FileDropZone file={selectedFile} onFile={handleFile} maxBytes={MAX_FILE_BYTES} invalid={invalid.has('file')} />
          </div>
        )}

        {folders.length > 0 && (
          <div className="flex flex-col gap-1">
            <label htmlFor="documento-pasta" className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Pasta
            </label>
            <select
              id="documento-pasta"
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              className="h-10 w-full rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
              style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: '#fff' }}
            >
              <option value="">Raiz (nenhuma pasta)</option>
              {/* Caminho completo (ex.: Contratos / Fornecedores) */}
              {flattenFolders(folders).map(({ folder }) => (
                <option key={folder.id} value={folder.id}>
                  {folderPath(folders, folder.id).map((p) => p.nome).join(' / ')}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <Input
              label="Descrição *"
              name="descricao"
              placeholder="Ex: Contrato Social, Alvará de Funcionamento"
              value={descricao}
              onChange={(e) => { setDescricao(e.target.value); clearInvalid('descricao') }}
              invalid={invalid.has('descricao')}
            />
          </div>
          <Input
            label="Vencimento"
            name="vencimento"
            type="date"
            defaultValue={document?.vencimento?.split('T')[0] ?? ''}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="documento-observacao" className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            Observação
          </label>
          <textarea
            id="documento-observacao"
            name="observacao"
            rows={3}
            placeholder="Informações adicionais sobre o documento"
            defaultValue={document?.observacao ?? ''}
            className="w-full rounded-lg border px-3 py-2 text-sm resize-none placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
            style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: '#fff' }}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>{isEditing ? 'Salvar' : 'Enviar'}</Button>
        </div>
      </form>
    </Modal>
  )
}
