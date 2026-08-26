'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ModalRegraEscala } from './modal-regra-escala'
import { ModalExcecao } from './modal-excecao'
import { deleteRuleAction } from '../actions'
import { generateMonth } from '@/lib/escala/generate'
import type { ScheduleRule, ScheduleException, DayResult } from '@/lib/escala/generate'
import { exportListaPDF, exportCalendarioPDF, exportExcel } from '@/lib/export/escala-export'

interface Props {
  rules: ScheduleRule[]
  exceptions: ScheduleException[]
  employees: { id: string; nome: string; cargo: string | null }[]
  companyId: string
  mes: number
  ano: number
}

const MESES       = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

function formatTime(t: string | null) {
  if (!t) return ''
  return t.slice(0, 5)
}

function getDaysInMonth(ano: number, mes: number) { return new Date(ano, mes, 0).getDate() }
function getFirstDayOfWeek(ano: number, mes: number) { return new Date(ano, mes - 1, 1).getDay() }

function getWeekStart(offset: number): Date {
  const today = new Date()
  const sun = new Date(today)
  sun.setDate(today.getDate() - today.getDay() + offset * 7)
  sun.setHours(0, 0, 0, 0)
  return sun
}

function getInitials(nome: string): string {
  return nome.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

function formatWeekRange(dates: Date[]): string {
  const s = dates[0], e = dates[6]
  const M = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  if (s.getMonth() === e.getMonth())
    return `${s.getDate()} – ${e.getDate()} de ${M[s.getMonth()]} de ${s.getFullYear()}`
  return `${s.getDate()} ${M[s.getMonth()]} – ${e.getDate()} ${M[e.getMonth()]} ${e.getFullYear()}`
}

// ── ThreeDotMenu ──────────────────────────────────────────────────────────────

function ThreeDotMenu({ onEdit, onDelete, loading }: { onEdit: () => void; onDelete: () => void; loading: boolean }) {
  const [open, setOpen] = useState(false)
  const [pos,  setPos]  = useState({ top: 0, right: 0 })
  const menuRef = useRef<HTMLDivElement>(null)
  const btnRef  = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        btnRef.current  && !btnRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function handleOpen() {
    const rect = btnRef.current?.getBoundingClientRect()
    if (rect) {
      const openUp = rect.bottom + 130 > window.innerHeight - 8
      setPos(openUp
        ? { top: rect.top - 134, right: window.innerWidth - rect.right }
        : { top: rect.bottom + 4, right: window.innerWidth - rect.right }
      )
    }
    setOpen(v => !v)
  }

  return (
    <div>
      <button ref={btnRef} type="button" onClick={handleOpen}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-lg hover:bg-gray-100 transition-colors"
        style={{ color: 'var(--color-text-muted)' }} aria-label="Opções">
        ···
      </button>
      {open && (
        <div ref={menuRef} className="fixed w-36 rounded-xl border shadow-lg py-1 z-50"
          style={{ backgroundColor: 'white', borderColor: 'var(--color-bg-surface)', top: pos.top, right: pos.right }}>
          <button type="button" onClick={() => { setOpen(false); onEdit() }}
            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
            style={{ color: 'var(--color-text-secondary)' }}>Editar</button>
          <button type="button" onClick={() => { setOpen(false); onDelete() }} disabled={loading}
            className="w-full text-left px-4 py-2 text-sm hover:bg-red-50"
            style={{ color: 'var(--color-error)' }}>
            {loading ? 'Excluindo…' : 'Excluir'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── ExportMenu ────────────────────────────────────────────────────────────────

function ExportMenu({ onPDF, onExcel }: { onPDF: () => void; onExcel: () => void }) {
  const [open, setOpen] = useState(false)
  const [pos,  setPos]  = useState({ top: 0, right: 0 })
  const menuRef = useRef<HTMLDivElement>(null)
  const btnRef  = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        btnRef.current  && !btnRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function handleOpen() {
    const rect = btnRef.current?.getBoundingClientRect()
    if (rect) {
      const openUp = rect.bottom + 130 > window.innerHeight - 8
      setPos(openUp
        ? { top: rect.top - 134, right: window.innerWidth - rect.right }
        : { top: rect.bottom + 4, right: window.innerWidth - rect.right }
      )
    }
    setOpen(v => !v)
  }

  return (
    <div>
      <button ref={btnRef} type="button" onClick={handleOpen}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors"
        style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-secondary)' }}>
        Baixar ▾
      </button>
      {open && (
        <div ref={menuRef} className="fixed w-40 rounded-xl border shadow-lg py-1 z-50"
          style={{ backgroundColor: 'white', borderColor: 'var(--color-bg-surface)', top: pos.top, right: pos.right }}>
          <button type="button" onClick={() => { setOpen(false); onPDF() }}
            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
            style={{ color: 'var(--color-text-secondary)' }}>PDF</button>
          <button type="button" onClick={() => { setOpen(false); onExcel() }}
            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
            style={{ color: 'var(--color-text-secondary)' }}>Excel</button>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

type ListRow = { emp: { id: string; nome: string; cargo: string | null }; day: DayResult }

export function EscalaClient({ rules, exceptions, employees, companyId, mes, ano }: Props) {
  const router = useRouter()

  const [view,           setView]        = useState<'calendario' | 'cronograma'>('calendario')
  const [weekOffset,     setWeekOffset]  = useState(0)
  const [filterEmployee, setFilter]      = useState('')
  const [modalRegra,     setModalRegra]  = useState(false)
  const [editingRule,    setEditingRule] = useState<ScheduleRule | null>(null)
  const [deletingId,     setDeletingId] = useState<string | null>(null)
  const [excOpen,        setExcOpen]    = useState(false)
  const [excDate,        setExcDate]    = useState<string | null>(null)
  const [excEmpId,       setExcEmpId]   = useState<string | null>(null)
  const calendarRef = useRef<HTMLDivElement>(null)

  const filteredEmps = filterEmployee ? employees.filter(e => e.id === filterEmployee) : employees

  // Mapa data → [{emp, day}] para o calendário
  const byDate: Record<string, ListRow[]> = {}
  for (const emp of filteredEmps) {
    const days = generateMonth(rules, exceptions, mes, ano, emp.id)
    for (const day of days) {
      if (!byDate[day.date]) byDate[day.date] = []
      byDate[day.date].push({ emp, day })
    }
  }

  // Linhas da view Lista (só dias de trabalho)
  const listaRows: ListRow[] = []
  for (const emp of filteredEmps) {
    const days = generateMonth(rules, exceptions, mes, ano, emp.id)
    for (const day of days) {
      if (day.tipo === 'trabalho') listaRows.push({ emp, day })
    }
  }
  listaRows.sort((a, b) => a.day.date.localeCompare(b.day.date) || a.emp.nome.localeCompare(b.emp.nome))

  // Cronograma semanal
  const weekStart = getWeekStart(weekOffset)
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  })
  const cronogramaData = filteredEmps.map(emp => {
    const cache: Record<string, DayResult[]> = {}
    const days = weekDates.map(date => {
      const m = date.getMonth() + 1
      const y = date.getFullYear()
      const key = `${y}-${m}`
      if (!cache[key]) cache[key] = generateMonth(rules, exceptions, m, y, emp.id)
      const ds = `${y}-${String(m).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      return cache[key].find(d => d.date === ds) ?? null
    })
    return { emp, days }
  })

  // Células do calendário
  const totalDias = getDaysInMonth(ano, mes)
  const firstDay  = getFirstDayOfWeek(ano, mes)
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: totalDias }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  function navMes(delta: number) {
    let m = mes + delta, a = ano
    if (m < 1)  { m = 12; a-- }
    if (m > 12) { m = 1;  a++ }
    router.push(`/pessoas/escala-de-trabalho?mes=${m}&ano=${a}`)
  }

  function openExcecao(dateStr: string, empId: string) {
    setExcDate(dateStr); setExcEmpId(empId); setExcOpen(true)
  }

  async function handleDeleteRule(ruleId: string) {
    if (!confirm('Excluir esta regra de escala?')) return
    setDeletingId(ruleId)
    const result = await deleteRuleAction(ruleId, companyId)
    setDeletingId(null)
    if ('error' in result) alert(result.error)
    else router.refresh()
  }

  async function handleExportPDF() {
    if (calendarRef.current) {
      await exportCalendarioPDF(calendarRef.current, mes, ano)
    }
  }

  async function handleExportExcel() {
    await exportExcel(listaRows.map(r => ({ ...r.day, employeeName: r.emp.nome })), mes, ano)
  }

  const excExistente = excDate && excEmpId
    ? exceptions.find(e => e.data === excDate && e.employee_id === excEmpId) ?? null
    : null
  const excEmpName = excEmpId ? employees.find(e => e.id === excEmpId)?.nome ?? null : null
  const filteredRules = filterEmployee ? rules.filter(r => r.employee_id === filterEmployee) : rules

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
            Escala de Trabalho
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Turnos e jornadas dos colaboradores
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: 'var(--color-bg-surface)' }}>
            {(['calendario', 'cronograma'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className="px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  backgroundColor: view === v ? 'var(--color-primary)' : 'white',
                  color: view === v ? 'var(--color-primary-darker)' : 'var(--color-text-secondary)',
                }}>
                {v === 'calendario' ? '📅 Calendário' : '📋 Cronograma'}
              </button>
            ))}
          </div>
          <Button variant="ghost" onClick={() => router.push('/pessoas/escala-de-trabalho/nova')}>Adicionar</Button>
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

      {/* Filtro */}
      <div className="mb-4">
        <select value={filterEmployee} onChange={e => setFilter(e.target.value)}
          className="w-full px-4 py-2 rounded-lg border text-sm"
          style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white', color: 'var(--color-text-primary)' }}>
          <option value="">Todos os funcionários</option>
          {employees.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
      </div>

      {/* ── Calendário ───────────────────────────────────────────────────── */}
      {view === 'calendario' && (
        <div ref={calendarRef} className="rounded-xl border overflow-hidden"
          style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
          <div className="grid grid-cols-7 border-b"
            style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'var(--color-bg-surface)' }}>
            {DIAS_SEMANA.map(d => (
              <div key={d} className="text-center py-2 text-xs font-medium"
                style={{ color: 'var(--color-text-secondary)' }}>{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {cells.map((day, idx) => {
              const dateStr = day
                ? `${ano}-${String(mes).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                : ''
              const entries   = dateStr ? (byDate[dateStr] ?? []) : []
              const isToday   = dateStr === new Date().toISOString().slice(0, 10)
              const firstDay2 = entries[0]?.day
              const isFeriado = firstDay2?.feriado ?? false
              const isDomingo = firstDay2?.domingo ?? false

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
                        {isFeriado && firstDay2?.feriado_nome && (
                          <span title={firstDay2.feriado_nome}
                            style={{ fontSize: '0.58rem', color: '#2471A3', maxWidth: 56, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {firstDay2.feriado_nome}
                          </span>
                        )}
                      </div>

                      {entries.map(({ emp, day: d }) => {
                        if (d.tipo === 'sem_regra') return null
                        const isFolga = d.tipo === 'folga'
                        return (
                          <button key={emp.id}
                            onClick={() => openExcecao(dateStr, emp.id)}
                            className="w-full text-left mb-0.5 px-1.5 py-0.5 rounded"
                            style={{
                              backgroundColor: isFolga ? '#F4F6F7' : '#E9F7EF',
                              color: isFolga ? '#888' : '#1E8449',
                            }}
                            title={`${emp.nome} — ${isFolga ? 'Folga' : `${formatTime(d.hora_entrada)}–${formatTime(d.hora_saida)}`}${d.excecao ? ' (exceção)' : ''}`}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {emp.nome.split(' ')[0]}{d.excecao ? ' *' : ''}
                            </div>
                            {!isFolga && (
                              <div style={{ fontSize: '0.63rem', opacity: 0.8 }}>
                                {formatTime(d.hora_entrada)}–{formatTime(d.hora_saida)}
                              </div>
                            )}
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
              { bg: '#E9F7EF', label: 'Trabalho' },
              { bg: '#F4F6F7', label: 'Folga' },
              { bg: '#EBF5FB', label: 'Feriado' },
              { bg: '#F5F5F5', label: 'Domingo' },
            ].map(l => (
              <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: l.bg, display: 'inline-block' }} />
                {l.label}
              </span>
            ))}
            <span>* = exceção manual</span>
          </div>
        </div>
      )}

      {/* Exportar — abaixo do calendário, alinhado à direita */}
      {view === 'calendario' && (
        <div className="flex justify-end mt-3">
          <ExportMenu onPDF={handleExportPDF} onExcel={handleExportExcel} />
        </div>
      )}

      {/* ── Cronograma ───────────────────────────────────────────────────── */}
      {view === 'cronograma' && (
        <>
          {/* Navegação semanal */}
          <div className="flex items-center justify-between mb-4 p-3 rounded-xl border"
            style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
            <button onClick={() => setWeekOffset(w => w - 1)}
              className="px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50 transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}>← Anterior</button>
            <span className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>
              {formatWeekRange(weekDates)}
            </span>
            <button onClick={() => setWeekOffset(w => w + 1)}
              className="px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50 transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}>Próxima →</button>
          </div>

          {/* Grade semanal */}
          <div className="rounded-xl border overflow-x-auto"
            style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
            <table style={{ width: '100%', minWidth: 860, borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-bg-surface)' }}>
                  <th style={{ textAlign: 'left', padding: '0.6rem 0.75rem', fontWeight: 600, fontSize: '0.72rem', color: 'var(--color-text-secondary)', width: 160, borderBottom: '1px solid var(--color-bg-surface)' }}>
                    Pessoa
                  </th>
                  {weekDates.map((d, i) => {
                    const isToday = d.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10)
                    const isDom   = d.getDay() === 0
                    const isSab   = d.getDay() === 6
                    return (
                      <th key={i} style={{
                        textAlign: 'center', padding: '0.5rem 0.25rem',
                        fontWeight: 600, fontSize: '0.72rem', borderBottom: '1px solid var(--color-bg-surface)',
                        color: isDom ? '#bbb' : 'var(--color-text-secondary)',
                        backgroundColor: isToday ? 'var(--color-primary)' : isSab ? '#FAFAFA' : undefined,
                        minWidth: 88,
                      }}>
                        <div>{DIAS_SEMANA[d.getDay()]}</div>
                        <div style={{ fontWeight: 400, fontSize: '0.68rem', marginTop: 1 }}>
                          {String(d.getDate()).padStart(2, '0')}/{String(d.getMonth() + 1).padStart(2, '0')}
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {cronogramaData.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--color-text-muted)' }}>
                      Nenhum funcionário com escala cadastrada.
                    </td>
                  </tr>
                )}
                {cronogramaData.map(({ emp, days }, empIdx) => (
                  <tr key={emp.id} style={{
                    borderTop: '1px solid var(--color-bg-surface)',
                    backgroundColor: empIdx % 2 === 0 ? 'white' : '#FAFAFA',
                  }}>
                    {/* Coluna de pessoa */}
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: '50%',
                          backgroundColor: 'var(--color-primary)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-primary-darker)',
                          flexShrink: 0,
                        }}>
                          {getInitials(emp.nome)}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-primary)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {emp.nome.split(' ').slice(0, 2).join(' ')}
                          </div>
                          {emp.cargo && (
                            <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginTop: 1 }}>{emp.cargo}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    {/* Células de dia */}
                    {days.map((day, dayIdx) => {
                      const dateStr = weekDates[dayIdx].toISOString().slice(0, 10)
                      const isDom   = weekDates[dayIdx].getDay() === 0
                      const isSab   = weekDates[dayIdx].getDay() === 6

                      if (!day || day.tipo === 'sem_regra') {
                        return (
                          <td key={dayIdx} style={{ textAlign: 'center', padding: '0.5rem 0.25rem', color: 'var(--color-text-muted)', fontSize: '0.68rem', backgroundColor: isDom ? '#F8F8F8' : undefined }}>
                            —
                          </td>
                        )
                      }
                      const isFolga = day.tipo === 'folga'
                      return (
                        <td key={dayIdx}
                          onClick={() => openExcecao(dateStr, emp.id)}
                          style={{
                            textAlign: 'center', padding: '0.5rem 0.25rem', cursor: 'pointer',
                            backgroundColor: isFolga
                              ? (isDom || isSab ? '#F0F0F0' : '#F4F6F7')
                              : day.feriado ? '#EBF5FB' : '#E9F7EF',
                          }}
                          title={`${emp.nome} — ${isFolga ? 'Folga' : `${formatTime(day.hora_entrada)}–${formatTime(day.hora_saida)}`}${day.excecao ? ' (exceção)' : ''}`}
                        >
                          {isFolga ? (
                            <span style={{ fontSize: '0.68rem', color: '#aaa', fontWeight: 500 }}>Folga</span>
                          ) : (
                            <div>
                              <div style={{ fontSize: '0.72rem', color: '#1E8449', fontWeight: 600, lineHeight: 1.3 }}>
                                {formatTime(day.hora_entrada)}
                              </div>
                              <div style={{ fontSize: '0.65rem', color: '#27AE60', lineHeight: 1.2 }}>
                                {formatTime(day.hora_saida)}
                              </div>
                            </div>
                          )}
                          {day.excecao && (
                            <span style={{ fontSize: '0.58rem', color: 'var(--color-text-muted)' }}> ✱</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legenda */}
          <div className="flex flex-wrap items-center gap-4 px-2 py-2 mt-2 text-xs"
            style={{ color: 'var(--color-text-muted)' }}>
            {[
              { bg: '#E9F7EF', label: 'Trabalho' },
              { bg: '#F4F6F7', label: 'Folga' },
              { bg: '#EBF5FB', label: 'Feriado' },
              { bg: '#F0F0F0', label: 'Fim de semana' },
            ].map(l => (
              <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: l.bg, display: 'inline-block', border: '1px solid #e0e0e0' }} />
                {l.label}
              </span>
            ))}
            <span>✱ = exceção manual</span>
          </div>

          {/* Regras — gerenciamento */}
          <div style={{ marginTop: '1.5rem' }}>
            <p style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
              Regras de escala
            </p>
            <div className="rounded-xl border overflow-x-auto"
              style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
              <table className="w-full min-w-[700px] text-sm">
                <thead style={{ backgroundColor: 'var(--color-bg-surface)' }}>
                  <tr>
                    {['Funcionário','Início','Fim','Horário','Folgas fixas',''].map((h, i) => (
                      <th key={i} className={`${i < 5 ? 'text-left' : ''} px-4 py-3 font-medium`}
                        style={{ color: 'var(--color-text-secondary)', fontSize: '0.75rem' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRules.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-8" style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                      Nenhuma regra cadastrada.
                    </td></tr>
                  )}
                  {filteredRules.map((rule, idx) => {
                    const emp = employees.find(e => e.id === rule.employee_id)
                    const DIAS_L = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
                    const folgasLabel = rule.dias_folga.length > 0
                      ? rule.dias_folga.map(d => DIAS_L[d]).join(', ')
                      : 'Sem folga fixa'
                    const fmtDate = (s: string) => { const [y, m, d] = s.split('-'); return `${d}/${m}/${y}` }
                    return (
                      <tr key={rule.id} className="border-t"
                        style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: idx % 2 === 0 ? 'white' : '#FAFAFA' }}>
                        <td className="px-4 py-2 text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>{emp?.nome ?? '—'}</td>
                        <td className="px-4 py-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{fmtDate(rule.data_inicio)}</td>
                        <td className="px-4 py-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                          {rule.data_fim ? fmtDate(rule.data_fim) : <span style={{ color: 'var(--color-text-muted)' }}>Indefinido</span>}
                        </td>
                        <td className="px-4 py-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                          {formatTime(rule.hora_entrada)}–{formatTime(rule.hora_saida)}
                        </td>
                        <td className="px-4 py-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{folgasLabel}</td>
                        <td className="px-4 py-2">
                          <div className="flex justify-end">
                            <ThreeDotMenu
                              onEdit={() => { setEditingRule(rule); setModalRegra(true) }}
                              onDelete={() => handleDeleteRule(rule.id)}
                              loading={deletingId === rule.id}
                            />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <ModalRegraEscala
        open={modalRegra}
        onClose={() => { setModalRegra(false); setEditingRule(null) }}
        companyId={companyId}
        employees={employees}
        rule={editingRule}
      />

      <ModalExcecao
        open={excOpen}
        onClose={() => setExcOpen(false)}
        companyId={companyId}
        date={excDate}
        employeeId={excEmpId}
        employeeName={excEmpName}
        existingException={excExistente}
      />
    </>
  )
}
