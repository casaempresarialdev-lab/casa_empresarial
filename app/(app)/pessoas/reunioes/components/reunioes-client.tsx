'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ModalReuniao } from './modal-reuniao'
import { deleteMeetingAction } from '../actions'
import type { Meeting } from '../queries'

interface Props {
  meetings: Meeting[]
  companyId: string
}

const STATUS_LABELS: Record<string, string> = {
  agendada: 'Agendada',
  realizada: 'Realizada',
  cancelada: 'Cancelada',
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  agendada:  { bg: '#EBF5FB', text: '#2471A3' },
  realizada: { bg: '#E9F7EF', text: '#1E8449' },
  cancelada: { bg: '#FDEDEC', text: '#C0392B' },
}

function formatDateTime(ts: string | null) {
  if (!ts) return '—'
  const d = new Date(ts)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatDuracao(min: number | null) {
  if (!min) return '—'
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h ${m}min` : `${h}h`
}

export function ReunioesClient({ meetings, companyId }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [search, setSearch] = useState('')

  const filtered = meetings.filter(m => {
    const matchStatus = filterStatus ? m.status === filterStatus : true
    const q = search.toLowerCase()
    const matchSearch = q
      ? m.titulo.toLowerCase().includes(q) || (m.local ?? '').toLowerCase().includes(q)
      : true
    return matchStatus && matchSearch
  })

  function openAdd() { setEditingMeeting(null); setModalOpen(true) }
  function openEdit(m: Meeting) { setEditingMeeting(m); setModalOpen(true) }

  async function handleDelete(m: Meeting) {
    if (!confirm(`Excluir a reunião "${m.titulo}"?`)) return
    setDeletingId(m.id)
    const result = await deleteMeetingAction(m.id)
    setDeletingId(null)
    if ('error' in result) alert(result.error)
    else router.refresh()
  }

  const counts = {
    agendada: meetings.filter(m => m.status === 'agendada').length,
    realizada: meetings.filter(m => m.status === 'realizada').length,
    cancelada: meetings.filter(m => m.status === 'cancelada').length,
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
            Reuniões
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Agendamento e atas de reuniões da equipe
          </p>
        </div>
        <Button onClick={openAdd}>+ Nova reunião</Button>
      </div>

      {/* Cards de totais */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {(['agendada', 'realizada', 'cancelada'] as const).map(s => {
          const colors = STATUS_COLORS[s]
          const isActive = filterStatus === s
          return (
            <button
              key={s}
              onClick={() => setFilterStatus(isActive ? '' : s)}
              className="p-3 rounded-xl border text-center transition-all"
              style={{
                borderColor: isActive ? colors.text : 'var(--color-bg-surface)',
                backgroundColor: isActive ? colors.bg : 'white',
              }}
            >
              <div className="text-2xl font-bold" style={{ color: colors.text }}>{counts[s]}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{STATUS_LABELS[s]}</div>
            </button>
          )
        })}
      </div>

      {/* Busca */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar por título ou local..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-4 py-2 rounded-lg border text-sm"
          style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white', color: 'var(--color-text-primary)' }}
        />
      </div>

      <div className="rounded-xl border overflow-x-auto" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
        <table className="w-full min-w-[700px] text-sm">
          <thead style={{ backgroundColor: 'var(--color-bg-surface)' }}>
            <tr>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Título</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Data / Hora</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Duração</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Participantes</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-10" style={{ color: 'var(--color-text-muted)' }}>
                  {search || filterStatus ? 'Nenhum resultado encontrado.' : 'Nenhuma reunião cadastrada.'}
                </td>
              </tr>
            )}
            {filtered.map(m => {
              const colors = STATUS_COLORS[m.status]
              return (
                <tr key={m.id} className="border-t" style={{ borderColor: 'var(--color-bg-surface)' }}>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-primary)' }}>
                    <div className="font-medium">{m.titulo}</div>
                    {m.local && <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>📍 {m.local}</div>}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>{formatDateTime(m.data)}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>{formatDuracao(m.duracao_min)}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>
                    {m.participantes.length > 0
                      ? `${m.participantes.length} pessoa${m.participantes.length > 1 ? 's' : ''}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ backgroundColor: colors.bg, color: colors.text }}
                    >
                      {STATUS_LABELS[m.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(m)}>Editar</Button>
                      <Button
                        variant="danger"
                        size="sm"
                        loading={deletingId === m.id}
                        onClick={() => handleDelete(m)}
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

      <ModalReuniao
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        companyId={companyId}
        meeting={editingMeeting}
      />
    </>
  )
}
