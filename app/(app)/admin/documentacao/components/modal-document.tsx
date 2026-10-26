'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { toast } from '@/lib/toast'
import { uploadDocumentAction, updateDocumentAction } from '../actions'
import type { Document } from '../queries'

const MAX_FILE_BYTES = 50 * 1024 * 1024

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
  const [descricao, setDescricao] = useState('')
  // Campos destacados com borda vermelha (o aviso vai no toast)
  const [invalid, setInvalid] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setSelectedFile(null)
      setDescricao(document?.descricao ?? '')
      setInvalid(new Set())
    }
  }, [open, document])

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

  // Mesmo tratamento para arquivo escolhido no clique ou solto na área (drag and drop)
  function selectFile(file: File | null) {
    if (file && file.size > MAX_FILE_BYTES) {
      toast.error('Arquivo muito grande. O máximo é 50 MB.')
      return false
    }
    setSelectedFile(file)
    clearInvalid('file')
    // Sugere a descrição a partir do nome do arquivo
    if (file && !descricao) {
      setDescricao(file.name.replace(/\.[^/.]+$/, ''))
      clearInvalid('descricao')
    }
    return true
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!selectFile(e.target.files?.[0] ?? null)) e.target.value = ''
  }

  // Drag and drop: destaca a área enquanto o arquivo está por cima
  const [dragging, setDragging] = useState(false)

  // Com o modal aberto, soltar o arquivo fora da área não faz o navegador abrir o arquivo (e sair da página)
  useEffect(() => {
    if (!open) return
    const block = (e: DragEvent) => e.preventDefault()
    window.addEventListener('dragover', block)
    window.addEventListener('drop', block)
    return () => {
      window.removeEventListener('dragover', block)
      window.removeEventListener('drop', block)
    }
  }, [open])

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault() // sem isso o navegador abre o arquivo em vez de soltar na área
    if (!dragging) setDragging(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    // Ignora quando o cursor só passou para um elemento de dentro da área
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const files = e.dataTransfer.files
    if (files.length > 1) toast.error('Solte um arquivo por vez. Só o primeiro foi considerado.')
    if (files.length) selectFile(files[0])
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

  const fileInvalid = invalid.has('file')

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isEditing ? 'Editar documento' : 'Novo documento'}
      description={isEditing ? document?.nome : 'Envie o arquivo e preencha as informações'}
      className="sm:max-w-2xl"
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">

        {/* Seleção de arquivo — apenas no cadastro */}
        {!isEditing && (
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Arquivo *</p>
            {/* Clique ou arraste o arquivo para a área */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragEnter={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`flex items-center gap-3 rounded-xl border-2 border-dashed px-4 py-5 text-left transition-colors ${
                dragging ? 'bg-[var(--color-brand-light)]' : fileInvalid ? 'border-red-400 bg-red-50/40' : 'hover:bg-[var(--color-brand-light)]'
              }`}
              style={dragging
                ? { borderColor: 'var(--color-brand)' }
                : fileInvalid ? undefined : { borderColor: selectedFile ? 'var(--color-brand)' : 'var(--color-card-border-hover)' }}
            >
              <span
                className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-transform ${dragging ? 'scale-110' : ''}`}
                style={dragging
                  ? { backgroundColor: 'var(--color-brand)', color: '#fff' }
                  : { backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}
              >
                <Icon name="file" size={20} />
              </span>
              <span className="flex-1 min-w-0 pointer-events-none">
                <span className="block text-sm font-medium truncate" style={{ color: selectedFile || dragging ? 'var(--color-text-primary)' : 'var(--color-sidebar-text)' }}>
                  {dragging ? 'Solte o arquivo aqui' : selectedFile ? selectedFile.name : 'Arraste o arquivo para cá ou clique para selecionar'}
                </span>
                <span className="block text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {selectedFile && !dragging
                    ? `${(selectedFile.size / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB · arraste outro ou clique para trocar`
                    : 'Qualquer formato · até 50 MB'}
                </span>
              </span>
            </button>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
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
