'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { toast } from '@/lib/toast'
import { updateSocioFotoAction } from '../actions'
import type { Socio } from '../queries'

const MAX_FOTO_BYTES = 5 * 1024 * 1024

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  socio: Socio | null
}

export function ModalSocioFoto({ open, onClose, companyId, socio }: Props) {
  const router = useRouter()
  // Arquivo novo, prévia (atual ou nova) e pedido de remoção
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [removeFoto, setRemoveFoto] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setFotoFile(null)
      setFotoPreview(socio?.foto_url ?? null)
      setRemoveFoto(false)
    }
  }, [open, socio])

  function pickFile(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('A foto precisa ser uma imagem.'); return }
    if (file.size > MAX_FOTO_BYTES) { toast.error('A foto passa de 5 MB.'); return }
    setFotoFile(file)
    setFotoPreview(URL.createObjectURL(file))
    setRemoveFoto(false)
  }

  function handleRemove() {
    setFotoFile(null)
    setFotoPreview(null)
    setRemoveFoto(!!socio?.foto_path)
  }

  const changed = !!fotoFile || removeFoto

  async function handleSave() {
    if (!socio || !changed) return
    const fd = new FormData()
    if (fotoFile) fd.set('foto_file', fotoFile)
    if (removeFoto) fd.set('remove_foto', 'true')
    setLoading(true)
    const result = await toast.promise(updateSocioFotoAction(socio.id, companyId, fd), {
      loading: removeFoto ? 'Removendo foto…' : 'Enviando foto…',
      success: removeFoto ? `A foto de ${socio.nome} foi removida.` : `A foto de ${socio.nome} foi atualizada.`,
      error: 'Não foi possível salvar a foto.',
    })
    setLoading(false)
    if (!('error' in result)) {
      onClose()
      router.refresh()
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Foto do sócio" description={socio?.nome}>
      <div className="flex flex-col items-center gap-4">
        {/* Prévia redonda: clique ou arraste e solte uma imagem */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files?.[0]) }}
          className="w-40 h-40 rounded-full overflow-hidden flex items-center justify-center border-2 border-dashed transition-colors"
          style={{
            borderColor: dragging ? 'var(--color-brand)' : 'var(--color-card-border)',
            backgroundColor: 'var(--color-brand-light)',
            color: 'var(--color-brand)',
          }}
          aria-label="Escolher foto"
        >
          {fotoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fotoPreview} alt={socio?.nome ?? 'Foto do sócio'} className="w-full h-full object-cover" />
          ) : (
            <Icon name="user" size={56} />
          )}
        </button>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = '' }} />

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-sm px-4 py-2 rounded-lg border transition-colors hover:bg-gray-50"
            style={{ borderColor: 'var(--color-card-border)', color: 'var(--color-sidebar-text)' }}
          >
            {fotoPreview ? 'Trocar foto' : 'Escolher foto'}
          </button>
          {fotoPreview && (
            <button type="button" onClick={handleRemove} className="text-sm hover:underline" style={{ color: '#B91C1C' }}>
              Remover
            </button>
          )}
        </div>
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Clique ou arraste uma imagem · JPG, PNG ou WEBP · até 5 MB</span>
      </div>

      <div className="flex justify-end gap-2 pt-6">
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="button" onClick={handleSave} loading={loading} disabled={!changed}>Salvar</Button>
      </div>
    </Modal>
  )
}
