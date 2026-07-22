'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createTimeRecordAction, updateTimeRecordAction } from '../actions'
import { generateMonth } from '@/lib/escala/generate'
import type { TimeRecord } from '../queries'
import type { ScheduleRule, ScheduleException } from '@/lib/escala/generate'

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  record: TimeRecord | null
  employees: { id: string; nome: string; cargo: string | null }[]
  rules: ScheduleRule[]
  exceptions: ScheduleException[]
  defaultMes: number
  defaultAno: number
  defaultEmployeeId?: string | null
  defaultDate?: string | null
  defaultEntrada?: string | null
  defaultSaida?: string | null
  defaultTipo?: string
}

function extractTime(ts: string | null): string {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function todayStr(mes: number, ano: number) {
  const m = String(mes).padStart(2, '0')
  const d = String(new Date().getDate()).padStart(2, '0')
  return `${ano}-${m}-${d}`
}

export function ModalPonto({
  open, onClose, companyId, record, employees, rules, exceptions,
  defaultMes, defaultAno,
  defaultEmployeeId, defaultDate, defaultEntrada, defaultSaida, defaultTipo,
}: Props) {
  const router  = useRouter()
  const isEdit  = !!record

  const [employeeId, setEmployeeId] = useState('')
  const [data,       setData]       = useState('')
  const [entrada,    setEntrada]    = useState('')
  const [saida,      setSaida]      = useState('')
  const [tipo,       setTipo]       = useState('normal')
  const [observacao, setObservacao] = useState('')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    if (record) {
      setEmployeeId(record.employee_id)
      setData(record.data)
      setEntrada(extractTime(record.entrada))
      setSaida(extractTime(record.saida))
      setTipo(record.tipo)
      setObservacao(record.observacao ?? '')
    } else {
      setEmployeeId(defaultEmployeeId ?? '')
      setData(defaultDate ?? todayStr(defaultMes, defaultAno))
      setEntrada(defaultEntrada ?? '')
      setSaida(defaultSaida ?? '')
      setTipo(defaultTipo ?? 'normal')
      setObservacao('')
    }
  }, [open, record, defaultMes, defaultAno, defaultEmployeeId, defaultDate, defaultEntrada, defaultSaida, defaultTipo])

  // Escala prevista para a data/funcionário selecionados (apenas para exibição)
  const scheduleDay = useMemo(() => {
    if (!employeeId || !data || !rules.length) return null
    const [y, m] = data.split('-').map(Number)
    const days = generateMonth(rules, exceptions, m, y, employeeId)
    return days.find(d => d.date === data) ?? null
  }, [employeeId, data, rules, exceptions])

  const semHorario = tipo === 'folga' || tipo === 'ferias' || tipo === 'falta'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')

    const fd = new FormData()
    fd.set('employee_id', employeeId)
    fd.set('data', data)
    fd.set('entrada',    semHorario ? '' : entrada)
    fd.set('saida',      semHorario ? '' : saida)
    fd.set('tipo', tipo)
    fd.set('observacao', observacao)

    const result = isEdit
      ? await updateTimeRecordAction(record!.id, fd)
      : await createTimeRecordAction(companyId, fd)

    setLoading(false)
    if ('error' in result) { setError(result.error ?? 'Erro ao salvar.'); return }
    router.refresh()
    onClose()
  }

  const labelStyle: React.CSSProperties = {
    color: 'var(--color-text-secondary)',
    fontSize: '0.75rem',
    fontWeight: 600,
    marginBottom: 4,
    display: 'block',
  }

  const scheduleLabel = scheduleDay && scheduleDay.tipo !== 'sem_regra'
    ? scheduleDay.tipo === 'folga'
      ? 'Escala: dia de folga'
      : `Escala: ${scheduleDay.hora_entrada?.slice(0, 5) ?? '?'} – ${scheduleDay.hora_saida?.slice(0, 5) ?? '?'}${scheduleDay.feriado ? ` · ${scheduleDay.feriado_nome}` : ''}`
    : null

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar Registro' : 'Novo Registro de Ponto'}>
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label style={labelStyle}>Data *</label>
            <Input type="date" value={data} onChange={e => setData(e.target.value)} required />
          </div>
          <div>
            <label style={labelStyle}>Tipo</label>
            <select
              value={tipo}
              onChange={e => setTipo(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
            >
              <option value="normal">Normal</option>
              <option value="extra">Extra</option>
              <option value="folga">Folga</option>
              <option value="ferias">Férias</option>
              <option value="falta">Falta</option>
            </select>
          </div>
        </div>

        {/* Escala prevista */}
        {scheduleLabel && (
          <div style={{
            padding: '0.5rem 0.75rem',
            borderRadius: '0.5rem',
            backgroundColor: scheduleDay?.tipo === 'folga' ? '#F2F3F4' : '#EAF4F4',
            color: scheduleDay?.tipo === 'folga' ? '#7F8C8D' : '#17A589',
            fontSize: '0.75rem',
            fontWeight: 500,
          }}>
            {scheduleLabel}
          </div>
        )}

        {!semHorario && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Entrada</label>
              <Input type="time" value={entrada} onChange={e => setEntrada(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Saída</label>
              <Input type="time" value={saida} onChange={e => setSaida(e.target.value)} />
            </div>
          </div>
        )}

        <div>
          <label style={labelStyle}>Observação</label>
          <textarea
            value={observacao}
            onChange={e => setObservacao(e.target.value)}
            rows={2}
            placeholder="Observações opcionais..."
            className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
            style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
          />
        </div>

        {error && (
          <p className="text-sm p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>{error}</p>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>{isEdit ? 'Salvar alterações' : 'Registrar'}</Button>
        </div>
      </form>
    </Modal>
  )
}
