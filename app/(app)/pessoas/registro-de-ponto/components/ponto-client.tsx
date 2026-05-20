'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ModalPonto } from './modal-ponto'
import { deleteTimeRecordAction } from '../actions'
import type { TimeRecord } from '../queries'

interface Props {
  records: TimeRecord[]
  employees: { id: string; nome: string; cargo: string | null }[]
  companyId: string
  mes: number
  ano: number
}

const TIPO_LABELS: Record<string, string> = {
  normal: 'Normal',
  extra: 'Extra',
  folga: 'Folga',
  ferias: 'Férias',
  falta: 'Falta',
}

const TIPO_COLORS: Record<string, { bg: string; text: string }> = {
  normal:  { bg: '#EAF4F4', text: '#17A589' },
  extra:   { bg: '#EBF5FB', text: '#2471A3' },
  folga:   { bg: '#F4ECF7', text: '#8E44AD' },
  ferias:  { bg: '#E9F7EF', text: '#1E8449' },
  falta:   { bg: '#FDEDEC', text: '#C0392B' },
}

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function formatTime(ts: string | null) {
  if (!ts) return '—'
  const d = new Date(ts)
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

function formatInterval(interval: string | null) {
  if (!interval) return '—'
  // Postgres interval format: "HH:MM:SS" or "X days HH:MM:SS"
  const match = interval.match(/(\d+):(\d+)/)
  if (!match) return interval
  return `${match[1]}h ${match[2]}min`
}

export function PontoClient({ records, employees, companyId, mes, ano }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<TimeRecord | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [filterEmployee, setFilterEmployee] = useState('')

  const filtered = filterEmployee
    ? records.filter(r => r.employee_id === filterEmployee)
    : records

  function navMes(delta: number) {
    let m = mes + delta
    let a = ano
    if (m < 1) { m = 12; a-- }
    if (m > 12) { m = 1; a++ }
    router.push(`/pessoas/registro-de-ponto?mes=${m}&ano=${a}`)
  }

  function openAdd() { setEditingRecord(null); setModalOpen(true) }
  function openEdit(r: TimeRecord) { setEditingRecord(r); setModalOpen(true) }

  async function handleDelete(r: TimeRecord) {
    if (!confirm('Excluir este registro de ponto?')) return
    setDeletingId(r.id)
    setDeleteError('')
    const result = await deleteTimeRecordAction(r.id)
    setDeletingId(null)
    if ('error' in result) setDeleteError(result.error ?? 'Erro ao excluir.')
    else router.refresh()
  }

  // Totalizador do mês
  const totalHorasTrabalhadas = records.filter(r => r.tipo !== 'falta' && r.tipo !== 'folga').length
  const totalFaltas = records.filter(r => r.tipo === 'falta').length
  const totalFerias = records.filter(r => r.tipo === 'ferias').length

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
            Registro de Ponto
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Controle de entrada e saída dos colaboradores
          </p>
        </div>
        <Button onClick={openAdd}>+ Novo registro</Button>
      </div>

      {/* Navegação de mês */}
      <div className="flex items-center justify-between mb-4 p-3 rounded-xl border" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
        <button
          onClick={() => navMes(-1)}
          className="px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50 transition-colors"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          ← Anterior
        </button>
        <span className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>
          {MESES[mes - 1]} {ano}
        </span>
        <button
          onClick={() => navMes(1)}
          className="px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50 transition-colors"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Próximo →
        </button>
      </div>

      {/* Métricas rápidas */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: 'Dias registrados', value: totalHorasTrabalhadas },
          { label: 'Faltas', value: totalFaltas },
          { label: 'Férias', value: totalFerias },
        ].map(m => (
          <div key={m.label} className="p-3 rounded-xl border text-center" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
            <div className="text-2xl font-bold" style={{ color: 'var(--color-primary-darker)' }}>{m.value}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{m.label}</div>
          </div>
        ))}
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

      {deleteError && (
        <p className="text-sm mb-4 p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>{deleteError}</p>
      )}

      <div className="rounded-xl border overflow-x-auto" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
        <table className="w-full min-w-[700px] text-sm">
          <thead style={{ backgroundColor: 'var(--color-bg-surface)' }}>
            <tr>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Funcionário</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Data</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Entrada</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Saída</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Horas</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Tipo</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-10" style={{ color: 'var(--color-text-muted)' }}>
                  Nenhum registro para {MESES[mes - 1]} {ano}.
                </td>
              </tr>
            )}
            {filtered.map((r) => {
              const colors = TIPO_COLORS[r.tipo] ?? TIPO_COLORS.normal
              return (
                <tr key={r.id} className="border-t" style={{ borderColor: 'var(--color-bg-surface)' }}>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    <div>{r.employee.nome}</div>
                    {r.employee.cargo && (
                      <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{r.employee.cargo}</div>
                    )}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>{formatDate(r.data)}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>{formatTime(r.entrada)}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>{formatTime(r.saida)}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>{formatInterval(r.horas_trabalhadas)}</td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ backgroundColor: colors.bg, color: colors.text }}
                    >
                      {TIPO_LABELS[r.tipo] ?? r.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>Editar</Button>
                      <Button
                        variant="danger"
                        size="sm"
                        loading={deletingId === r.id}
                        onClick={() => handleDelete(r)}
                      >
                        Excluir
                      </Button>
                    </div>
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
        defaultMes={mes}
        defaultAno={ano}
      />
    </>
  )
}
