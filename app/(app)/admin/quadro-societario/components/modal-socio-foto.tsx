'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'
import { updateSocioFotoAction } from '../actions'
import type { Socio } from '../queries'
import { FotoPicker } from '@/components/ui/foto-picker'

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
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setFotoFile(null)
      setFotoPreview(socio?.foto_url ?? null)
      setRemoveFoto(false)
    }
  }, [open, socio])

  function handlePick(file: File) {
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
      <FotoPicker preview={fotoPreview} onPick={handlePick} onRemove={handleRemove} alt={socio?.nome ?? 'Foto do sócio'} />

      <div className="flex justify-end gap-2 pt-6">
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="button" onClick={handleSave} loading={loading} disabled={!changed}>Salvar</Button>
      </div>
    </Modal>
  )
}
