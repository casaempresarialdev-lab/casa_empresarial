'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ListItem, ListEmpty } from '@/components/ui/list-item'
import { AddButton } from '@/components/ui/add-button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/lib/toast'
import { ModalSocio } from './modal-socio'
import { ModalSocioFoto } from './modal-socio-foto'
import { ModalSocioDocumentos } from './modal-socio-documentos'
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
  const [fotoTarget, setFotoTarget] = useState<Socio | null>(null)
  const [docsTarget, setDocsTarget] = useState<Socio | null>(null)

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

        <ul className="flex flex-col gap-3">
          {socios.length === 0 && <ListEmpty>Nenhum sócio cadastrado.</ListEmpty>}
          {socios.map((s) => (
            <ListItem
              key={s.id}
              media={
                // Foto (ou iniciais)
                <span
                  className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center shrink-0 text-xs font-bold"
                  style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}
                >
                  {s.foto_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.foto_url} alt={s.nome} className="w-full h-full object-cover" />
                  ) : (
                    s.nome.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()
                  )}
                </span>
              }
              title={s.nome}
              subtitle={[s.cargo, s.cpf ? `CPF ${cpfMask(s.cpf)}` : null, s.administrador ? 'Administrador' : null].filter(Boolean).join(' · ') || 'Sem cargo informado'}
              aside={
                // Percentual + barra proporcional
                <div className="flex items-center gap-2">
                  {s.participacao !== null && (
                    <span className="hidden sm:block h-1.5 w-20 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-brand-light)' }}>
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${Math.min(100, Number(s.participacao))}%`, backgroundColor: 'var(--color-brand)' }}
                      />
                    </span>
                  )}
                  <span className="text-sm font-semibold w-14 text-right" style={{ color: 'var(--color-text-primary)' }}>
                    {formatPercent(s.participacao)}
                  </span>
                </div>
              }
              actionsLabel={s.nome}
              actions={[
                { icon: 'pencil', label: 'Editar', onClick: () => openEdit(s) },
                { icon: 'camera', label: 'Foto', onClick: () => setFotoTarget(s) },
                { icon: 'folder', label: s.documentos ? `Documentos (${s.documentos})` : 'Documentos', onClick: () => setDocsTarget(s) },
                { icon: 'trash', label: 'Remover', tone: 'danger', onClick: () => setConfirmTarget(s), disabled: deletingId === s.id },
              ]}
            />
          ))}
        </ul>
      </div>

      <ModalSocio
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        companyId={companyId}
        socio={editingSocio}
        outrasParticipacoes={outrasParticipacoes}
      />

      <ModalSocioFoto open={!!fotoTarget} onClose={() => setFotoTarget(null)} companyId={companyId} socio={fotoTarget} />

      <ModalSocioDocumentos open={!!docsTarget} onClose={() => setDocsTarget(null)} companyId={companyId} socio={docsTarget} />

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
