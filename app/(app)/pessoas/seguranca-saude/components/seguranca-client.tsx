'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ModalSeguranca } from './modal-seguranca'
import { deleteHealthSafetyAction } from '../actions'
import type { HealthSafetyRecord, EmployeeForSS } from '../queries'

interface Props {
  records: HealthSafetyRecord[]
  employees: EmployeeForSS[]
  companyId: string
}

const TIPO_CONFIG: Record<string, { label: string; icon: string; bg: string; text: string }> = {
  aso:        { label: 'ASO',          icon: '🩺', bg: '#EBF5FB', text: '#2471A3' },
  treinamento:{ label: 'Treinamento',  icon: '📚', bg: '#E9F7EF', text: '#1E8449' },
  epi:        { label: 'EPI',          icon: '🦺', bg: '#FEF9E7', text: '#D4AC0D' },
  incidente:  { label: 'Incidente',    icon: '⚠️', bg: '#FDEDEC', text: '#C0392B' },
  vacina:     { label: 'Vacinação',    icon: '💉', bg: '#F4ECF7', text: '#8E44AD' },
}

const RESULTADO_LABELS: Record<string, string> = {
  apto: 'Apto',
  apto_com_restricoes: 'Apto c/ restrições',
  inapto: 'Inapto',
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
}

function isExpiring(d: string | null) {
  if (!d) return false
  const diff = new Date(d).getTime() - Date.now()
  return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000
}

function isExpired(d: string | null) {
  if (!d) return false
  return new Date(d).getTime() < Date.now()
}

export function SegurancaClient({ records, employees, companyId }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<HealthSafetyRecord | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [filterTipo, setFilterTipo] = useState('')
  const [search, setSearch] = useState('')

  const filtered = records.filter(r => {
    const matchTipo = filterTipo ? r.tipo === filterTipo : true
    const q = search.toLowerCase()
    const matchSearch = q
      ? r.titulo.toLowerCase().includes(q) || (r.employee?.nome ?? '').toLowerCase().includes(q)
      : true
    return matchTipo && matchSearch
  })

  const vencendoBreve = records.filter(r => isExpiring(r.data_vencimento)).length
  const vencidos = records.filter(r => isExpired(r.data_vencimento)).length

  function openAdd() { setEditingRecord(null); setModalOpen(true) }
  function openEdit(r: HealthSafetyRecord) { setEditingRecord(r); setModalOpen(true) }

  async function handleDelete(r: HealthSafetyRecord) {
    if (!confirm(`Excluir o registro "${r.titulo}"?`)) return
    setDeletingId(r.id)
    const result = await deleteHealthSafetyAction(r.id)
    setDeletingId(null)
    if ('error' in result) alert(result.error)
    else router.refresh()
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
            Segurança e Saúde
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            ASO, treinamentos, EPIs, incidentes e vacinações
          </p>
        </div>
        <Button onClick={openAdd}>+ Novo registro</Button>
      </div>

      {/* Alertas */}
      {(vencendoBreve > 0 || vencidos > 0) && (
        <div className="mb-4 space-y-2">
          {vencidos > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm" style={{ backgroundColor: '#FDEDEC', color: '#C0392B' }}>
              ⚠️ {vencidos} registro{vencidos > 1 ? 's' : ''} com vencimento expirado
            </div>
          )}
          {vencendoBreve > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm" style={{ backgroundColor: '#FEF9E7', color: '#D4AC0D' }}>
              🔔 {vencendoBreve} registro{vencendoBreve > 1 ? 's' : ''} vencendo nos próximos 30 dias
            </div>
          )}
        </div>
      )}

      {/* Filtro por tipo */}
      <div className="flex gap-2 flex-wrap mb-4">
        <button
          onClick={() => setFilterTipo('')}
          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          style={{
            backgroundColor: filterTipo === '' ? 'var(--color-primary)' : 'white',
            color: filterTipo === '' ? 'var(--color-primary-darker)' : 'var(--color-text-secondary)',
            border: `1px solid ${filterTipo === '' ? 'transparent' : 'var(--color-bg-surface)'}`,
          }}
        >
          Todos ({records.length})
        </button>
        {Object.entries(TIPO_CONFIG).map(([key, cfg]) => {
          const count = records.filter(r => r.tipo === key).length
          if (count === 0) return null
          const isActive = filterTipo === key
          return (
            <button
              key={key}
              onClick={() => setFilterTipo(isActive ? '' : key)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                backgroundColor: isActive ? cfg.bg : 'white',
                color: isActive ? cfg.text : 'var(--color-text-secondary)',
                border: `1px solid ${isActive ? cfg.text : 'var(--color-bg-surface)'}`,
              }}
            >
              {cfg.icon} {cfg.label} ({count})
            </button>
          )
        })}
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar por título ou funcionário..."
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
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Tipo</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Título</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Funcionário</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Data</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Vencimento</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Resultado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-10" style={{ color: 'var(--color-text-muted)' }}>
                  {search || filterTipo ? 'Nenhum resultado.' : 'Nenhum registro cadastrado.'}
                </td>
              </tr>
            )}
            {filtered.map(r => {
              const cfg = TIPO_CONFIG[r.tipo]
              const expired = isExpired(r.data_vencimento)
              const expiring = isExpiring(r.data_vencimento)
              return (
                <tr key={r.id} className="border-t" style={{ borderColor: 'var(--color-bg-surface)' }}>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ backgroundColor: cfg.bg, color: cfg.text }}>
                      {cfg.icon} {cfg.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {r.titulo}
                    {r.observacao && <div className="text-xs font-normal truncate max-w-xs" style={{ color: 'var(--color-text-muted)' }}>{r.observacao}</div>}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>
                    {r.employee?.nome ?? <span style={{ color: 'var(--color-text-muted)' }}>Empresa</span>}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>{formatDate(r.data)}</td>
                  <td className="px-4 py-3">
                    <span style={{ color: expired ? '#C0392B' : expiring ? '#D4AC0D' : 'var(--color-text-secondary)' }}>
                      {expired && '⚠️ '}{expiring && !expired && '🔔 '}
                      {formatDate(r.data_vencimento)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {r.resultado ? RESULTADO_LABELS[r.resultado] ?? r.resultado : '—'}
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

      <ModalSeguranca
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        companyId={companyId}
        record={editingRecord}
        employees={employees}
      />
    </>
  )
}
