'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ModalPonto } from './modal-ponto'
import { deleteTimeRecordAction } from '../actions'
import { generateMonth } from '@/lib/escala/generate'
import type { TimeRecord } from '../queries'
import type { ScheduleRule, ScheduleException, DayResult } from '@/lib/escala/generate'

interface Props {
  records: TimeRecord[]
  employees: { id: string; nome: string; cargo: string | null }[]
  rules: ScheduleRule[]
  exceptions: ScheduleException[]
  companyId: string
  mes: number
  ano: number
}

const MESES       = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

const TIPO_LABELS: Record<string, string> = {
  normal: 'Normal', extra: 'Extra', folga: 'Folga', ferias: 'Férias', falta: 'Falta',
}
const TIPO_COLORS: Record<string, { bg: string; text: string }> = {
  normal:  { bg: '#EAF4F4', text: '#17A589' },
  extra:   { bg: '#EBF5FB', text: '#2471A3' },
  folga:   { bg: '#F4ECF7', text: '#8E44AD' },
  ferias:  { bg: '#E9F7EF', text: '#1E8449' },
  falta:   { bg: '#FDEDEC', text: '#C0392B' },
}

type SituacaoInfo = {
  label: string
  color: string
  bg: string
  isLate: boolean
  isEarlyOut: boolean
  isAbsent: boolean
}

function getSituacao(record: TimeRecord | null, dayResult: DayResult | null, toleranciaMin: number): SituacaoInfo {
  if (record?.tipo === 'ferias') return { label: 'Férias',  color: '#1E8449', bg: '#E9F7EF', isLate: false, isEarlyOut: false, isAbsent: false }
  if (record?.tipo === 'falta')  return { label: 'Falta',   color: '#C0392B', bg: '#FDEDEC', isLate: false, isEarlyOut: false, isAbsent: true  }

  const noSchedule = !dayResult || dayResult.tipo === 'sem_regra'
  if (noSchedule) return { label: 'Sem escala', color: '#95A5A6', bg: '#F8F9FA', isLate: false, isEarlyOut: false, isAbsent: false }

  if (dayResult!.tipo === 'folga') {
    if (!record || record.tipo === 'folga') return { label: 'Folga', color: '#7F8C8D', bg: '#F2F3F4', isLate: false, isEarlyOut: false, isAbsent: false }
    return { label: 'Extra na folga', color: '#2471A3', bg: '#EBF5FB', isLate: false, isEarlyOut: false, isAbsent: false }
  }

  // Dia esperado de trabalho
  if (!record) return { label: 'Ausente', color: '#C0392B', bg: '#FDEDEC', isLate: false, isEarlyOut: false, isAbsent: true }
  if (record.tipo === 'folga') return { label: 'Folga não prevista', color: '#8E44AD', bg: '#F4ECF7', isLate: false, isEarlyOut: false, isAbsent: false }

  let isLate = false
  let lateMin = 0
  let isEarlyOut = false

  if (record.entrada && dayResult!.hora_entrada) {
    const [eh, em] = dayResult!.hora_entrada.split(':').map(Number)
    const expectedMin = eh * 60 + em
    const actual = new Date(record.entrada)
    const actualMin = actual.getHours() * 60 + actual.getMinutes()
    lateMin = actualMin - expectedMin
    if (lateMin > toleranciaMin) isLate = true
  }

  if (record.saida && dayResult!.hora_saida) {
    const [sh, sm] = dayResult!.hora_saida.split(':').map(Number)
    const actual = new Date(record.saida)
    const actualMin = actual.getHours() * 60 + actual.getMinutes()
    if (actualMin < sh * 60 + sm) isEarlyOut = true
  }

  if (isLate)    return { label: `Atraso ${lateMin}min`, color: '#D35400', bg: '#FDEBD0', isLate: true,  isEarlyOut, isAbsent: false }
  if (isEarlyOut) return { label: 'Saída antecipada',    color: '#D35400', bg: '#FDEBD0', isLate: false, isEarlyOut: true,  isAbsent: false }

  return { label: 'No prazo', color: '#17A589', bg: '#EAF4F4', isLate: false, isEarlyOut: false, isAbsent: false }
}

function formatTime(ts: string | null) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

function formatInterval(interval: string | null) {
  if (!interval) return '—'
  const match = interval.match(/(\d+):(\d+)/)
  if (!match) return interval
  return `${match[1]}h ${match[2]}min`
}

