'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ModalEscala } from './modal-escala'
import { ModalEscalaMes } from './modal-escala-mes'
import { deleteScheduleAction } from '../actions'
import type { WorkSchedule } from '../queries'

interface Props {
  schedules: WorkSchedule[]
  employees: { id: string; nome: string; cargo: string | null }[]
  companyId: string
  mes: number
  ano: number
}

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

const TURNO_COLORS: Record<string, { bg: string; text: string }> = {
  manha:  { bg: '#FEF9E7', text: '#D4AC0D' },
  tarde:  { bg: '#EBF5FB', text: '#2471A3' },
  noite:  { bg: '#F4ECF7', text: '#8E44AD' },
  custom: { bg: '#EAF4F4', text: '#17A589' },
}

const TURNO_LABELS: Record<string, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
  custom: 'Personalizado',
}

function formatTime(t: string | null) {
  if (!t) return ''
  return t.slice(0, 5)
}

function getDaysInMonth(ano: number, mes: number) {
  return new Date(ano, mes, 0).getDate()
}

function getFirstDayOfWeek(ano: number, mes: number) {
  return new Date(ano, mes - 1, 1).getDay()
}

export function EscalaClient({ schedules, employees, companyId, mes, ano }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMesOpen, setModalMesOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<WorkSchedule | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [filterEmployee, setFilterEmployee] = useState('')
  const [view, setView] = useState<'calendario' | 'lista'>('calendario')
  const [preselectedDate, setPreselectedDate] = useState('')

  function navMes(delta: number) {
    let m = mes + delta
    let a = ano
    if (m < 1) { m = 12; a-- }
    if (m > 12) { m = 1; a++ }
    router.push(`/pessoas/escala-de-trabalho?mes=${m}&ano=${a}`)
  }

  function openAdd(date?: string) {
    setEditingSchedule(null)
    setPreselectedDate(date ?? '')
    setModalOpen(true)
  }

  function openEdit(s: WorkSchedule) {
    setEditingSchedule(s)
    setPreselectedDate('')
    setModalOpen(true)
  }

  async function handleDelete(s: WorkSchedule) {
    if (!confirm(`Remover escala de ${s.employee.nome} em ${s.data}?`)) return
    setDeletingId(s.id)
    const result = await deleteScheduleAction(s.id)
    setDeletingId(null)
    if ('error' in result) alert(result.error)
    else router.refresh()
  }

  const filtered = filterEmployee
    ? schedules.filter(s => s.employee_id === filterEmployee)
    : schedules

  // Indexa escalas por data para o calendário
  const byDate: Record<string, WorkSchedule[]> = {}
  filtered.forEach(s => {
    if (!byDate[s.data]) byDate[s.data] = []
    byDate[s.data].push(s)
  })

  const totalDias = getDaysInMonth(ano, mes)
  const firstDay = getFirstDayOfWeek(ano, mes)
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: totalDias }, (_, i) => i + 1),
  ]
  // Pad para múltiplo de 7
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <>
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
          {/* Toggle visualização */}
          <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: 'var(--color-bg-surface)' }}>
            {(['calendario', 'lista'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  backgroundColor: view === v ? 'var(--color-primary)' : 'white',
                  color: view === v ? 'var(--color-primary-darker)' : 'var(--color-text-secondary)',
                }}
              >
                {v === 'calendario' ? '📅 Calendário' : '☰ Lista'}
              </button>
            ))}
          </div>
          <Button variant="ghost" onClick={() => setModalMesOpen(true)}>📅 Escala do mês</Button>
          <Button onClick={() => openAdd()}>+ Novo turno</Button>
        </div>
      </div>

      {/* Navegação de mês */}
      <div className="flex items-center justify-between mb-4 p-3 rounded-xl border" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
        <button onClick={() => navMes(-1)} className="px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50 transition-colors" style={{ color: 'var(--color-text-secondary)' }}>
          ← Anterior
        </button>
        <span className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>
          {MESES[mes - 1]} {ano}
        </span>
        <button onClick={() => navMes(1)} className="px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50 transition-colors" style={{ color: 'var(--color-text-secondary)' }}>
          Próximo →
        </button>
      </div>

      {/* Filtro por funcionário */}
      <div className="mb-4">
        <select
          value={filterEmployee}
          onChange={e => setFilterEmployee(e.target.value)}
          className="w-full px-4 py-2 rounded-lg border text-sm"
          style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white', color: 'var(--color-text-primary)' }}
        >
          <option value="">Todos os funcionários</option>
          {employees.map(e => (
            <option key={e.id} value={e.id}>{e.nome}</option>
          ))}
        </select>
      </div>

      {/* View: Calendário */}
      {view === 'calendario' && (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
          {/* Cabeçalho dias da semana */}
          <div className="grid grid-cols-7 border-b" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'var(--color-bg-surface)' }}>
            {DIAS_SEMANA.map(d => (
              <div key={d} className="text-center py-2 text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>{d}</div>
            ))}
          </div>
          {/* Células */}
          <div className="grid grid-cols-7">
            {cells.map((day, idx) => {
              const dateStr = day
                ? `${ano}-${String(mes).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                : ''
              const daySchedules = dateStr ? (byDate[dateStr] ?? []) : []
              const isToday = dateStr === new Date().toISOString().slice(0, 10)

              return (
                <div
                  key={idx}
                  className="min-h-[80px] border-r border-b p-1"
                  style={{
                    borderColor: 'var(--color-bg-surface)',
                    backgroundColor: day ? 'white' : '#FAFAFA',
                  }}
                >
                  {day && (
                    <>
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className="text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full"
                          style={{
                            backgroundColor: isToday ? 'var(--color-primary-dark)' : 'transparent',
                            color: isToday ? 'white' : 'var(--color-text-secondary)',
                          }}
                        >
                          {day}
                        </span>
                        <button
                          onClick={() => openAdd(dateStr)}
                          className="text-xs text-gray-300 hover:text-gray-500 leading-none"
                          title="Adicionar turno"
                        >
                          +
                        </button>
                      </div>
                      {daySchedules.map(s => {
                        const colors = TURNO_COLORS[s.turno ?? 'custom'] ?? TURNO_COLORS.custom
                        return (
                          <button
                            key={s.id}
                            onClick={() => openEdit(s)}
                            className="w-full text-left mb-0.5 px-1.5 py-0.5 rounded text-xs truncate"
                            style={{ backgroundColor: colors.bg, color: colors.text }}
                            title={`${s.employee.nome} — ${TURNO_LABELS[s.turno ?? ''] ?? s.turno}`}
                          >
                            {s.employee.nome.split(' ')[0]}
                            {s.hora_inicio ? ` ${formatTime(s.hora_inicio)}` : ''}
                          </button>
                        )
                      })}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* View: Lista */}
      {view === 'lista' && (
        <div className="rounded-xl border overflow-x-auto" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
          <table className="w-full min-w-[600px] text-sm">
            <thead style={{ backgroundColor: 'var(--color-bg-surface)' }}>
              <tr>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Funcionário</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Data</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Turno</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Horário</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-10" style={{ color: 'var(--color-text-muted)' }}>
                    Nenhuma escala para {MESES[mes - 1]} {ano}.
                  </td>
                </tr>
              )}
              {filtered.map(s => {
                const colors = TURNO_COLORS[s.turno ?? 'custom'] ?? TURNO_COLORS.custom
                const [y, m, d] = s.data.split('-')
                return (
                  <tr key={s.id} className="border-t" style={{ borderColor: 'var(--color-bg-surface)' }}>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text-primary)' }}>{s.employee.nome}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>{`${d}/${m}/${y}`}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: colors.bg, color: colors.text }}>
                        {TURNO_LABELS[s.turno ?? ''] ?? s.turno ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>
                      {s.hora_inicio && s.hora_fim
                        ? `${formatTime(s.hora_inicio)} – ${formatTime(s.hora_fim)}`
                        : s.hora_inicio ? formatTime(s.hora_inicio) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>Editar</Button>
                        <Button variant="danger" size="sm" loading={deletingId === s.id} onClick={() => handleDelete(s)}>Excluir</Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <ModalEscala
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        companyId={companyId}
        schedule={editingSchedule}
        employees={employees}
        defaultDate={preselectedDate}
      />

      <ModalEscalaMes
        open={modalMesOpen}
        onClose={() => setModalMesOpen(false)}
        companyId={companyId}
        mes={mes}
        ano={ano}
        employees={employees}
      />
    </>
  )
}
