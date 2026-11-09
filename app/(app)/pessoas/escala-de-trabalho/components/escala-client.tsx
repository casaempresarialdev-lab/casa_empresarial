'use client'

import { useMemo, useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { SummaryCard } from '@/components/modules/dashboard/summary-card'
import { AddButton } from '@/components/ui/add-button'
import { FilterResult, FilterSelect } from '@/components/ui/filter-select'
import { Tabs } from '@/components/ui/form-steps'
import { Icon } from '@/components/ui/icon'
import { iniciais } from '../../funcionarios/components/ficha/ficha-config'
import { ModalRegraEscala } from './modal-regra-escala'
import { ModalExcecao } from './modal-excecao'
import { deleteRuleAction } from '../actions'
import { generateMonth } from '@/lib/escala/generate'
import type { ScheduleRule, ScheduleException, DayResult } from '@/lib/escala/generate'
import { exportCalendarioPDF, exportExcel } from '@/lib/export/escala-export'

interface Props {
  rules: ScheduleRule[]
  exceptions: ScheduleException[]
  employees: { id: string; nome: string; cargo: string | null }[]
  companyId: string
  mes: number
  ano: number
  readOnly?: boolean
}

const MESES       = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

function formatTime(t: string | null) {
  if (!t) return ''
  return t.slice(0, 5)
}

function getDaysInMonth(ano: number, mes: number) { return new Date(ano, mes, 0).getDate() }
function getFirstDayOfWeek(ano: number, mes: number) { return new Date(ano, mes - 1, 1).getDay() }

function getWeeksOfMonth(mes: number, ano: number): Date[][] {
  const firstDay = new Date(ano, mes - 1, 1)
  const sun = new Date(firstDay)
  sun.setDate(firstDay.getDate() - firstDay.getDay())
  sun.setHours(0, 0, 0, 0)
  const lastDay = new Date(ano, mes, 0)
  const weeks: Date[][] = []
  const d = new Date(sun)
  while (d <= lastDay) {
    weeks.push(Array.from({ length: 7 }, (_, i) => {
      const day = new Date(d)
      day.setDate(d.getDate() + i)
      return day
    }))
    d.setDate(d.getDate() + 7)
  }
  return weeks
}

function weekTabLabel(week: Date[], mes: number): string {
  const inMonth = week.filter(d => d.getMonth() + 1 === mes)
  if (!inMonth.length) return ''
  const min = inMonth[0].getDate()
  const max = inMonth[inMonth.length - 1].getDate()
  return `${String(min).padStart(2, '0')} – ${String(max).padStart(2, '0')}`
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

// ── Legenda ───────────────────────────────────────────────────────────────────

function Legenda({ itens, className = '' }: { itens: [string, string][]; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-4 text-xs ${className}`} style={{ color: 'var(--color-text-muted)' }}>
      {itens.map(([cor, rotulo]) => (
        <span key={rotulo} className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-sm border" style={{ backgroundColor: cor, borderColor: 'var(--color-card-border)' }} />
          {rotulo}
        </span>
      ))}
      <span>* = exceção manual</span>
    </div>
  )
}


// ── Main component ────────────────────────────────────────────────────────────

type ListRow = { emp: { id: string; nome: string; cargo: string | null }; day: DayResult }

export function EscalaClient({ rules, exceptions, employees, companyId, mes, ano, readOnly = false }: Props) {
  const router = useRouter()

  const [view,           setView]        = useState<'calendario' | 'cronograma'>('calendario')
  const [weekIdx,        setWeekIdx]     = useState(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    if (today.getMonth() + 1 === mes && today.getFullYear() === ano) {
      const idx = getWeeksOfMonth(mes, ano).findIndex(w => w[0] <= today && today <= w[6])
      return idx >= 0 ? idx : 0
    }
    return 0
  })
  const [filterEmployee, setFilter]      = useState('')
  const [modalRegra,     setModalRegra]  = useState(false)
  const [editingRule,    setEditingRule] = useState<ScheduleRule | null>(null)
  const [deletingId,     setDeletingId] = useState<string | null>(null)
  const [excOpen,        setExcOpen]    = useState(false)
  const [excDate,        setExcDate]    = useState<string | null>(null)
  const [excEmpId,       setExcEmpId]   = useState<string | null>(null)
  const calendarRef = useRef<HTMLDivElement>(null)

  const filteredEmps = filterEmployee ? employees.filter(e => e.id === filterEmployee) : employees
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())

  // Os dias do mês de cada pessoa
  const porPessoa = useMemo(
    () => (filterEmployee ? employees.filter(e => e.id === filterEmployee) : employees).map(emp => ({ emp, days: generateMonth(rules, exceptions, mes, ano, emp.id) })),
    [employees, filterEmployee, rules, exceptions, mes, ano],
  )

  // Mapa data → [{emp, day}] para o calendário
  const byDate: Record<string, ListRow[]> = {}
  // Dias de trabalho, para o Excel
  const listaRows: ListRow[] = []
  for (const { emp, days } of porPessoa) {
    for (const day of days) {
      if (!byDate[day.date]) byDate[day.date] = []
      byDate[day.date].push({ emp, day })
      if (day.tipo === 'trabalho') listaRows.push({ emp, day })
    }
  }
  listaRows.sort((a, b) => a.day.date.localeCompare(b.day.date) || a.emp.nome.localeCompare(b.emp.nome))

  const todosOsDias = porPessoa.flatMap(p => p.days)
  const indicadores = {
    comEscala: porPessoa.filter(p => p.days.some(d => d.tipo !== 'sem_regra')).length,
    trabalho: todosOsDias.filter(d => d.tipo === 'trabalho').length,
    folgas: todosOsDias.filter(d => d.tipo === 'folga').length,
    feriados: new Set(todosOsDias.filter(d => d.feriado).map(d => d.date)).size,
    excecoes: todosOsDias.filter(d => d.excecao).length,
  }

  // Cronograma semanal
  const weeksOfMonth = getWeeksOfMonth(mes, ano)
  const weekDates    = weeksOfMonth[Math.min(weekIdx, weeksOfMonth.length - 1)]
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
    if (readOnly) return
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

  const seta = 'w-9 h-9 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-100'
  const botao = 'inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-sm font-medium transition-colors hover:bg-gray-50 shrink-0'
  const estiloBotao = { borderColor: 'var(--color-card-border)', color: 'var(--color-text-secondary)' }
  const borda = { borderColor: 'var(--color-card-border)' }
  const cursorDia = readOnly ? 'cursor-default' : 'cursor-pointer'

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>Escala de Trabalho</h1>
        <Breadcrumb />
      </div>

      <Tabs labels={['Calendário', 'Cronograma']} step={view === 'calendario' ? 0 : 1} onSelect={(i) => setView(i === 0 ? 'calendario' : 'cronograma')} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
        <SummaryCard icon="users" title="Pessoas com escala" value={indicadores.comEscala} caption={`de ${porPessoa.length} ${porPessoa.length === 1 ? 'funcionário' : 'funcionários'}`} accent={indicadores.comEscala < porPessoa.length ? 'yellow' : undefined} />
        <SummaryCard icon="briefcase" title="Dias de trabalho" value={indicadores.trabalho} caption={`em ${MESES[mes - 1].toLowerCase()}`} delay={60} />
        <SummaryCard icon="star" title="Folgas" value={indicadores.folgas} caption="dias no mês" delay={120} />
        <SummaryCard icon="calendar" title="Feriados" value={indicadores.feriados} caption="no mês" delay={180} />
        <SummaryCard icon="pencil" title="Exceções" value={indicadores.excecoes} caption="ajustes manuais" delay={240} />
      </div>

      <div className="app-card p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1" style={{ color: 'var(--color-sidebar-text)' }}>
            <button type="button" onClick={() => navMes(-1)} aria-label="Mês anterior" className={seta}><Icon name="chevron-left" size={18} /></button>
            <span className="w-36 text-center text-sm font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>{MESES[mes - 1]} {ano}</span>
            <button type="button" onClick={() => navMes(1)} aria-label="Próximo mês" className={seta}><Icon name="chevron-right" size={18} /></button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {view === 'calendario' && (
              <>
                <button type="button" onClick={handleExportPDF} className={botao} style={estiloBotao}><Icon name="download" size={16} /> PDF</button>
                <button type="button" onClick={handleExportExcel} className={botao} style={estiloBotao}><Icon name="download" size={16} /> Excel</button>
              </>
            )}
            {!readOnly && <AddButton onClick={() => router.push('/pessoas/escala-de-trabalho/nova')} />}
          </div>
        </div>

        {(employees.length > 1 || view === 'cronograma') && (
          <div className="flex flex-wrap items-center gap-2">
            {employees.length > 1 && (
              <FilterSelect
                value={filterEmployee}
                onChange={setFilter}
                label="Filtrar por funcionário"
                options={[{ value: '', label: 'Todos os funcionários' }, ...employees.map(e => ({ value: e.id, label: e.nome }))]}
              />
            )}
            {view === 'cronograma' && weeksOfMonth.map((week, i) => {
              const ativa = i === weekIdx
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setWeekIdx(i)}
                  aria-pressed={ativa}
                  className={`h-9 px-3 rounded-lg border text-sm tabular-nums transition-colors cursor-pointer ${ativa ? 'font-semibold' : 'hover:bg-gray-50'}`}
                  style={ativa
                    ? { borderColor: 'var(--color-brand)', backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }
                    : estiloBotao}
                >
                  {weekTabLabel(week, mes)}
                </button>
              )
            })}
            {filterEmployee && <FilterResult total={porPessoa.length} onClear={() => setFilter('')} />}
          </div>
        )}

        {/* ── Calendário ───────────────────────────────────────────────────── */}
        {view === 'calendario' && (
          <div className="rounded-xl border overflow-x-auto" style={borda}>
            {/* O PDF é uma imagem deste bloco */}
            <div ref={calendarRef} className="min-w-[720px] bg-white">
              <div className="grid grid-cols-7 border-b" style={{ ...borda, backgroundColor: 'var(--color-bg-surface)' }}>
                {DIAS_SEMANA.map(d => (
                  <div key={d} className="text-center py-2 text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {cells.map((day, idx) => {
                  const dateStr = day
                    ? `${ano}-${String(mes).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                    : ''
                  const entries   = dateStr ? (byDate[dateStr] ?? []) : []
                  const isToday   = dateStr === hoje
                  const firstDay2 = entries[0]?.day
                  const isFeriado = firstDay2?.feriado ?? false
                  const isDomingo = firstDay2?.domingo ?? false

                  let cellBg = day ? 'white' : '#FAFAFA'
                  if (day && isDomingo) cellBg = '#F5F5F5'
                  if (day && isFeriado) cellBg = '#EBF5FB'

                  return (
                    <div key={idx} className="min-h-[96px] border-r border-b p-1.5" style={{ ...borda, backgroundColor: cellBg }}>
                      {day && (
                        <>
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span
                              className="text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full shrink-0"
                              style={{
                                backgroundColor: isToday ? 'var(--color-brand)' : 'transparent',
                                color: isToday ? '#fff' : isDomingo ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
                              }}
                            >
                              {day}
                            </span>
                            {isFeriado && firstDay2?.feriado_nome && (
                              <span title={firstDay2.feriado_nome} className="text-[10px] truncate" style={{ color: '#2471A3' }}>{firstDay2.feriado_nome}</span>
                            )}
                          </div>

                          {entries.map(({ emp, day: d }) => {
                            if (d.tipo === 'sem_regra') return null
                            const isFolga = d.tipo === 'folga'
                            return (
                              <button
                                key={emp.id}
                                type="button"
                                onClick={() => openExcecao(dateStr, emp.id)}
                                className={`w-full text-left mb-0.5 px-1.5 py-0.5 rounded ${cursorDia}`}
                                style={{ backgroundColor: isFolga ? '#F4F6F7' : '#E9F7EF', color: isFolga ? '#888' : '#1E8449' }}
                                title={`${emp.nome} — ${isFolga ? 'Folga' : `${formatTime(d.hora_entrada)}–${formatTime(d.hora_saida)}`}${d.excecao ? ' (exceção)' : ''}`}
                              >
                                <span className="block text-xs font-medium truncate">{emp.nome.split(' ')[0]}{d.excecao ? ' *' : ''}</span>
                                {!isFolga && <span className="block text-[10px] tabular-nums opacity-80">{formatTime(d.hora_entrada)}–{formatTime(d.hora_saida)}</span>}
                              </button>
                            )
                          })}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>

              <Legenda itens={[['#E9F7EF', 'Trabalho'], ['#F4F6F7', 'Folga'], ['#EBF5FB', 'Feriado'], ['#F5F5F5', 'Domingo']]} className="px-4 py-2" />
            </div>
          </div>
        )}

        {/* ── Cronograma ───────────────────────────────────────────────────── */}
        {view === 'cronograma' && (
          <>
            <div className="rounded-xl border overflow-x-auto" style={borda}>
              <table className="w-full border-collapse text-sm" style={{ minWidth: 860 }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--color-bg-surface)' }}>
                    <th className="text-left px-3 py-2 text-xs font-semibold w-44" style={{ color: 'var(--color-text-secondary)' }}>Pessoa</th>
                    {weekDates.map((d, i) => (
                      <th
                        key={i}
                        className="text-center px-1 py-2 text-xs font-semibold"
                        style={{
                          minWidth: 88,
                          color: d.getDay() === 0 ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
                          backgroundColor: d.toISOString().slice(0, 10) === hoje ? 'var(--color-brand-light)' : undefined,
                        }}
                      >
                        <span className="block">{DIAS_SEMANA[d.getDay()]}</span>
                        <span className="block font-normal text-[11px] tabular-nums">{String(d.getDate()).padStart(2, '0')}/{String(d.getMonth() + 1).padStart(2, '0')}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cronogramaData.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-10" style={{ color: 'var(--color-text-muted)' }}>Nenhum funcionário com escala cadastrada.</td></tr>
                  )}
                  {cronogramaData.map(({ emp, days }) => (
                    <tr key={emp.id} className="border-t bg-white" style={borda}>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}>
                            {iniciais(emp.nome)}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-bold truncate" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>{emp.nome.split(' ').slice(0, 2).join(' ')}</p>
                            {emp.cargo && <p className="text-[11px] truncate" style={{ color: 'var(--color-text-muted)' }}>{emp.cargo}</p>}
                          </div>
                        </div>
                      </td>
                      {days.map((day, dayIdx) => {
                        const dateStr = weekDates[dayIdx].toISOString().slice(0, 10)
                        const fimDeSemana = weekDates[dayIdx].getDay() === 0 || weekDates[dayIdx].getDay() === 6

                        if (!day || day.tipo === 'sem_regra') {
                          return <td key={dayIdx} className="text-center px-1 py-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>—</td>
                        }
                        const isFolga = day.tipo === 'folga'
                        return (
                          <td
                            key={dayIdx}
                            onClick={() => openExcecao(dateStr, emp.id)}
                            className={`text-center px-1 py-2 border-l ${cursorDia}`}
                            style={{ ...borda, backgroundColor: isFolga ? (fimDeSemana ? '#F0F0F0' : '#F4F6F7') : day.feriado ? '#EBF5FB' : '#E9F7EF' }}
                            title={`${emp.nome} — ${isFolga ? 'Folga' : `${formatTime(day.hora_entrada)}–${formatTime(day.hora_saida)}`}${day.excecao ? ' (exceção)' : ''}`}
                          >
                            {isFolga ? (
                              <span className="text-xs font-medium" style={{ color: '#888' }}>Folga{day.excecao ? ' *' : ''}</span>
                            ) : (
                              <>
                                <span className="block text-xs font-semibold tabular-nums" style={{ color: '#1E8449' }}>{formatTime(day.hora_entrada)}{day.excecao ? ' *' : ''}</span>
                                <span className="block text-[11px] tabular-nums" style={{ color: '#1E8449', opacity: 0.8 }}>{formatTime(day.hora_saida)}</span>
                              </>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Legenda itens={[['#E9F7EF', 'Trabalho'], ['#F4F6F7', 'Folga'], ['#EBF5FB', 'Feriado'], ['#F0F0F0', 'Fim de semana']]} />
          </>
        )}
      </div>

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
