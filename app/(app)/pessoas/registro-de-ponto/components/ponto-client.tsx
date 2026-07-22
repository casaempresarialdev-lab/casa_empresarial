'use client'

import { useState, useMemo } from 'react'
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

// ─── Types ────────────────────────────────────────────────────────────────────

type Status =
  | 'ok'
  | 'atraso'
  | 'saida_antecipada'
  | 'incompleto'
  | 'em_andamento'
  | 'aguardando'
  | 'ausente'
  | 'folga'
  | 'folga_extra'
  | 'ferias'
  | 'falta'
  | 'previsto'
  | 'sem_escala'

type SituacaoInfo = { label: string; color: string; bg: string; status: Status }

type DayEntry = {
  empId: string
  empNome: string
  empCargo: string | null
  date: string
  dayResult: DayResult | null
  record: TimeRecord | null
  sit: SituacaoInfo
  isToday: boolean
  isFuture: boolean
}

// ─── Status ───────────────────────────────────────────────────────────────────

function getSituacao(
  record: TimeRecord | null,
  dayResult: DayResult | null,
  toleranciaMin: number,
  isToday: boolean,
  isFuture: boolean,
): SituacaoInfo {
  if (record?.tipo === 'ferias') return { label: 'Férias',  color: '#1E8449', bg: '#E9F7EF', status: 'ferias' }
  if (record?.tipo === 'falta')  return { label: 'Falta',   color: '#C0392B', bg: '#FDEDEC', status: 'falta'  }

  const noSchedule = !dayResult || dayResult.tipo === 'sem_regra'
  if (noSchedule) {
    if (!record) return { label: 'Sem escala', color: '#BDC3C7', bg: '#F8F9FA', status: 'sem_escala' }
    return { label: 'Normal', color: '#17A589', bg: '#EAF4F4', status: 'ok' }
  }

  if (dayResult.tipo === 'folga') {
    if (!record || record.tipo === 'folga')
      return { label: 'Folga', color: '#7F8C8D', bg: '#F2F3F4', status: 'folga' }
    return { label: 'Extra na folga', color: '#2471A3', bg: '#EBF5FB', status: 'folga_extra' }
  }

  // Dia de trabalho
  if (!record || !record.entrada) {
    if (isFuture) return { label: 'Previsto',   color: '#2471A3', bg: '#EBF5FB', status: 'previsto'   }
    if (isToday)  return { label: 'Aguardando', color: '#7F8C8D', bg: '#F2F3F4', status: 'aguardando' }
    return { label: 'Ausente', color: '#C0392B', bg: '#FDEDEC', status: 'ausente' }
  }

  // Tem entrada mas não tem saída
  if (!record.saida) {
    if (isToday) return { label: 'Em andamento', color: '#D35400', bg: '#FDEBD0', status: 'em_andamento' }
    return { label: 'Sem saída', color: '#E67E22', bg: '#FDEBD0', status: 'incompleto' }
  }

  if (record.tipo === 'folga') return { label: 'Folga não prevista', color: '#8E44AD', bg: '#F4ECF7', status: 'folga_extra' }

  // Registro completo — verificar pontualidade
  let isLate = false, lateMin = 0, isEarlyOut = false

  if (record.entrada && dayResult.hora_entrada) {
    const [eh, em] = dayResult.hora_entrada.split(':').map(Number)
    const actual = new Date(record.entrada)
    lateMin = actual.getHours() * 60 + actual.getMinutes() - (eh * 60 + em)
    if (lateMin > toleranciaMin) isLate = true
  }

  if (record.saida && dayResult.hora_saida) {
    const [sh, sm] = dayResult.hora_saida.split(':').map(Number)
    const actual = new Date(record.saida)
    if (actual.getHours() * 60 + actual.getMinutes() < sh * 60 + sm) isEarlyOut = true
  }

  if (isLate)     return { label: `Atraso ${lateMin}min`, color: '#D35400', bg: '#FDEBD0', status: 'atraso'           }
  if (isEarlyOut) return { label: 'Saída antecipada',     color: '#D35400', bg: '#FDEBD0', status: 'saida_antecipada' }
  return { label: 'No prazo', color: '#17A589', bg: '#EAF4F4', status: 'ok' }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(ts: string | null) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return `${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}/${y}`
}

function formatWeekday(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'short' })
}

