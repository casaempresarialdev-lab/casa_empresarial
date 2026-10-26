'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { IconButton } from '@/components/ui/icon-button'
import { AddButton } from '@/components/ui/add-button'
import { TABLE_WRAPPER_CLASS, TABLE_HEAD_STYLE, TH_CLASS, ROW_CLASS, ROW_STYLE } from '@/components/ui/table-styles'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/lib/toast'
import { ModalSocio } from './modal-socio'
import { deleteSocioAction } from '../actions'
import type { Socio } from '../queries'
import { Breadcrumb } from '@/components/layout/breadcrumb'

interface Props {
  socios: Socio[]
  companyId: string
}

function cpfMask(cpf: string | null) {
  if (!cpf) return '—'
  const d = cpf.replace(/\D/g, '')
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`
}

function formatPercent(value: number | null) {
  if (value === null || value === undefined) return '—'
  return `${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%`
}

export function SociosClient({ socios, companyId }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingSocio, setEditingSocio] = useState<Socio | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<Socio | null>(null)

  function openAdd() { setEditingSocio(null); setModalOpen(true) }
  function openEdit(s: Socio) { setEditingSocio(s); setModalOpen(true) }

  // Remoção confirmada no modal; o resultado aparece no toast (✓ / ✕)
  async function confirmDelete() {
    const s = confirmTarget
    if (!s) return
    setDeletingId(s.id)
    const result = await toast.promise(deleteSocioAction(s.id), {
      loading: `Removendo ${s.nome}…`,
      success: `${s.nome} foi removido do quadro societário.`,
      error: 'Não foi possível remover o sócio.',
    })
    setDeletingId(null)
    setConfirmTarget(null)
    if (!('error' in result)) router.refresh()
  }

  const totalParticipacao = socios.reduce((sum, s) => sum + Number(s.participacao ?? 0), 0)
  // Participação já usada pelos outros sócios (o editado fica de fora)
  const outrasParticipacoes = totalParticipacao - Number(editingSocio?.participacao ?? 0)

  return (
    <>
      <div className="mb-6">
        {/* Título e breadcrumb na mesma linha */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>
            Quadro Societário
          </h1>
          <Breadcrumb />
        </div>
        <p className="text-sm mt-1 animate-enter" style={{ color: 'var(--color-text-muted)', animationDelay: '60ms' }}>
          Sócios e participações da empresa
        </p>
      </div>

      <div className="app-card p-5 flex flex-col gap-4">
        {/* Barra do box: resumo + adicionar (botão discreto, vazado) */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm" style={{ color: 'var(--color-sidebar-text)' }}>
            <span className="font-semibold">{socios.length} {socios.length === 1 ? 'sócio' : 'sócios'}</span>
            {socios.length > 0 && (
              <span style={{ color: 'var(--color-text-muted)' }}> · {formatPercent(totalParticipacao)} de participação distribuída</span>
            )}
          </p>
          <AddButton onClick={openAdd} />
        </div>

        <div className={TABLE_WRAPPER_CLASS}>
          <table className="w-full min-w-[640px] text-sm">
            <thead style={TABLE_HEAD_STYLE}>
              <tr>
                <th className={TH_CLASS}>Nome</th>
                <th className={TH_CLASS}>Participação</th>
                <th className={TH_CLASS}>CPF</th>
                <th className={TH_CLASS}>Cargo</th>
                <th className={TH_CLASS}>Administrador</th>
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
                <tr key={s.id} className={ROW_CLASS} style={ROW_STYLE}>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text-primary)' }}>{s.nome}</td>
                  <td className="px-4 py-3">
                    {/* Percentual + barra proporcional */}
                    <div className="flex items-center gap-2">
                      <span className="font-semibold w-14 shrink-0" style={{ color: 'var(--color-text-primary)' }}>
                        {formatPercent(s.participacao)}
                      </span>
                      {s.participacao !== null && (
                        <span className="h-1.5 w-20 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-brand-light)' }}>
                          <span
                            className="block h-full rounded-full"
                            style={{ width: `${Math.min(100, Number(s.participacao))}%`, backgroundColor: 'var(--color-brand)' }}
                          />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>{cpfMask(s.cpf)}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>{s.cargo ?? '—'}</td>
                  <td className="px-4 py-3">
                    {s.administrador ? (
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-primary-darker)' }}
                      >
                        Sim
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Não</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <IconButton icon="pencil" label={`Editar ${s.nome}`} onClick={() => openEdit(s)} />
                      <IconButton
                        icon="trash"
                        label={`Remover ${s.nome}`}
                        tone="danger"
                        onClick={() => setConfirmTarget(s)}
                        disabled={deletingId === s.id}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ModalSocio
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        companyId={companyId}
        socio={editingSocio}
        outrasParticipacoes={outrasParticipacoes}
      />

      <ConfirmDialog
        open={!!confirmTarget}
        onClose={() => { if (!deletingId) setConfirmTarget(null) }}
        onConfirm={confirmDelete}
        loading={!!deletingId}
        title="Remover sócio"
        message={<p>Remover <strong>{confirmTarget?.nome}</strong> do quadro societário?</p>}
      />
    </>
  )
}
