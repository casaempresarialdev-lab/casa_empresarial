'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ModalCentroCusto } from './modal-centro-custo'
import { deleteCostCenterAction } from '../actions'
import type { CostCenter } from '../queries'

interface Props {
  costCenters: CostCenter[]
  companyId: string
}

export function CentroCustoClient({ costCenters, companyId }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CostCenter | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [search, setSearch] = useState('')

  const q = search.toLowerCase()
  const filtered = costCenters.filter(c =>
    c.nome.toLowerCase().includes(q) ||
    (c.codigo ?? '').toLowerCase().includes(q)
  )

  function openAdd() { setEditing(null); setModalOpen(true) }
  function openEdit(c: CostCenter) { setEditing(c); setModalOpen(true) }

  async function handleDelete(c: CostCenter) {
    if (!confirm(`Excluir "${c.nome}"? Esta ação não pode ser desfeita.`)) return
    setDeletingId(c.id)
    setDeleteError('')
    const result = await deleteCostCenterAction(c.id)
    setDeletingId(null)
    if ('error' in result) setDeleteError(result.error ?? 'Erro ao excluir.')
    else router.refresh()
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
            Centro de Custo
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Agrupe lançamentos por área ou projeto
          </p>
        </div>
        <Button onClick={openAdd}>Adicionar</Button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar por nome ou código..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-4 py-2 rounded-lg border text-sm"
          style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white', color: 'var(--color-text-primary)' }}
        />
      </div>

      {deleteError && (
        <p className="text-sm mb-4 p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>{deleteError}</p>
      )}

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
        <table className="w-full text-sm">
          <thead style={{ backgroundColor: 'var(--color-bg-surface)' }}>
            <tr>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Nome</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Código</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-10" style={{ color: 'var(--color-text-muted)' }}>
                  {search ? 'Nenhum resultado.' : 'Nenhum centro de custo cadastrado.'}
                </td>
              </tr>
            )}
            {filtered.map(c => (
              <tr key={c.id} className="border-t" style={{ borderColor: 'var(--color-bg-surface)' }}>
                <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text-primary)' }}>{c.nome}</td>
                <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>{c.codigo ?? '—'}</td>
                <td className="px-4 py-3">
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: c.ativo ? '#E9F7EF' : '#F2F3F4',
                      color: c.ativo ? '#1E8449' : '#717D7E',
                    }}
                  >
                    {c.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>Editar</Button>
                    <Button variant="danger" size="sm" loading={deletingId === c.id} onClick={() => handleDelete(c)}>Excluir</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ModalCentroCusto
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        companyId={companyId}
        costCenter={editing}
      />
    </>
  )
}
