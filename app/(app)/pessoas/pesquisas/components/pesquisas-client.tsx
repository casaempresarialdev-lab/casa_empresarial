'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ModalPesquisa } from './modal-pesquisa'
import { deleteSurveyAction } from '../actions'
import type { Survey } from '../queries'

interface Props {
  surveys: Survey[]
  companyId: string
}

const STATUS_CONFIG = {
  rascunho: { label: 'Rascunho', bg: '#F4F6F7', text: '#717D7E' },
  ativo:    { label: 'Ativa',    bg: '#E9F7EF', text: '#1E8449' },
  encerrado:{ label: 'Encerrada',bg: '#FDEDEC', text: '#C0392B' },
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
}

export function PesquisasClient({ surveys, companyId }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingSurvey, setEditingSurvey] = useState<Survey | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [search, setSearch] = useState('')

  const filtered = surveys.filter(s => {
    const matchStatus = filterStatus ? s.status === filterStatus : true
    const q = search.toLowerCase()
    const matchSearch = q ? s.titulo.toLowerCase().includes(q) : true
    return matchStatus && matchSearch
  })

  function openAdd() { setEditingSurvey(null); setModalOpen(true) }
  function openEdit(s: Survey) { setEditingSurvey(s); setModalOpen(true) }

  async function handleDelete(s: Survey) {
    if (!confirm(`Excluir a pesquisa "${s.titulo}"?`)) return
    setDeletingId(s.id)
    const result = await deleteSurveyAction(s.id)
    setDeletingId(null)
    if ('error' in result) alert(result.error)
    else router.refresh()
  }

  const counts = {
    rascunho: surveys.filter(s => s.status === 'rascunho').length,
    ativo: surveys.filter(s => s.status === 'ativo').length,
    encerrado: surveys.filter(s => s.status === 'encerrado').length,
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
            Pesquisas de Clima
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Pesquisas de satisfação e clima organizacional
          </p>
        </div>
        <Button onClick={openAdd}>+ Nova pesquisa</Button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        {(['rascunho', 'ativo', 'encerrado'] as const).map(s => {
          const cfg = STATUS_CONFIG[s]
          const isActive = filterStatus === s
          return (
            <button
              key={s}
              onClick={() => setFilterStatus(isActive ? '' : s)}
              className="p-3 rounded-xl border text-center transition-all"
              style={{ borderColor: isActive ? cfg.text : 'var(--color-bg-surface)', backgroundColor: isActive ? cfg.bg : 'white' }}
            >
              <div className="text-2xl font-bold" style={{ color: cfg.text }}>{counts[s]}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{cfg.label}</div>
            </button>
          )
        })}
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar por título..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-4 py-2 rounded-lg border text-sm"
          style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white', color: 'var(--color-text-primary)' }}
        />
      </div>

      <div className="rounded-xl border overflow-x-auto" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
        <table className="w-full min-w-[600px] text-sm">
          <thead style={{ backgroundColor: 'var(--color-bg-surface)' }}>
            <tr>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Título</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Perguntas</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Período</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-10" style={{ color: 'var(--color-text-muted)' }}>
                  {search || filterStatus ? 'Nenhum resultado.' : 'Nenhuma pesquisa cadastrada.'}
                </td>
              </tr>
            )}
            {filtered.map(s => {
              const cfg = STATUS_CONFIG[s.status]
              return (
                <tr key={s.id} className="border-t" style={{ borderColor: 'var(--color-bg-surface)' }}>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-primary)' }}>
                    <div className="font-medium">{s.titulo}</div>
                    {s.descricao && <div className="text-xs mt-0.5 truncate max-w-xs" style={{ color: 'var(--color-text-muted)' }}>{s.descricao}</div>}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>
                    {s.perguntas.length} {s.perguntas.length === 1 ? 'pergunta' : 'perguntas'}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {s.data_inicio || s.data_fim
                      ? `${formatDate(s.data_inicio)} → ${formatDate(s.data_fim)}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ backgroundColor: cfg.bg, color: cfg.text }}>
                      {cfg.label}
                    </span>
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

      <ModalPesquisa open={modalOpen} onClose={() => setModalOpen(false)} companyId={companyId} survey={editingSurvey} />
    </>
  )
}
