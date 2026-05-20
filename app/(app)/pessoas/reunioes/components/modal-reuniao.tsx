'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createMeetingAction, updateMeetingAction } from '../actions'
import type { Meeting, Participante } from '../queries'

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  meeting: Meeting | null
}

function datetimeLocal(ts: string | null): string {
  if (!ts) return ''
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function ModalReuniao({ open, onClose, companyId, meeting }: Props) {
  const router = useRouter()
  const isEdit = !!meeting

  const [titulo, setTitulo] = useState('')
  const [data, setData] = useState('')
  const [duracaoMin, setDuracaoMin] = useState('')
  const [local, setLocal] = useState('')
  const [status, setStatus] = useState('agendada')
  const [pauta, setPauta] = useState('')
  const [ata, setAta] = useState('')
  const [participantes, setParticipantes] = useState<Participante[]>([])
  const [novoNome, setNovoNome] = useState('')
  const [novoEmail, setNovoEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'info' | 'participantes' | 'ata'>('info')

  useEffect(() => {
    if (!open) return
    setError('')
    setTab('info')
    if (meeting) {
      setTitulo(meeting.titulo)
      setData(datetimeLocal(meeting.data))
      setDuracaoMin(meeting.duracao_min !== null ? String(meeting.duracao_min) : '')
      setLocal(meeting.local ?? '')
      setStatus(meeting.status)
      setPauta(meeting.pauta ?? '')
      setAta(meeting.ata ?? '')
      setParticipantes(meeting.participantes ?? [])
    } else {
      setTitulo(''); setData(''); setDuracaoMin(''); setLocal('')
      setStatus('agendada'); setPauta(''); setAta('')
      setParticipantes([])
    }
    setNovoNome(''); setNovoEmail('')
  }, [open, meeting])

  function addParticipante() {
    if (!novoNome.trim()) return
    setParticipantes(prev => [...prev, { nome: novoNome.trim(), email: novoEmail.trim() || undefined }])
    setNovoNome('')
    setNovoEmail('')
  }

  function removeParticipante(idx: number) {
    setParticipantes(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const fd = new FormData()
    fd.set('titulo', titulo)
    fd.set('data', data)
    fd.set('duracao_min', duracaoMin)
    fd.set('local', local)
    fd.set('status', status)
    fd.set('pauta', pauta)
    fd.set('ata', ata)
    fd.set('participantes', JSON.stringify(participantes))

    const result = isEdit
      ? await updateMeetingAction(meeting!.id, fd)
      : await createMeetingAction(companyId, fd)

    setLoading(false)
    if ('error' in result) { setError(result.error ?? 'Erro ao salvar.'); return }
    router.refresh()
    onClose()
  }

  const labelStyle = { color: 'var(--color-text-secondary)', fontSize: '0.75rem', fontWeight: 500, marginBottom: 4, display: 'block' }
  const tabStyle = (active: boolean) => ({
    padding: '6px 16px',
    borderRadius: 8,
    fontSize: '0.8rem',
    fontWeight: 500,
    backgroundColor: active ? 'var(--color-primary)' : 'transparent',
    color: active ? 'var(--color-primary-darker)' : 'var(--color-text-muted)',
    cursor: 'pointer',
    border: 'none',
  })

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar Reunião' : 'Nova Reunião'}>
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
          <button type="button" style={tabStyle(tab === 'info')} onClick={() => setTab('info')}>Informações</button>
          <button type="button" style={tabStyle(tab === 'participantes')} onClick={() => setTab('participantes')}>
            Participantes {participantes.length > 0 && `(${participantes.length})`}
          </button>
          <button type="button" style={tabStyle(tab === 'ata')} onClick={() => setTab('ata')}>Pauta / Ata</button>
        </div>

        {/* Tab: Informações */}
        {tab === 'info' && (
          <div className="space-y-3">
            <div>
              <label style={labelStyle}>Título *</label>
              <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Reunião de alinhamento" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={labelStyle}>Data e hora</label>
                <Input type="datetime-local" value={data} onChange={e => setData(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Duração (minutos)</label>
                <Input
                  value={duracaoMin}
                  onChange={e => setDuracaoMin(e.target.value)}
                  placeholder="Ex: 60"
                  inputMode="numeric"
                />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Local</label>
              <Input value={local} onChange={e => setLocal(e.target.value)} placeholder="Ex: Sala de reuniões, Google Meet..." />
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
              >
                <option value="agendada">Agendada</option>
                <option value="realizada">Realizada</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
          </div>
        )}

        {/* Tab: Participantes */}
        {tab === 'participantes' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  value={novoNome}
                  onChange={e => setNovoNome(e.target.value)}
                  placeholder="Nome do participante"
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addParticipante() } }}
                />
              </div>
              <div className="flex-1">
                <Input
                  value={novoEmail}
                  onChange={e => setNovoEmail(e.target.value)}
                  placeholder="E-mail (opcional)"
                  type="email"
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addParticipante() } }}
                />
              </div>
              <Button type="button" onClick={addParticipante}>+</Button>
            </div>
            {participantes.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-muted)' }}>
                Nenhum participante adicionado.
              </p>
            ) : (
              <ul className="space-y-2">
                {participantes.map((p, idx) => (
                  <li key={idx} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
                    <div>
                      <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{p.nome}</span>
                      {p.email && <span className="text-xs ml-2" style={{ color: 'var(--color-text-muted)' }}>{p.email}</span>}
                    </div>
                    <button type="button" onClick={() => removeParticipante(idx)} className="text-xs hover:text-red-500 transition-colors" style={{ color: 'var(--color-text-muted)' }}>
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Tab: Pauta / Ata */}
        {tab === 'ata' && (
          <div className="space-y-3">
            <div>
              <label style={labelStyle}>Pauta</label>
              <textarea
                value={pauta}
                onChange={e => setPauta(e.target.value)}
                rows={4}
                placeholder="Tópicos a serem discutidos..."
                className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
                style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
              />
            </div>
            <div>
              <label style={labelStyle}>Ata</label>
              <textarea
                value={ata}
                onChange={e => setAta(e.target.value)}
                rows={4}
                placeholder="Resumo do que foi discutido e decisões tomadas..."
                className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
                style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
              />
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>{error}</p>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>{isEdit ? 'Salvar alterações' : 'Criar reunião'}</Button>
        </div>
      </form>
    </Modal>
  )
}