function getDaysInMonth(ano: number, mes: number) { return new Date(ano, mes, 0).getDate() }
function getFirstDayOfWeek(ano: number, mes: number) { return new Date(ano, mes - 1, 1).getDay() }

export function PontoClient({ records, employees, rules, exceptions, companyId, mes, ano }: Props) {
  const router = useRouter()

  const [view,           setView]         = useState<'lista' | 'calendario'>('lista')
  const [tolerancia,     setTolerancia]   = useState(10)
  const [filterEmployee, setFilter]       = useState('')
  const [modalOpen,      setModalOpen]    = useState(false)
  const [editingRecord,  setEditingRecord] = useState<TimeRecord | null>(null)
  const [modalEmpId,     setModalEmpId]   = useState<string | null>(null)
  const [modalDate,      setModalDate]    = useState<string | null>(null)
  const [modalEntrada,   setModalEntrada] = useState<string | null>(null)
  const [modalSaida,     setModalSaida]   = useState<string | null>(null)
  const [modalTipo,      setModalTipo]    = useState<string>('normal')
  const [deletingId,     setDeletingId]   = useState<string | null>(null)
  const [deleteError,    setDeleteError]  = useState('')

  const filteredEmps = filterEmployee ? employees.filter(e => e.id === filterEmployee) : employees

  // Mapas de consulta rápida
  const scheduleMap = new Map<string, DayResult>()
  for (const emp of employees) {
    const days = generateMonth(rules, exceptions, mes, ano, emp.id)
    for (const d of days) scheduleMap.set(`${emp.id}|${d.date}`, d)
  }

  const recordsMap = new Map<string, TimeRecord>()
  for (const r of records) recordsMap.set(`${r.employee_id}|${r.data}`, r)

  // Métricas de conformidade
  const totalDias = getDaysInMonth(ano, mes)
  let expectedDays = 0, presentDays = 0, absentDays = 0, lateDays = 0, earlyOutDays = 0

  for (const emp of filteredEmps) {
    for (let d = 1; d <= totalDias; d++) {
      const dateStr  = `${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const dayResult = scheduleMap.get(`${emp.id}|${dateStr}`) ?? null
      if (dayResult?.tipo !== 'trabalho') continue
      expectedDays++
      const record = recordsMap.get(`${emp.id}|${dateStr}`) ?? null
      const sit = getSituacao(record, dayResult, tolerancia)
      if (sit.isAbsent)   absentDays++
      else {
        presentDays++
        if (sit.isLate)     lateDays++
        if (sit.isEarlyOut) earlyOutDays++
      }
    }
  }
  const presencaRate = expectedDays > 0 ? Math.round(presentDays / expectedDays * 100) : 100

  // Navegação de mês
  function navMes(delta: number) {
    let m = mes + delta, a = ano
    if (m < 1)  { m = 12; a-- }
    if (m > 12) { m = 1;  a++ }
    router.push(`/pessoas/registro-de-ponto?mes=${m}&ano=${a}`)
  }

  function openAdd() {
    setEditingRecord(null)
    setModalEmpId(filterEmployee || null)
    setModalDate(null); setModalEntrada(null); setModalSaida(null); setModalTipo('normal')
    setModalOpen(true)
  }

  function openEdit(r: TimeRecord) {
    setEditingRecord(r)
    setModalEmpId(null); setModalDate(null); setModalEntrada(null); setModalSaida(null); setModalTipo('normal')
    setModalOpen(true)
  }

  function openFromCalendar(dateStr: string, empId: string) {
    const existing = recordsMap.get(`${empId}|${dateStr}`) ?? null
    const dayResult = scheduleMap.get(`${empId}|${dateStr}`) ?? null
    if (existing) {
      setEditingRecord(existing)
      setModalEmpId(null); setModalDate(null); setModalEntrada(null); setModalSaida(null); setModalTipo('normal')
    } else {
      setEditingRecord(null)
      setModalEmpId(empId)
      setModalDate(dateStr)
      setModalEntrada(dayResult?.hora_entrada ?? null)
      setModalSaida(dayResult?.hora_saida ?? null)
      setModalTipo(dayResult?.tipo === 'folga' ? 'folga' : 'normal')
    }
    setModalOpen(true)
  }

  async function handleDelete(r: TimeRecord) {
    if (!confirm('Excluir este registro de ponto?')) return
    setDeletingId(r.id); setDeleteError('')
    const result = await deleteTimeRecordAction(r.id)
    setDeletingId(null)
    if ('error' in result) setDeleteError(result.error ?? 'Erro ao excluir.')
    else router.refresh()
  }

  // Grade do calendário
  const firstDay = getFirstDayOfWeek(ano, mes)
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: totalDias }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const filteredRecords = filterEmployee ? records.filter(r => r.employee_id === filterEmployee) : records

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
            Registro de Ponto
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Controle de entrada e saída dos colaboradores
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: 'var(--color-bg-surface)' }}>
            {(['lista', 'calendario'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className="px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  backgroundColor: view === v ? 'var(--color-primary)' : 'white',
                  color: view === v ? 'var(--color-primary-darker)' : 'var(--color-text-secondary)',
                }}>
                {v === 'lista' ? '☰ Lista' : '📅 Calendário'}
              </button>
            ))}
          </div>

          {/* Tolerância */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs"
            style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-secondary)', backgroundColor: 'white' }}>
            <span>Tolerância:</span>
            <input
              type="number" min="0" max="60"
              value={tolerancia}
              onChange={e => setTolerancia(parseInt(e.target.value) || 0)}
              className="w-10 text-center border-0 outline-none text-xs font-semibold bg-transparent"
              style={{ color: 'var(--color-text-primary)' }}
            />
            <span>min</span>
          </div>

          <Button onClick={openAdd}>Adicionar</Button>
        </div>
      </div>

      {/* Navegação de mês */}
      <div className="flex items-center justify-between mb-4 p-3 rounded-xl border"
        style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
        <button onClick={() => navMes(-1)} className="px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50 transition-colors"
          style={{ color: 'var(--color-text-secondary)' }}>← Anterior</button>
        <span className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>
          {MESES[mes - 1]} {ano}
        </span>
        <button onClick={() => navMes(1)} className="px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50 transition-colors"
          style={{ color: 'var(--color-text-secondary)' }}>Próximo →</button>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-5 gap-3 mb-4">
        {[
          { label: 'Dias esperados', value: String(expectedDays),    color: 'var(--color-primary-darker)' },
          { label: 'Presentes',      value: String(presentDays),     color: '#1E8449' },
          { label: 'Ausências',      value: String(absentDays),      color: '#C0392B' },
          { label: 'Atrasos',        value: String(lateDays),        color: '#D35400' },
          {
            label: '% Presença',
            value: `${presencaRate}%`,
            color: presencaRate >= 90 ? '#1E8449' : presencaRate >= 75 ? '#D35400' : '#C0392B',
          },
        ].map(m => (
          <div key={m.label} className="p-3 rounded-xl border text-center"
            style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
            <div className="text-xl font-bold" style={{ color: m.color }}>{m.value}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* Filtro */}
      <div className="mb-4">
        <select value={filterEmployee} onChange={e => setFilter(e.target.value)}
          className="w-full px-4 py-2 rounded-lg border text-sm"
          style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white', color: 'var(--color-text-primary)' }}>
          <option value="">Todos os funcionários</option>
          {employees.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
      </div>

      {deleteError && (
        <p className="text-sm mb-4 p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>{deleteError}</p>
      )}

      {/* ── Calendário ── */}
      {view === 'calendario' && (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
          <div className="grid grid-cols-7 border-b"
            style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'var(--color-bg-surface)' }}>
            {DIAS_SEMANA.map(d => (
              <div key={d} className="text-center py-2 text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {cells.map((day, idx) => {
              const dateStr = day
                ? `${ano}-${String(mes).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                : ''
              const isToday    = dateStr === new Date().toISOString().slice(0, 10)
              const refDay     = filteredEmps[0] ? scheduleMap.get(`${filteredEmps[0].id}|${dateStr}`) : null
              const isFeriado  = refDay?.feriado ?? false
              const isDomingo  = refDay?.domingo ?? false

              let cellBg = day ? 'white' : '#FAFAFA'
              if (day && isDomingo) cellBg = '#F5F5F5'
              if (day && isFeriado) cellBg = '#EBF5FB'

              return (
                <div key={idx} className="min-h-[90px] border-r border-b p-1"
                  style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: cellBg }}>
                  {day && (
                    <>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full"
                          style={{
                            backgroundColor: isToday ? 'var(--color-primary-dark)' : 'transparent',
                            color: isToday ? 'white' : isDomingo ? '#999' : 'var(--color-text-secondary)',
                          }}>
                          {day}
                        </span>
                        {isFeriado && refDay?.feriado_nome && (
                          <span title={refDay.feriado_nome}
                            style={{ fontSize: '0.58rem', color: '#2471A3', maxWidth: 56, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {refDay.feriado_nome}
                          </span>
                        )}
                      </div>

                      {filteredEmps.map(emp => {
                        const dayResult = scheduleMap.get(`${emp.id}|${dateStr}`) ?? null
                        const record    = recordsMap.get(`${emp.id}|${dateStr}`) ?? null
                        if (!dayResult && !record) return null
                        if (dayResult?.tipo === 'sem_regra' && !record) return null
                        const sit = getSituacao(record, dayResult, tolerancia)
                        const label = filterEmployee
                          ? (record ? `${formatTime(record.entrada)}–${formatTime(record.saida)}` : sit.label)
                          : emp.nome.split(' ')[0]
                        return (
                          <button key={emp.id}
                            onClick={() => openFromCalendar(dateStr, emp.id)}
                            className="w-full text-left mb-0.5 px-1.5 py-0.5 rounded text-xs truncate"
                            style={{ backgroundColor: sit.bg, color: sit.color }}
                            title={`${emp.nome} — ${sit.label}${record ? ` (${formatTime(record.entrada)}–${formatTime(record.saida)})` : ''}`}>
                            {label}
                          </button>
                        )
                      })}
                    </>
                  )}
                </div>
              )
            })}
          </div>

          {/* Legenda */}
          <div className="flex flex-wrap items-center gap-4 px-4 py-2 border-t text-xs"
            style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-muted)' }}>
            {[
              { bg: '#EAF4F4', label: 'No prazo'                   },
              { bg: '#FDEBD0', label: 'Atraso / Saída antecipada'  },
              { bg: '#FDEDEC', label: 'Ausente / Falta'            },
              { bg: '#F4ECF7', label: 'Folga não prevista'         },
              { bg: '#F2F3F4', label: 'Folga'                      },
              { bg: '#EBF5FB', label: 'Feriado'                    },
            ].map(l => (
              <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: l.bg, border: '1px solid #ddd', display: 'inline-block' }} />
                {l.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Lista ── */}
      {view === 'lista' && (
        <div className="rounded-xl border overflow-x-auto" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
          <table className="w-full min-w-[860px] text-sm">
            <thead style={{ backgroundColor: 'var(--color-bg-surface)' }}>
              <tr>
                {['Funcionário','Data','Entrada','Saída','Horas','Tipo','Situação',''].map((h, i) => (
                  <th key={i} className={`${i < 7 ? 'text-left' : ''} px-4 py-3 font-medium`}
                    style={{ color: 'var(--color-text-secondary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 && (
                <tr><td colSpan={8} className="text-center py-10" style={{ color: 'var(--color-text-muted)' }}>
                  Nenhum registro para {MESES[mes - 1]} {ano}.
                </td></tr>
              )}
              {filteredRecords.map((r, idx) => {
                const dayResult = scheduleMap.get(`${r.employee_id}|${r.data}`) ?? null
                const sit = getSituacao(r, dayResult, tolerancia)
                const colors = TIPO_COLORS[r.tipo] ?? TIPO_COLORS.normal
                return (
                  <tr key={r.id} className="border-t"
                    style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: idx % 2 === 0 ? 'white' : '#FAFAFA' }}>
                    <td className="px-4 py-3 font-medium text-xs" style={{ color: 'var(--color-text-primary)' }}>
                      <div>{r.employee.nome}</div>
                      {r.employee.cargo && <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{r.employee.cargo}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{formatDate(r.data)}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{formatTime(r.entrada)}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{formatTime(r.saida)}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{formatInterval(r.horas_trabalhadas)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ backgroundColor: colors.bg, color: colors.text }}>
                        {TIPO_LABELS[r.tipo] ?? r.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ backgroundColor: sit.bg, color: sit.color }}>
                        {sit.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>Editar</Button>
                        <Button variant="danger" size="sm" loading={deletingId === r.id} onClick={() => handleDelete(r)}>Excluir</Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <ModalPonto
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        companyId={companyId}
        record={editingRecord}
        employees={employees}
        rules={rules}
        exceptions={exceptions}
        defaultMes={mes}
        defaultAno={ano}
        defaultEmployeeId={modalEmpId}
        defaultDate={modalDate}
        defaultEntrada={modalEntrada}
        defaultSaida={modalSaida}
        defaultTipo={modalTipo}
      />
    </>
  )
}
