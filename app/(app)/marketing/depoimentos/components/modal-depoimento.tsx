'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { DEPOIMENTO_FONTES } from '@/lib/marketing/constantes'
import { createDepoimentoAction, updateDepoimentoAction } from '../actions'
import type { Depoimento } from '../queries'

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  depoimento: Depoimento | null
}

const labelStyle = { color: 'var(--color-text-secondary)', fontSize: '0.75rem', fontWeight: 500, marginBottom: 4, display: 'block' }

export function ModalDepoimento({ open, onClose, companyId, depoimento }: Props) {
  const router = useRouter()
  const isEdit = !!depoimento

  const [cliente, setCliente] = useState('')
  const [fonte, setFonte] = useState('whatsapp')
  const [fonteOutro, setFonteOutro] = useState('')
  const [data, setData] = useState('')
  const [texto, setTexto] = useState('')
  const [destaque, setDestaque] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    if (depoimento) {
      setCliente(depoimento.cliente)
      setFonte(depoimento.fonte)
      setFonteOutro(depoimento.fonte_outro ?? '')
      setData(depoimento.data ?? '')
      setTexto(depoimento.texto)
      setDestaque(depoimento.destaque)
    } else {
      setCliente(''); setFonte('whatsapp'); setFonteOutro(''); setData(''); setTexto(''); setDestaque(false)
    }
  }, [open, depoimento])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const fd = new FormData()
    fd.set('cliente', cliente)
    fd.set('fonte', fonte)
    fd.set('fonte_outro', fonteOutro)
    fd.set('data', data)
    fd.set('texto', texto)
    fd.set('destaque', String(destaque))

    const result = isEdit
      ? await updateDepoimentoAction(depoimento!.id, fd)
      : await createDepoimentoAction(companyId, fd)

    setLoading(false)
    if ('error' in result) { setError(result.error ?? 'Erro ao salvar.'); return }
    router.refresh()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar depoimento' : 'Novo depoimento'} className="sm:max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label style={labelStyle}>Cliente / empresa *</label>
          <Input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Ex.: Grão Dourado" required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label style={labelStyle}>Fonte</label>
            <select value={fonte} onChange={(e) => setFonte(e.target.value)} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}>
              {DEPOIMENTO_FONTES.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Data (opcional)</label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
        </div>

        {fonte === 'outro' && (
          <div>
            <label style={labelStyle}>Qual fonte?</label>
            <Input value={fonteOutro} onChange={(e) => setFonteOutro(e.target.value)} placeholder="Ex.: Indicação, evento..." />
          </div>
        )}

        <div>
          <label style={labelStyle}>Depoimento *</label>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={4}
            placeholder="Cole aqui o que o cliente disse (WhatsApp, Instagram, e-mail...)"
            className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
            style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
            required
          />
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--color-text-secondary)' }}>
          <input type="checkbox" checked={destaque} onChange={(e) => setDestaque(e.target.checked)} />
          Marcar como destaque
        </label>

        {error && <p className="text-sm p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>{error}</p>}

        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>{isEdit ? 'Salvar alterações' : 'Salvar'}</Button>
        </div>
      </form>
    </Modal>
  )
}
