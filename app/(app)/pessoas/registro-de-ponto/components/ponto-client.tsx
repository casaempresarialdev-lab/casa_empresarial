'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
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

  if (!record || !record.entrada) {
    if (isFuture) return { label: 'Previsto',   color: '#2471A3', bg: '#EBF5FB', status: 'previsto'   }
    if (isToday)  return { label: 'Aguardando', color: '#7F8C8D', bg: '#F2F3F4', status: 'aguardando' }
    return { label: 'Ausente', color: '#C0392B', bg: '#FDEDEC', status: 'ausente' }
  }

  if (!record.saida) {
    if (isToday) return { label: 'Em andamento', color: '#D35400', bg: '#FDEBD0', status: 'em_andamento' }
    return { label: 'Sem saída', color: '#E67E22', bg: '#FDEBD0', status: 'incompleto' }
  }

  if (record.tipo === 'folga') return { label: 'Folga não prevista', color: '#8E44AD', bg: '#F4ECF7', status: 'folga_extra' }

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

function getPrevistoLabel(dayResult: DayResult | null): string {
  if (!dayResult || dayResult.tipo === 'sem_regra') return '—'
  if (dayResult.tipo === 'folga') return 'Folga'
  const h = dayResult.hora_entrada?.slice(0, 5) ?? '?'
  const s = dayResult.hora_saida?.slice(0, 5) ?? '?'
  return `${h}–${s}`
}

const SKIP_METRICS = new Set<Status>(['folga', 'folga_extra', 'sem_escala', 'ferias', 'aguardando'])

// ─── ExportMenu ───────────────────────────────────────────────────────────────

function ExportMenu({ onPDF, onExcel }: { onPDF: () => void; onExcel: () => void }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos]   = useState({ top: 0, right: 0 })
  const btnRef  = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      const t = e.target as Node
      if (!btnRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  function handleOpen() {
    const rect = btnRef.current?.getBoundingClientRect()
    if (rect) {
      const openUp = rect.bottom + 88 > window.innerHeight - 8
      setPos(openUp
        ? { top: rect.top - 88, right: window.innerWidth - rect.right }
        : { top: rect.bottom + 4, right: window.innerWidth - rect.right }
      )
    }
    setOpen(v => !v)
  }

  return (
    <div style={{ position: 'relative' }}>
      <button ref={btnRef} onClick={handleOpen}
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors hover:bg-gray-50"
        style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-secondary)', backgroundColor: 'white' }}>
        Baixar ▾
      </button>
      {open && (
        <div ref={menuRef} style={{
          position: 'fixed', top: pos.top, right: pos.right, zIndex: 50, minWidth: 130,
          backgroundColor: 'white', border: '1px solid var(--color-bg-surface)',
          borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: '4px 0',
        }}>
          <button onClick={() => { setOpen(false); onPDF() }}
            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
            style={{ color: 'var(--color-text-primary)' }}>
            PDF
          </button>
          <button onClick={() => { setOpen(false); onExcel() }}
            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
            style={{ color: 'var(--color-text-primary)' }}>
            Excel
          </button>
        </div>
      )}
    </div>
  )
}

// ─── RowMenu ──────────────────────────────────────────────────────────────────