function formatInterval(interval: string | null) {
  if (!interval) return '—'
  const match = interval.match(/(\d+):(\d+)/)
  if (!match) return interval
  const h = match[1], min = match[2]
  return min !== '00' ? `${h}h ${min}min` : `${h}h`
}

function getDaysInMonth(ano: number, mes: number) { return new Date(ano, mes, 0).getDate() }
function getFirstDayOfWeek(ano: number, mes: number) { return new Date(ano, mes - 1, 1).getDay() }

function getPrevistoLabel(dayResult: DayResult | null): string {
  if (!dayResult || dayResult.tipo === 'sem_regra') return '—'
  if (dayResult.tipo === 'folga') return 'Folga'
  const h = dayResult.hora_entrada?.slice(0, 5) ?? '?'
  const s = dayResult.hora_saida?.slice(0, 5) ?? '?'
  return `${h}–${s}`
}

function getChipLabel(
  sit: SituacaoInfo,
  record: TimeRecord | null,
  dayResult: DayResult | null,
  isSingleEmp: boolean,
  empNome: string,
): string {
  if (!isSingleEmp) return empNome.split(' ')[0]
  switch (sit.status) {
    case 'previsto':
    case 'aguardando':
      return dayResult?.hora_entrada && dayResult?.hora_saida
        ? `${dayResult.hora_entrada.slice(0,5)}–${dayResult.hora_saida.slice(0,5)}`
        : sit.label
    case 'em_andamento':
    case 'incompleto':
      return record?.entrada ? `${formatTime(record.entrada)} →` : sit.label
    case 'ok':
    case 'atraso':
    case 'saida_antecipada':
      return `${formatTime(record?.entrada ?? null)}–${formatTime(record?.saida ?? null)}`
    default:
      return sit.label
  }
}

const SKIP_METRICS = new Set<Status>(['folga', 'folga_extra', 'sem_escala', 'ferias', 'aguardando'])

// ─── Component ────────────────────────────────────────────────────────────────

