'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createScheduleAction, updateScheduleAction } from '../actions'
import type { WorkSchedule } from '../queries'

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  schedule: WorkSchedule | null
  employees: { id: string; nome: string; cargo: string | null }[]
  defaultDate: string
}

const TURNOS_PRESET = [
  { value: 'manha', label: 'Manhã', inicio: '08:00', fim: '12:00' },
  { value: 'tarde', label: 'Tarde', inicio: '13:00', fim: '17:00' },
  { value: 'noite', label: 'Noite', inicio: '18:00', fim: '22:00' },
  { value: 'custom', label: 'Personalizado', inicio: '', fim: '' },
]

export function ModalEscala({ open, onClose, companyId, schedule, employees, defaultDate }: Props) {
  const router = useRouter()
  const isEdit = !!schedule

  const [employeeId, setEmployeeId] = useState('')
  const [data, setData] = useState('')
  const [turno, setTurno] = useState('manha')
  const [horaInicio, setHoraInicio] = useState('08:00')
  const [horaFim, setHoraFim] = useState('12:00')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    if (schedule) {
      setEmployeeId(schedule.employee_id)
      setData(schedule.data)
      setTurno(schedule.turno ?? 'custom')
      setHoraInicio(schedule.hora_inicio?.slice(0, 5) ?? '')
      setHoraFim(schedule.hora_fim?.slice(0, 5) ?? '')
    } else {
      setEmployeeId('')
      setData(defaultDate)
      applyPreset('manha')
    }
  }, [open, schedule, defaultDate])

  function applyPreset(value: string) {
    setTurno(value)
    const preset = TURNOS_PRESET.find(t => t.value === value)
    if (preset) {
      setHoraInicio(preset.inicio)
      setHoraFim(preset.fim)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const fd = new FormData()
    fd.set('employee_id', employeeId)
    fd.set('data', data)
    fd.set('turno', turno)
    fd.set('hora_inicio', horaInicio)
    fd.set('hora_fim', horaFim)

    const result = isEdit
      ? await updateScheduleAction(schedule!.id, fd)
      : await createScheduleAction(companyId, fd)

    setLoading(false)
    if ('error' in result) { setError(result.error ?? 'Erro ao salvar.'); return }
    router.refresh()
    onClose()
  }

  const labelStyle = {
    color: 'var(--color-text-secondary)',
    fontSize: '0.75rem',
    fontWeight: 500,
    marginBottom: 4,
    display: 'block',
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar Turno' : 'Novo Turno'}>
      <form onSubmit={handleSubmit} className="space-y-4">

        <div>
          <label style={labelStyle}>Funcionário *</label>
          <select
            value={employeeId}
            onChange={e => setEmployeeId(e.target.value)}
            required
            disabled={isEdit}
            className="w-full px-3 py-2 rounded-lg border text-sm"
            style={{
              borderColor: 'var(--color-bg-surface)',
              color: 'var(--color-text-primary)',
              backgroundColor: isEdit ? '#F9F9F9' : 'white',
            }}
          >
            <option value="">Selecionar funcionário...</option>
            {employees.map(e => (
              <option key={e.id} value={e.id}>{e.nome}{e.cargo ? ` — ${e.cargo}` : ''}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={labelStyle}>Data *</label>
          <Input type="date" value={data} onChange={e => setData(e.target.value)} required />
        </div>

        <div>
          <label style={labelStyle}>Turno</label>
          <div className="grid grid-cols-4 gap-2">
            {TURNOS_PRESET.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => applyPreset(t.value)}
                className="py-2 rounded-lg text-xs font-medium border transition-colors"
                style={{
                  backgroundColor: turno === t.value ? 'var(--color-primary)' : 'white',
                  borderColor: turno === t.value ? 'var(--color-primary-dark)' : 'var(--color-bg-surface)',
                  color: turno === t.value ? 'var(--color-primary-darker)' : 'var(--color-text-secondary)',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label style={labelStyle}>Hora início</label>
            <Input type="time" value={horaInicio} onChange={e => setHoraInicio(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Hora fim</label>
            <Input type="time" value={horaFim} onChange={e => setHoraFim(e.target.value)} />
          </div>
        </div>

        {error && (
          <p className="text-sm p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>{error}</p>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>{isEdit ? 'Salvar alterações' : 'Adicionar turno'}</Button>
        </div>
      </form>
    </Modal>
  )
}
