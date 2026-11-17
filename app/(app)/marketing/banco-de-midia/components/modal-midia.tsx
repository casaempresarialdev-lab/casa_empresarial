'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { MIDIA_AREAS } from '@/lib/marketing/constantes'
import { createMediaAssetAction, updateMediaAssetAction } from '../actions'
import type { MediaAsset } from '../queries'

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  midia: MediaAsset | null
}

const labelStyle = { color: 'var(--color-text-secondary)', fontSize: '0.75rem', fontWeight: 500, marginBottom: 4, display: 'block' }

export function ModalMidia({ open, onClose, companyId, midia }: Props) {
  const router = useRouter()
  const isEdit = !!midia
  const arquivoRef = useRef<HTMLInputElement>(null)

  const [nome, setNome] = useState('')
  const [area, setArea] = useState('geral')
  const [tema, setTema] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    if (arquivoRef.current) arquivoRef.current.value = ''
    if (midia) {
      setNome(midia.nome ?? '')
      setArea(midia.area)
      setTema(midia.tema ?? '')
    } else {
      setNome(''); setArea('geral'); setTema('')
    }
  }, [open, midia])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const fd = new FormData()
    fd.set('nome', nome)
    fd.set('area', area)
    fd.set('tema', tema)

    let result
    if (isEdit) {
      result = await updateMediaAssetAction(midia!.id, fd)
    } else {
      const arquivo = arquivoRef.current?.files?.[0]
      if (!arquivo) { setLoading(false); setError('Selecione um arquivo.'); return }
      fd.set('arquivo', arquivo)
      result = await createMediaAssetAction(companyId, fd)
    }

    setLoading(false)
    if ('error' in result) { setError(result.error ?? 'Erro ao salvar.'); return }
    router.refresh()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar mídia' : 'Adicionar mídia'} className="sm:max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {!isEdit && (
          <div>
            <label style={labelStyle}>Arquivo *</label>
            <input
              ref={arquivoRef}
              type="file"
              accept="image/*,video/*"
              onChange={(e) => { const f = e.target.files?.[0]; if (f && !nome) setNome(f.name) }}
              className="w-full text-sm"
            />
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Imagem ou vídeo — máx. 50 MB</p>
          </div>
        )}

        <div>
          <label style={labelStyle}>Nome *</label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do arquivo" required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label style={labelStyle}>Área</label>
            <select value={area} onChange={(e) => setArea(e.target.value)} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}>
              {MIDIA_AREAS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Tema (opcional)</label>
            <Input value={tema} onChange={(e) => setTema(e.target.value)} placeholder="Ex.: bastidores" />
          </div>
        </div>

        {error && <p className="text-sm p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>{error}</p>}

        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>{isEdit ? 'Salvar alterações' : 'Adicionar'}</Button>
        </div>
      </form>
    </Modal>
  )
}
