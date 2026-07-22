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
    if (rect) setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
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
    if (rect) setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    setOpen(v => !v)
  }

  return (
    <div>
      <button ref={btnRef} type="button" onClick={handleOpen}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-gray-50 transition-colors"
        style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-secondary)' }}>
        Exportar ▾
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

  const [view,           setView]        = useState<'calendario' | 'lista' | 'regras'>('calendario')
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
    if (view === 'lista') {
      await exportListaPDF(listaRows.map(r => ({ ...r.day, employeeName: r.emp.nome })), mes, ano)
    } else if (calendarRef.current) {
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
            {(['calendario', 'lista', 'regras'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className="px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  backgroundColor: view === v ? 'var(--color-primary)' : 'white',
                  color: view === v ? 'var(--color-primary-darker)' : 'var(--color-text-secondary)',
                }}>
                {v === 'calendario' ? '📅 Calendário' : v === 'lista' ? '☰ Lista' : '⚙ Escalas'}
              </button>
            ))}
          </div>
          <ExportMenu onPDF={handleExportPDF} onExcel={handleExportExcel} />
          <Button variant="ghost" onClick={() => { setEditingRule(null); setModalRegra(true) }}>Adicionar</Button>
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
                            className="w-full text-left mb-0.5 px-1.5 py-0.5 rounded text-xs truncate"
                            style={{
                              backgroundColor: isFolga ? '#F4F6F7' : '#E9F7EF',
                              color: isFolga ? '#888' : '#1E8449',
                            }}
                            title={`${emp.nome} — ${isFolga ? 'Folga' : `${formatTime(d.hora_entrada)}–${formatTime(d.hora_saida)}`}${d.excecao ? ' (exceção)' : ''}`}>
                            {filterEmployee
                              ? (isFolga ? 'Folga' : `${formatTime(d.hora_entrada)}–${formatTime(d.hora_saida)}`)
                              : emp.nome.split(' ')[0]}
                            {d.excecao ? ' *' : ''}
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

      {/* ── Lista ────────────────────────────────────────────────────────── */}
      {view === 'lista' && (
        <div className="rounded-xl border overflow-x-auto"
          style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
          <table className="w-full min-w-[680px] text-sm">
            <thead style={{ backgroundColor: 'var(--color-bg-surface)' }}>
              <tr>
                {['Funcionário','Data','Dia','Entrada','Almoço','Saída',''].map((h, i) => (
                  <th key={i} className={`${i < 6 ? 'text-left' : ''} px-4 py-3 font-medium`}
                    style={{ color: 'var(--color-text-secondary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {listaRows.length === 0 && (
                <tr><td colSpan={7} className="text-center py-10" style={{ color: 'var(--color-text-muted)' }}>
                  Nenhum dia de trabalho em {MESES[mes - 1]} {ano}.
                </td></tr>
              )}
              {listaRows.map(({ emp, day }, idx) => {
                const [y, m, d] = day.date.split('-')
                const dow = DIAS_SEMANA[new Date(day.date + 'T00:00:00').getDay()]
                return (
                  <tr key={`${emp.id}-${day.date}`} className="border-t"
                    style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: idx % 2 === 0 ? 'white' : '#FAFAFA' }}>
                    <td className="px-4 py-2.5 font-medium text-xs" style={{ color: 'var(--color-text-primary)' }}>
                      {emp.nome}
                      {day.excecao && <span style={{ fontSize: '0.65rem', marginLeft: 4, color: 'var(--color-text-muted)' }}>(exc.)</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{`${d}/${m}/${y}`}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{dow}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{formatTime(day.hora_entrada) || '—'}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      {day.hora_almoco_inicio && day.hora_almoco_fim
                        ? `${formatTime(day.hora_almoco_inicio)}–${formatTime(day.hora_almoco_fim)}`
                        : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{formatTime(day.hora_saida) || '—'}</td>
                    <td className="px-4 py-2.5">
                      <button onClick={() => openExcecao(day.date, emp.id)}
                        className="text-xs px-2 py-1 rounded hover:bg-gray-50"
                        style={{ color: 'var(--color-text-muted)' }}>
                        Exceção
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Regras ───────────────────────────────────────────────────────── */}
      {view === 'regras' && (
        <div className="rounded-xl border overflow-x-auto"
          style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
          <table className="w-full min-w-[700px] text-sm">
            <thead style={{ backgroundColor: 'var(--color-bg-surface)' }}>
              <tr>
                {['Funcionário','Tipo','Início','Fim','Horário','Folgas fixas',''].map((h, i) => (
                  <th key={i} className={`${i < 6 ? 'text-left' : ''} px-4 py-3 font-medium`}
                    style={{ color: 'var(--color-text-secondary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRules.length === 0 && (
                <tr><td colSpan={7} className="text-center py-10" style={{ color: 'var(--color-text-muted)' }}>
                  Nenhuma regra cadastrada. Clique em "Adicionar" para começar.
                </td></tr>
              )}
              {filteredRules.map((rule, idx) => {
                const emp = employees.find(e => e.id === rule.employee_id)
                const DIAS_L = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
                const folgasLabel = rule.tipo_escala === 'ciclo'
                  ? `Ciclo ${rule.ciclo_trabalho_dias ?? '?'}+${rule.ciclo_folga_dias ?? '?'} (ref: ${rule.data_referencia ?? '—'})`
                  : rule.dias_folga.length > 0
                    ? rule.dias_folga.map(d => DIAS_L[d]).join(', ')
                    : 'Sem folga fixa'
                const fmtDate = (s: string) => { const [y, m, d] = s.split('-'); return `${d}/${m}/${y}` }

                return (
                  <tr key={rule.id} className="border-t"
                    style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: idx % 2 === 0 ? 'white' : '#FAFAFA' }}>
                    <td className="px-4 py-2.5 font-medium text-xs" style={{ color: 'var(--color-text-primary)' }}>{emp?.nome ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <span style={{ padding: '0.15rem 0.5rem', borderRadius: 999, fontSize: '0.7rem', fontWeight: 600,
                        backgroundColor: rule.tipo_escala === 'ciclo' ? '#F4ECF7' : '#EBF5FB',
                        color: rule.tipo_escala === 'ciclo' ? '#8E44AD' : '#2471A3' }}>
                        {rule.tipo_escala === 'ciclo' ? 'Ciclo' : 'Semanal'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{fmtDate(rule.data_inicio)}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      {rule.data_fim ? fmtDate(rule.data_fim) : <span style={{ color: 'var(--color-text-muted)' }}>Indefinido</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      {formatTime(rule.hora_entrada)}–{formatTime(rule.hora_saida)}
                      {rule.hora_almoco_inicio && (
                        <span style={{ color: 'var(--color-text-muted)', marginLeft: 4, fontSize: '0.65rem' }}>
                          alm {formatTime(rule.hora_almoco_inicio)}–{formatTime(rule.hora_almoco_fim)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{folgasLabel}</td>
                    <td className="px-4 py-2.5">
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