export function PontoClient({ records, employees, rules, exceptions, companyId, mes, ano }: Props) {
  const router = useRouter()

  const [view,           setView]          = useState<'lista' | 'calendario'>('lista')
  const [tolerancia,     setTolerancia]    = useState(10)
  const [filterEmployee, setFilter]        = useState('')
  const [modalOpen,      setModalOpen]     = useState(false)
  const [editingRecord,  setEditingRecord] = useState<TimeRecord | null>(null)
  const [modalEmpId,     setModalEmpId]    = useState<string | null>(null)
  const [modalDate,      setModalDate]     = useState<string | null>(null)
  const [modalEntrada,   setModalEntrada]  = useState<string | null>(null)
  const [modalSaida,     setModalSaida]    = useState<string | null>(null)
  const [modalTipo,      setModalTipo]     = useState<string>('normal')
  const [deletingId,     setDeletingId]    = useState<string | null>(null)
  const [deleteError,    setDeleteError]   = useState('')

  const today = new Date().toISOString().slice(0, 10)

  const scheduleMap = useMemo(() => {
    const map = new Map<string, DayResult>()
    for (const emp of employees) {
      const days = generateMonth(rules, exceptions, mes, ano, emp.id)
      for (const d of days) map.set(`${emp.id}|${d.date}`, d)
    }
    return map
  }, [employees, rules, exceptions, mes, ano])

  const recordsMap = useMemo(() => {
    const map = new Map<string, TimeRecord>()
    for (const r of records) map.set(`${r.employee_id}|${r.data}`, r)
    return map
  }, [records])

  // DayEntry[]: orientado à escala (não aos registros)
  const dayEntries = useMemo(() => {
    const totalDias = getDaysInMonth(ano, mes)
    const emps = filterEmployee ? employees.filter(e => e.id === filterEmployee) : employees
    const entries: DayEntry[] = []

    for (const emp of emps) {
      for (let d = 1; d <= totalDias; d++) {
        const dateStr   = `${ano}-${String(mes).padStart(2,'0')}-${String(d).padStart(2,'0')}`
        const isToday   = dateStr === today
        const isFuture  = dateStr > today
        const dayResult = scheduleMap.get(`${emp.id}|${dateStr}`) ?? null
        const record    = recordsMap.get(`${emp.id}|${dateStr}`) ?? null
        const hasSchedule = dayResult && dayResult.tipo !== 'sem_regra'

        if (filterEmployee) {
          // Com filtro: todos os dias com escala ou registro
          if (!hasSchedule && !record) continue
        } else {
          // Sem filtro: só passado+hoje, só dias de trabalho esperados ou com registro
          if (isFuture) continue
          if (!hasSchedule && !record) continue
          if (dayResult?.tipo === 'folga' && !record) continue
        }

        const sit = getSituacao(record, dayResult, tolerancia, isToday, isFuture)
        entries.push({ empId: emp.id, empNome: emp.nome, empCargo: emp.cargo, date: dateStr, dayResult, record, sit, isToday, isFuture })
      }
    }

    entries.sort((a, b) => b.date.localeCompare(a.date) || a.empNome.localeCompare(b.empNome))
    return entries
  }, [employees, scheduleMap, recordsMap, mes, ano, filterEmployee, tolerancia, today])

  // Métricas: só dias passados/hoje com escala de trabalho
  const metrics = useMemo(() => {
    let expected = 0, present = 0, absent = 0, late = 0
    for (const e of dayEntries) {
      if (e.isFuture) continue
      if (SKIP_METRICS.has(e.sit.status)) continue
      expected++
      if (e.sit.status === 'ausente' || e.sit.status === 'falta') { absent++; continue }
      present++
      if (e.sit.status === 'atraso') late++
    }
    const rate = expected > 0 ? Math.round(present / expected * 100) : 100
    return { expected, present, absent, late, rate }
  }, [dayEntries])

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
    const existing  = recordsMap.get(`${empId}|${dateStr}`) ?? null
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

  function openFromList(entry: DayEntry) {
    if (entry.record) openEdit(entry.record)
    else openFromCalendar(entry.date, entry.empId)
  }

  async function handleDelete(entry: DayEntry) {
    if (!entry.record) return
    if (!confirm('Excluir este registro de ponto?')) return
    setDeletingId(entry.record.id); setDeleteError('')
    const result = await deleteTimeRecordAction(entry.record.id)
    setDeletingId(null)
    if ('error' in result) setDeleteError(result.error ?? 'Erro ao excluir.')
    else router.refresh()
  }

  const isSingleEmp = !!filterEmployee
  const firstDay    = getFirstDayOfWeek(ano, mes)
  const totalDias   = getDaysInMonth(ano, mes)
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: totalDias }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

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

          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs"
            style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-secondary)', backgroundColor: 'white' }}>
            <span>Tolerância:</span>
            <input
              type="number" min="0" max="60" value={tolerancia}
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
          { label: 'Dias esperados', value: String(metrics.expected), color: 'var(--color-primary-darker)' },
          { label: 'Presentes',      value: String(metrics.present),  color: '#1E8449' },
          { label: 'Ausências',      value: String(metrics.absent),   color: '#C0392B' },
          { label: 'Atrasos',        value: String(metrics.late),     color: '#D35400' },
          {
            label: '% Presença',
            value: `${metrics.rate}%`,
            color: metrics.rate >= 90 ? '#1E8449' : metrics.rate >= 75 ? '#D35400' : '#C0392B',
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
              const dateStr  = day ? `${ano}-${String(mes).padStart(2,'0')}-${String(day).padStart(2,'0')}` : ''
              const isToday  = dateStr === today
              const isFuture = dateStr > today
              const refEmpId = filterEmployee || employees[0]?.id || ''
              const refDay   = refEmpId && dateStr ? scheduleMap.get(`${refEmpId}|${dateStr}`) : null
              const isFeriado = refDay?.feriado ?? false
              const isDomingo = refDay?.domingo ?? false

              let cellBg = day ? 'white' : '#FAFAFA'
              if (day && isDomingo) cellBg = '#F5F5F5'
              if (day && isFeriado) cellBg = '#EBF5FB'
              if (day && isToday)   cellBg = '#FEFCE8'

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

                      {(isSingleEmp ? employees.filter(e => e.id === filterEmployee) : employees).map(emp => {
                        const dayResult = scheduleMap.get(`${emp.id}|${dateStr}`) ?? null
                        const record    = recordsMap.get(`${emp.id}|${dateStr}`) ?? null
                        const hasSchedule = dayResult && dayResult.tipo !== 'sem_regra'

                        if (!hasSchedule && !record) return null
                        if (!isSingleEmp && dayResult?.tipo === 'folga' && !record) return null

                        const sit   = getSituacao(record, dayResult, tolerancia, isToday, isFuture)
                        const label = getChipLabel(sit, record, dayResult, isSingleEmp, emp.nome)

                        return (
                          <button key={emp.id}
                            onClick={() => openFromCalendar(dateStr, emp.id)}
                            className="w-full text-left mb-0.5 px-1.5 py-0.5 rounded text-xs truncate"
                            style={{ backgroundColor: sit.bg, color: sit.color }}
                            title={`${emp.nome} — ${sit.label}${record ? ` · ${formatTime(record.entrada)}–${formatTime(record.saida)}` : ''}`}>
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
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 border-t text-xs"
            style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-muted)' }}>
            {[
              { bg: '#EAF4F4', label: 'No prazo'           },
              { bg: '#EBF5FB', label: 'Previsto / Extra'   },
              { bg: '#FDEBD0', label: 'Atraso / Em andamento' },
              { bg: '#FDEDEC', label: 'Ausente'             },
              { bg: '#F2F3F4', label: 'Folga / Aguardando' },
              { bg: '#F4ECF7', label: 'Folga não prevista' },
              { bg: '#E9F7EF', label: 'Férias'             },
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
                {!filterEmployee && (
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Funcionário</th>
                )}
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Data</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Previsto</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Entrada</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Almoço</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Saída</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Horas</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Situação</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {dayEntries.length === 0 && (
                <tr>
                  <td colSpan={isSingleEmp ? 8 : 9} className="text-center py-10"
                    style={{ color: 'var(--color-text-muted)' }}>
                    Nenhum dado para {MESES[mes - 1]} {ano}.
                  </td>
                </tr>
              )}

              {dayEntries.map((entry, idx) => {
                const { record, dayResult, sit, isToday, isFuture } = entry
                const previsto  = getPrevistoLabel(dayResult)
                const isAbsent  = sit.status === 'ausente' || sit.status === 'falta'
                const rowBg = isToday
                  ? '#FEFCE8'
                  : isFuture
                  ? '#FAFBFF'
                  : idx % 2 === 0 ? 'white' : '#FAFAFA'

                const entradaColor = sit.status === 'atraso' ? '#D35400' : 'var(--color-text-primary)'
                const saidaColor   = sit.status === 'saida_antecipada' ? '#D35400' : 'var(--color-text-primary)'

                return (
                  <tr key={`${entry.empId}|${entry.date}`} className="border-t"
                    style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: rowBg }}>

                    {!filterEmployee && (
                      <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--color-text-primary)' }}>
                        <div className="font-medium">{entry.empNome}</div>
                        {entry.empCargo && (
                          <div style={{ color: 'var(--color-text-muted)' }}>{entry.empCargo}</div>
                        )}
                      </td>
                    )}

                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      <div className="font-medium">{formatDate(entry.date)}</div>
                      <div className="capitalize" style={{ color: 'var(--color-text-muted)' }}>{formatWeekday(entry.date)}</div>
                    </td>

                    <td className="px-4 py-2.5 text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                      {previsto}
                    </td>

                    <td className="px-4 py-2.5 text-xs font-semibold"
                      style={{ color: isAbsent ? '#C0392B' : entradaColor }}>
                      {record?.entrada ? formatTime(record.entrada) : (isAbsent ? 'Ausente' : '—')}
                    </td>

                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      {record?.saida_almoco
                        ? `${formatTime(record.saida_almoco)}–${formatTime(record.retorno_almoco)}`
                        : '—'}
                    </td>

                    <td className="px-4 py-2.5 text-xs font-semibold"
                      style={{ color: isAbsent ? '#C0392B' : saidaColor }}>
                      {record?.saida ? formatTime(record.saida) : '—'}
                    </td>

                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      {formatInterval(record?.horas_trabalhadas ?? null)}
                    </td>

                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ backgroundColor: sit.bg, color: sit.color }}>
                        {sit.label}
                      </span>
                    </td>

                    <td className="px-4 py-2.5">
                      {record && (
                        <div className="flex items-center gap-1.5 justify-end">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(record)}>Editar</Button>
                          <Button variant="danger" size="sm"
                            loading={deletingId === record.id}
                            onClick={() => handleDelete(entry)}>
                            Excluir
                          </Button>
                        </div>
                      )}
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
