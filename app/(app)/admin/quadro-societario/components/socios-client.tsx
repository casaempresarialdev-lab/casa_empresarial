'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ModalSocio } from './modal-socio'
import { deleteSocioAction } from '../actions'
import type { Socio } from '../queries'

interface Props {
  socios: Socio[]
  companyId: string
}

function cpfMask(cpf: string | null) {
  if (!cpf) return '—'
  const d = cpf.replace(/\D/g, '')
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`
}

export function SociosClient({ socios, companyId }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingSocio, setEditingSocio] = useState<Socio | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState('')

  const totalParticipacao = socios.reduce((s, x) => s + (x.participacao ?? 0), 0)

  function openAdd() { setEditingSocio(null); setModalOpen(true) }
  function openEdit(s: Socio) { setEditingSocio(s); setModalOpen(true) }

  async function handleDelete(s: Socio) {
    if (!confirm(`Remover ${s.nome} do quadro societário?`)) return
    setDeletingId(s.id)
    setDeleteError('')
    const result = await deleteSocioAction(s.id)
    setDeletingId(null)
    if ('error' in result) setDeleteError(result.error ?? 'Erro ao excluir.')
    else router.refresh()
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
            Quadro Societário
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Sócios e participações da empresa
          </p>
        </div>
        <Button onClick={openAdd}>+ Novo sócio</Button>
      </div>

      {deleteError && (
        <p className="text-sm mb-4 p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>
          {deleteError}
        </p>
      )}

      {socios.length > 0 && (
        <div
          className="flex items-center gap-2 mb-4 px-4 py-2 rounded-lg text-sm"
          style={{ backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-secondary)' }}
        >
          <span>Total de participação:</span>
          <span
            className="font-semibold"
            style={{ color: totalParticipacao > 100 ? 'var(--color-error)' : 'var(--color-text-primary)' }}
          >
            {totalParticipacao.toFixed(2)}%
          </span>
          {totalParticipacao > 100 && (
            <span style={{ color: 'var(--color-error)' }}>— excede 100%!</span>
          )}
        </div>
      )}

      <div className="rounded-xl border overflow-x-auto" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
        <table className="w-full min-w-[600px] text-sm">
          <thead style={{ backgroundColor: 'var(--color-bg-surface)' }}>
            <tr>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Nome</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>CPF</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Cargo</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Participação</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Contato</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {socios.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-10" style={{ color: 'var(--color-text-muted)' }}>
                  Nenhum sócio cadastrado.
                </td>
              </tr>
            )}
            {socios.map((s) => (
              <tr key={s.id} className="border-t" style={{ borderColor: 'var(--color-bg-surface)' }}>
                <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text-primary)' }}>{s.nome}</td>
                <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>{cpfMask(s.cpf)}</td>
                <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>{s.cargo ?? '—'}</td>
                <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  {s.participacao != null ? `${s.participacao}%` : '—'}
                </td>
                <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>
                  {s.email ?? s.telefone ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>Editar</Button>
                    <Button
                      variant="danger"
                      size="sm"
                      loading={deletingId === s.id}
                      onClick={() => handleDelete(s)}
                    >
                      Excluir
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ModalSocio
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        companyId={companyId}
        socio={editingSocio}
      />
    </>
  )
}
