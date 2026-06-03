'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createMonthlyScheduleAction } from '../actions'

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  mes: number
  ano: number
  employees: { id: string; nome: string; cargo: string | null }[]
}

const DIAS = [
  { idx: 0, label: 'Dom' },
  { idx: 1, label: 'Seg' },
  { idx: 2, label: 'Ter' },
  { idx: 3, label: 'Qua' },
  { idx: 4, label: 'Qui' },
  { idx: 5, label: 'Sex' },
  { idx: 6, label: 'Sáb' },
]

const TURNOS_PRESET = [
  { value: 'manha',  label: 'Manhã',        inicio: '08:00', fim: '12:00' },
  { value: 'tarde',  label: 'Tarde',         inicio: '13:00', fim: '17:00' },
  { value: 'noite',  label: 'Noite',         inicio: '18:00', fim: '22:00' },
  { value: 'custom', label: 'Personalizado', inicio: '',      fim: ''      },
]

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

export function ModalEscalaMes({ open, onClose, companyId, mes, ano, employees }: Props) {
  const router = useRouter()

  const [employeeId, setEmployeeId] = useState('')
  // dias da semana selecionados: 0=Dom … 6=Sáb; padrão: Seg a Sex
  const [diasSemana, setDiasSemana] = useState<number[]>([1, 2, 3, 4, 5])
  const [turno, setTurno] = useState('manha')
  const [horaInicio, setHoraInicio] = useState('08:00')
  const [horaFim, setHoraFim] = useState('12:00')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    setEmployeeId('')
    setDiasSemana([1, 2, 3, 4, 5])
    applyPreset('manha')
  }, [open])

  function applyPreset(value: string) {
    setTurno(value)
    const preset = TURNOS_PRESET.find(t => t.value === value)
    if (preset) { setHoraInicio(preset.inicio); setHoraFim(preset.fim) }
  }

  function toggleDia(idx: number) {
    setDiasSemana(prev =>
      prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx]
    )
  }

  // Preview: quantas datas serão geradas
  const preview = useMemo(() => {
    if (diasSemana.length === 0) return []
    const totalDias = new Date(ano, mes, 0).getDate()
    const datas: string[] = []
    for (let d = 1; d <= totalDias; d++) {
      const date = new Date(ano, mes - 1, d)
      if (diasSemana.includes(date.getDay())) {
        datas.push(`${String(d).padStart(2, '0')}/${String(mes).padStart(2, '0')}`)
      }
    }
    return datas
  }, [diasSemana, mes, ano])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const fd = new FormData()
    fd.set('employee_id', employeeId)
    fd.set('mes_ano', `${ano}-${String(mes).padStart(2, '0')}`)
    fd.set('dias_semana', JSON.stringify(diasSemana))
    fd.set('turno', turno)
    fd.set('hora_inicio', horaInicio)
    fd.set('hora_fim', horaFim)

    const result = await createMonthlyScheduleAction(companyId, fd)
    setLoading(false)
    if ('error' in result) { setError(result.error ?? 'Erro ao gerar escala.'); return }
    router.refresh()
    onClose()
  }

  const labelStyle = { color: 'var(--color-text-secondary)', fontSize: '0.75rem', fontWeight: 500, marginBottom: 4, display: 'block' }

  return (
    <Modal open={open} onClose={onClose} title={`Escala do Mês — ${MESES[mes - 1]} ${ano}`}>
      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Funcionário */}
        <div>
          <label style={labelStyle}>Funcionário *</label>
          <select
            value={employeeId}
            onChange={e => setEmployeeId(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-lg border text-sm"
            style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
          >
            <option value="">Selecionar funcionário...</option>
            {employees.map(e => (
              <option key={e.id} value={e.id}>{e.nome}{e.cargo ? ` — ${e.cargo}` : ''}</option>
            ))}
          </select>
        </div>

        {/* Dias da semana */}
        <div>
          <label style={labelStyle}>Dias da semana que trabalha *</label>
          <div className="grid grid-cols-7 gap-1">
            {DIAS.map(({ idx, label }) => {
              const active = diasSemana.includes(idx)
              const isWeekend = idx === 0 || idx === 6
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggleDia(idx)}
                  className="py-2 rounded-lg text-xs font-semibold border transition-all"
                  style={{
                    backgroundColor: active ? 'var(--color-primary)' : 'white',
                    borderColor: active ? 'var(--color-primary-dark)' : 'var(--color-bg-surface)',
                    color: active ? 'var(--color-primary-darker)' : isWeekend ? '#C0392B' : 'var(--color-text-secondary)',
                    opacity: active ? 1 : 0.7,
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
          {/* Atalhos */}
          <div className="flex gap-2 mt-2">
            <button type="button" onClick={() => setDiasSemana([1,2,3,4,5])}
              className="text-xs px-2 py-1 rounded border transition-colors hover:bg-gray-50"
              style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-muted)' }}>
              Seg–Sex
            </button>
            <button type="button" onClick={() => setDiasSemana([1,2,3,4,5,6])}
              className="text-xs px-2 py-1 rounded border transition-colors hover:bg-gray-50"
              style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-muted)' }}>
              Seg–Sáb
            </button>
            <button type="button" onClick={() => setDiasSemana([0,1,2,3,4,5,6])}
              className="text-xs px-2 py-1 rounded border transition-colors hover:bg-gray-50"
              style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-muted)' }}>
              Todos
            </button>
            <button type="button" onClick={() => setDiasSemana([])}
              className="text-xs px-2 py-1 rounded border transition-colors hover:bg-gray-50"
              style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-muted)' }}>
              Limpar
            </button>
          </div>
        </div>

        {/* Turno */}
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

        {/* Horário */}
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

        {/* Preview */}
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
          {preview.length === 0 ? (
            <p className="text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
              Selecione ao menos um dia da semana.
            </p>
          ) : (
            <>
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                SERÃO GERADOS <span style={{ color: 'var(--color-primary-darker)' }}>{preview.length} TURNOS</span> EM {MESES[mes - 1].toUpperCase()} {ano}
              </p>
              <div className="flex flex-wrap gap-1">
                {preview.map(d => (
                  <span key={d} className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-darker)' }}>
                    {d}
                  </span>
                ))}
              </div>
              <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
                Se já houver escala em algum desses dias, ela será substituída.
              </p>
            </>
          )}
        </div>

        {error && (
          <p className="text-sm p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>{error}</p>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading} disabled={preview.length === 0}>
            Gerar {preview.length > 0 ? `${preview.length} turnos` : 'escala'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