function RowMenu({ entry, onEdit, onDetail, onDelete, deletingId }: {
  entry: DayEntry
  onEdit: () => void
  onDetail: () => void
  onDelete: () => void
  deletingId: string | null
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos]   = useState({ top: 0, right: 0 })
  const btnRef  = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      const t = e.target as Node
      if (!btnRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  function handleOpen() {
    const rect = btnRef.current?.getBoundingClientRect()
    if (rect) {
      const menuH = entry.record ? 122 : 44
      const openUp = rect.bottom + menuH > window.innerHeight - 8
      setPos(openUp
        ? { top: rect.top - menuH - 4, right: window.innerWidth - rect.right }
        : { top: rect.bottom + 4, right: window.innerWidth - rect.right }
      )
    }
    setOpen(v => !v)
  }

  return (
    <div style={{ position: 'relative' }}>
      <button ref={btnRef} onClick={handleOpen}
        className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
        style={{ color: 'var(--color-text-secondary)', fontSize: '1.1rem', letterSpacing: 1 }}>
        ···
      </button>
      {open && (
        <div ref={menuRef} style={{
          position: 'fixed', top: pos.top, right: pos.right, zIndex: 50, minWidth: 140,
          backgroundColor: 'white', border: '1px solid var(--color-bg-surface)',
          borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: '4px 0',
        }}>
          <button onClick={() => { setOpen(false); onEdit() }}
            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
            style={{ color: 'var(--color-text-primary)' }}>
            Editar
          </button>
          {entry.record && (
            <>
              <button onClick={() => { setOpen(false); onDetail() }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                style={{ color: 'var(--color-text-primary)' }}>
                Detalhar
              </button>
              <button onClick={() => { setOpen(false); onDelete() }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                style={{ color: '#E74C3C' }}>
                {deletingId === entry.record?.id ? 'Excluindo…' : 'Excluir'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── ModalDetalhar ────────────────────────────────────────────────────────────

function ModalDetalhar({ entry, onClose }: { entry: DayEntry; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, backgroundColor: 'rgba(0,0,0,0.4)' }}
      className="flex items-center justify-center p-4">
      <div className="rounded-2xl shadow-xl w-full max-w-md" style={{ backgroundColor: 'white' }}>

        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b"
          style={{ borderColor: 'var(--color-bg-surface)' }}>
          <h2 className="text-base font-semibold"
            style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
            Detalhes do Registro
          </h2>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-sm"
            style={{ color: 'var(--color-text-muted)' }}>✕</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <div className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Funcionário</div>
            <div className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{entry.empNome}</div>
            {entry.empCargo && (
              <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{entry.empCargo}</div>
            )}
          </div>

          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Data</div>
              <div className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {formatDate(entry.date)} · <span className="capitalize">{formatWeekday(entry.date)}</span>
              </div>
            </div>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: entry.sit.bg, color: entry.sit.color }}>
              {entry.sit.label}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
              <div className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Previsto</div>
              <div className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {getPrevistoLabel(entry.dayResult)}
              </div>
            </div>
            <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
              <div className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Horas trabalhadas</div>
              <div className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {formatInterval(entry.record?.horas_trabalhadas ?? null)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
              <div className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Entrada</div>
              <div className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {formatTime(entry.record?.entrada ?? null)}
              </div>
            </div>
            <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
              <div className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Saída</div>
              <div className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {formatTime(entry.record?.saida ?? null)}
              </div>
            </div>
          </div>

          {(entry.record?.saida_almoco || entry.record?.retorno_almoco) && (
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
                <div className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Saída almoço</div>
                <div className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  {formatTime(entry.record?.saida_almoco ?? null)}
                </div>
              </div>
              <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
                <div className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Retorno almoço</div>
                <div className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  {formatTime(entry.record?.retorno_almoco ?? null)}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 pb-5">
          <Button onClick={onClose} className="w-full">Fechar</Button>
        </div>
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PontoClient({ records, employees, rules, exceptions, companyId, mes, ano }: Props) {
  const router = useRouter()

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
  const [detailEntry,    setDetailEntry]   = useState<DayEntry | null>(null)

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
          if (!hasSchedule && !record) continue
        } else {
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

  async function handleDelete(entry: DayEntry) {
    if (!entry.record) return
    if (!confirm('Excluir este registro de ponto?')) return
    setDeletingId(entry.record.id); setDeleteError('')
    const result = await deleteTimeRecordAction(entry.record.id)
    setDeletingId(null)
    if ('error' in result) setDeleteError(result.error ?? 'Erro ao excluir.')
    else router.refresh()
  }

  async function handleExportPDF() {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFontSize(14)
    doc.text(`Registro de Ponto — ${MESES[mes - 1]} ${ano}`, 14, 16)

    const hasFuncCol = !filterEmployee
    const headers = [
      ...(hasFuncCol ? ['Funcionário'] : []),
      'Data', 'Previsto', 'Entrada', 'Almoço', 'Saída', 'Horas', 'Situação',
    ]
    const rows = dayEntries.map(e => [
      ...(hasFuncCol ? [e.empNome] : []),
      `${formatDate(e.date)} ${formatWeekday(e.date)}`,
      getPrevistoLabel(e.dayResult),
      e.record?.entrada ? formatTime(e.record.entrada) : '—',
      e.record?.saida_almoco
        ? `${formatTime(e.record.saida_almoco)}–${formatTime(e.record.retorno_almoco)}`
        : '—',
      e.record?.saida ? formatTime(e.record.saida) : '—',
      formatInterval(e.record?.horas_trabalhadas ?? null),
      e.sit.label,
    ])

    const colW = hasFuncCol ? [44, 30, 24, 22, 36, 22, 20, 28] : [30, 24, 22, 36, 22, 20, 28]
    const rowH = 7
    let y = 24
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    let x = 10
    headers.forEach((h, i) => { doc.text(h, x + 2, y + 5); x += colW[i] })
    y += rowH
    doc.setFont('helvetica', 'normal')
    rows.forEach(row => {
      if (y > 190) { doc.addPage(); y = 14 }
      x = 10
      row.forEach((cell, i) => {
        doc.text(String(cell).slice(0, 24), x + 2, y + 5)
        x += colW[i]
      })
      y += rowH
    })
    doc.save(`registro-ponto-${mes}-${ano}.pdf`)
  }

  async function handleExportExcel() {
    const XLSX = await import('xlsx')
    const hasFuncCol = !filterEmployee
    const headers = [
      ...(hasFuncCol ? ['Funcionário'] : []),
      'Data', 'Dia', 'Previsto', 'Entrada', 'Almoço', 'Saída', 'Horas', 'Situação',
    ]
    const rows = dayEntries.map(e => [
      ...(hasFuncCol ? [e.empNome] : []),
      formatDate(e.date),
      formatWeekday(e.date),
      getPrevistoLabel(e.dayResult),
      e.record?.entrada ? formatTime(e.record.entrada) : '',
      e.record?.saida_almoco
        ? `${formatTime(e.record.saida_almoco)}–${formatTime(e.record.retorno_almoco)}`
        : '',
      e.record?.saida ? formatTime(e.record.saida) : '',
      formatInterval(e.record?.horas_trabalhadas ?? null),
      e.sit.label,
    ])
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Ponto')
    XLSX.writeFile(wb, `registro-ponto-${mes}-${ano}.xlsx`)
  }

  const isSingleEmp = !!filterEmployee

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

          <ExportMenu onPDF={handleExportPDF} onExcel={handleExportExcel} />

          <Button onClick={() => window.open('https://casa-empresarial.vercel.app/registrar-ponto', '_blank')}>
            Registro de Ponto
          </Button>
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

      {/* ── Lista ── */}
      <div className="rounded-xl border overflow-x-auto" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
        <table className="w-full min-w-[820px] text-sm">
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
              <th className="w-10 px-2 py-3" />
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

                  <td className="px-2 py-2.5">
                    <RowMenu
                      entry={entry}
                      onEdit={() => {
                        if (entry.record) openEdit(entry.record)
                        else openFromCalendar(entry.date, entry.empId)
                      }}
                      onDetail={() => setDetailEntry(entry)}
                      onDelete={() => handleDelete(entry)}
                      deletingId={deletingId}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

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

      {detailEntry && (
        <ModalDetalhar entry={detailEntry} onClose={() => setDetailEntry(null)} />
      )}
    </>
  )
}
