'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { METRICA_REDES } from '@/lib/marketing/constantes'
import { createMetricaRedeSocialAction } from '../actions'

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
}

const labelStyle = { color: 'var(--color-text-secondary)', fontSize: '0.75rem', fontWeight: 500, marginBottom: 4, display: 'block' }

export function ModalMetrica({ open, onClose, companyId }: Props) {
  const router = useRouter()
  const [rede, setRede] = useState('instagram')
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7))
  const [seguidores, setSeguidores] = useState('')
  const [alcance, setAlcance] = useState('')
  const [engajamento, setEngajamento] = useState('')
  const [observacao, setObservacao] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    setRede('instagram')
    setMes(new Date().toISOString().slice(0, 7))
    setSeguidores(''); setAlcance(''); setEngajamento(''); setObservacao('')
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const fd = new FormData()
    fd.set('rede', rede)
    fd.set('mes', mes)
    fd.set('seguidores', seguidores)
    fd.set('alcance', alcance)
    fd.set('engajamento', engajamento)
    fd.set('observacao', observacao)

    const result = await createMetricaRedeSocialAction(companyId, fd)

    setLoading(false)
    if ('error' in result) { setError(result.error ?? 'Erro ao salvar.'); return }
    router.refresh()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Novo registro mensal" className="sm:max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label style={labelStyle}>Rede *</label>
            <select value={rede} onChange={(e) => setRede(e.target.value)} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}>
              {METRICA_REDES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Mês *</label>
            <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} required />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label style={labelStyle}>Seguidores *</label>
            <Input value={seguidores} onChange={(e) => setSeguidores(e.target.value)} placeholder="Ex.: 3200" inputMode="numeric" required />
          </div>
          <div>
            <label style={labelStyle}>Alcance (opcional)</label>
            <Input value={alcance} onChange={(e) => setAlcance(e.target.value)} placeholder="Ex.: 8500" inputMode="numeric" />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Engajamento % (opcional)</label>
          <Input value={engajamento} onChange={(e) => setEngajamento(e.target.value)} placeholder="Ex.: 4,2" />
        </div>

        <div>
          <label style={labelStyle}>Observação (opcional)</label>
          <Input value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex.: campanha de aniversário no período" />
        </div>

        {error && <p className="text-sm p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>{error}</p>}

        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>Salvar</Button>
        </div>
      </form>
    </Modal>
  )
}
