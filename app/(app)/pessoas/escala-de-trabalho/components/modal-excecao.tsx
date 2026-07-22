'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { upsertExceptionAction, deleteExceptionAction } from '../actions'
import type { ScheduleException } from '@/lib/escala/generate'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DIAS_SEMANA = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado']

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  date: string | null         // YYYY-MM-DD
  employeeId: string | null
  employeeName: string | null
  existingException: ScheduleException | null
}

function formatDateLabel(dateStr: string) {
  const d   = new Date(dateStr + 'T00:00:00')
  const dia = d.getDate()
  const mes = MESES[d.getMonth()]
  const dow = DIAS_SEMANA[d.getDay()]
  return `${dia} de ${mes} — ${dow}`
}

export function ModalExcecao({ open, onClose, companyId, date, employeeId, employeeName, existingException }: Props) {
  const router = useRouter()

  const [tipo,       setTipo]       = useState<'folga' | 'trabalho'>('folga')
  const [observacao, setObservacao] = useState('')
  const [loading,    setLoading]    = useState(false)
  const [removing,   setRemoving]   = useState(false)
  const [error,      setError]      = useState('')

  useEffect(() => {
    if (!open) return
    if (existingException) {
      setTipo(existingException.tipo)
      setObservacao(existingException.observacao ?? '')
    } else {
      setTipo('folga')
      setObservacao('')
    }
    setError('')
  }, [open, existingException])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!date || !employeeId) return
    setError('')
    setLoading(true)
    const result = await upsertExceptionAction(companyId, employeeId, date, tipo, observacao || null)
    setLoading(false)
    if ('error' in result) { setError(result.error ?? 'Erro desconhecido'); return }
    router.refresh()
    onClose()
  }

  async function handleRemove() {
    if (!existingException) return
    setRemoving(true)
    const result = await deleteExceptionAction(existingException.id, companyId)
    setRemoving(false)
    if ('error' in result) { setError(result.error ?? 'Erro desconhecido'); return }
    router.refresh()
    onClose()
  }

  if (!date || !employeeId) return null

  const labelStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--color-text-secondary)',
    marginBottom: '0.25rem',
    display: 'block',
  }

  return (
    <Modal open={open} onClose={onClose} title="Exceção de Escala">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        <div style={{ padding: '0.75rem 1rem', borderRadius: '0.75rem', backgroundColor: 'var(--color-bg-surface)' }}>
          <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '0.2rem' }}>
            {employeeName}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            {formatDateLabel(date)}
          </p>
        </div>

        <div>
          <label style={labelStyle}>Tipo de exceção</label>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {([
              { value: 'folga',    label: 'Marcar como folga',           color: '#C0392B', bg: '#FDEDEC' },
              { value: 'trabalho', label: 'Marcar como dia de trabalho', color: '#1E8449', bg: '#E9F7EF' },
            ] as const).map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTipo(opt.value)}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  borderRadius: '0.5rem',
                  border: '1px solid',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  borderColor: tipo === opt.value ? opt.color : 'var(--color-bg-surface)',
                  backgroundColor: tipo === opt.value ? opt.bg : 'white',
                  color: tipo === opt.value ? opt.color : 'var(--color-text-secondary)',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label style={labelStyle}>Observação (opcional)</label>
          <textarea
            value={observacao}
            onChange={e => setObservacao(e.target.value)}
            placeholder="Ex: Falta justificada, feriado municipal, troca de folga..."
            rows={2}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--color-bg-surface)',
              fontSize: '0.8rem',
              resize: 'vertical',
              backgroundColor: 'white',
              color: 'var(--color-text-primary)',
            }}
          />
        </div>

        {error && (
          <p style={{ fontSize: '0.8rem', color: 'var(--color-error)' }}>{error}</p>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between' }}>
          <div>
            {existingException && (
              <Button type="button" variant="danger" loading={removing} onClick={handleRemove}>
                Remover exceção
              </Button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={loading}>Salvar</Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
