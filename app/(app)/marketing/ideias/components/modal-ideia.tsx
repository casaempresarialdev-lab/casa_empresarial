'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { CONTEUDO_FORMATOS } from '@/lib/marketing/constantes'
import { createIdeiaMarketingAction, updateIdeiaMarketingAction } from '../actions'
import type { IdeiaMarketing } from '../queries'

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  ideia: IdeiaMarketing | null
}

const labelStyle = { color: 'var(--color-text-secondary)', fontSize: '0.75rem', fontWeight: 500, marginBottom: 4, display: 'block' }

export function ModalIdeia({ open, onClose, companyId, ideia }: Props) {
  const router = useRouter()
  const isEdit = !!ideia

  const [titulo, setTitulo] = useState('')
  const [formato, setFormato] = useState('')
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    setTitulo(ideia?.titulo ?? '')
    setFormato(ideia?.formato ?? '')
    setNotas(ideia?.notas ?? '')
  }, [open, ideia])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const fd = new FormData()
    fd.set('titulo', titulo)
    fd.set('formato', formato)
    fd.set('notas', notas)

    const result = isEdit
      ? await updateIdeiaMarketingAction(ideia!.id, fd)
      : await createIdeiaMarketingAction(companyId, fd)

    setLoading(false)
    if ('error' in result) { setError(result.error ?? 'Erro ao salvar.'); return }
    router.refresh()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar ideia' : 'Nova ideia'} className="sm:max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label style={labelStyle}>Ideia / tema *</label>
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Bastidores de como fechamos o mês" required />
        </div>

        <div>
          <label style={labelStyle}>Formato sugerido (opcional)</label>
          <select
            value={formato}
            onChange={(e) => setFormato(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border text-sm"
            style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
          >
            <option value="">—</option>
            {CONTEUDO_FORMATOS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </div>

        <div>
          <label style={labelStyle}>Notas (opcional)</label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={3}
            placeholder="Qualquer detalhe pra lembrar depois"
            className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
            style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
          />
        </div>

        {error && <p className="text-sm p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>{error}</p>}

        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>{isEdit ? 'Salvar alterações' : 'Salvar'}</Button>
        </div>
      </form>
    </Modal>
  )
}
