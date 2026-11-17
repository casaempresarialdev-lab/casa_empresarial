'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { SummaryCard } from '@/components/modules/dashboard/summary-card'
import { AddButton } from '@/components/ui/add-button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ListEmpty, ListItem } from '@/components/ui/list-item'
import { canalLabel, objetivoLabel } from '@/lib/marketing/constantes'
import { toast } from '@/lib/toast'
import { deleteCampanhaMarketingAction } from '../actions'
import type { CampanhaMarketing } from '../queries'
import { ModalCampanha } from './modal-campanha'

function Selo({ texto, fundo, cor }: { texto: string; fundo: string; cor: string }) {
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap" style={{ backgroundColor: fundo, color: cor }}>{texto}</span>
}

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

type StatusCampanha = 'planejada' | 'ativa' | 'concluida'

function statusCampanha(c: CampanhaMarketing): StatusCampanha {
  const hoje = new Date().toISOString().slice(0, 10)
  if (c.data_inicio && hoje < c.data_inicio) return 'planejada'
  if (c.data_fim && hoje > c.data_fim) return 'concluida'
  return 'ativa'
}

const STATUS_SELO: Record<StatusCampanha, { texto: string; fundo: string; cor: string }> = {
  planejada: { texto: 'Planejada', fundo: '#DBEAFE', cor: '#1D4ED8' },
  ativa: { texto: 'Ativa', fundo: '#DCFCE7', cor: '#15803D' },
  concluida: { texto: 'Concluída', fundo: '#F3F4F6', cor: '#6B7280' },
}

function fmtDataBr(d: string) {
  const [y, m, day] = d.slice(0, 10).split('-')
  return `${day}/${m}/${y}`
}

interface Props {
  campanhas: CampanhaMarketing[]
  companyId: string
}

export function CampanhasClient({ campanhas, companyId }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CampanhaMarketing | null>(null)
  const [excluir, setExcluir] = useState<CampanhaMarketing | null>(null)
  const [excluindo, setExcluindo] = useState(false)

  const ativas = campanhas.filter((c) => statusCampanha(c) === 'ativa').length
  const planejadas = campanhas.filter((c) => statusCampanha(c) === 'planejada').length
  const concluidas = campanhas.filter((c) => statusCampanha(c) === 'concluida').length

  function abrirNovo() { setEditing(null); setModalOpen(true) }
  function abrirEdicao(c: CampanhaMarketing) { setEditing(c); setModalOpen(true) }

  async function confirmarExclusao() {
    if (!excluir) return
    setExcluindo(true)
    const r = await toast.promise(deleteCampanhaMarketingAction(excluir.id), {
      loading: 'Excluindo…',
      success: 'Campanha excluída.',
      error: 'Não foi possível excluir.',
    })
    setExcluindo(false)
    setExcluir(null)
    if (!('error' in r)) router.refresh()
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>Campanhas e Promoções</h1>
        <Breadcrumb />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <SummaryCard icon="flag" title="Ativas" value={ativas} caption="dentro do período" />
        <SummaryCard icon="calendar" title="Planejadas" value={planejadas} caption="ainda não começaram" delay={60} />
        <SummaryCard icon="check" title="Concluídas" value={concluidas} caption="já passaram do fim" delay={120} />
      </div>

      <div className="app-card p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {campanhas.length} {campanhas.length === 1 ? 'campanha cadastrada' : 'campanhas cadastradas'}
          </p>
          <AddButton onClick={abrirNovo} label="Nova campanha" />
        </div>

        <ul className="flex flex-col gap-3">
          {campanhas.length === 0 && <ListEmpty>Registre período, objetivo e orçamento de cada promoção pra acompanhar o resultado.</ListEmpty>}
          {campanhas.map((c) => {
            const status = statusCampanha(c)
            const periodo = c.data_fim ? `${fmtDataBr(c.data_inicio)} – ${fmtDataBr(c.data_fim)}` : `${fmtDataBr(c.data_inicio)} em diante`
            const retorno = c.orcamento && c.orcamento > 0 && c.vendas_geradas && c.vendas_geradas > 0 ? c.vendas_geradas / c.orcamento : null
            return (
              <ListItem
                key={c.id}
                icon="flag"
                title={c.nome}
                subtitle={[objetivoLabel(c.objetivo), c.canal && canalLabel(c.canal), periodo, c.orcamento && `Orçamento ${formatBRL(c.orcamento)}`, c.leads_gerados && `${c.leads_gerados} leads`].filter(Boolean).join(' · ')}
                aside={
                  <>
                    {retorno && <span className="text-sm font-semibold whitespace-nowrap" style={{ color: 'var(--color-success)' }}>{retorno.toFixed(1)}x o investido</span>}
                    <Selo {...STATUS_SELO[status]} />
                  </>
                }
                onClick={() => abrirEdicao(c)}
                actionsLabel={c.nome}
                actions={[
                  { icon: 'pencil', label: 'Editar', onClick: () => abrirEdicao(c) },
                  { icon: 'trash', label: 'Excluir', tone: 'danger', onClick: () => setExcluir(c) },
                ]}
              />
            )
          })}
        </ul>
      </div>

      <ModalCampanha open={modalOpen} onClose={() => setModalOpen(false)} companyId={companyId} campanha={editing} />

      <ConfirmDialog
        open={!!excluir}
        onClose={() => { if (!excluindo) setExcluir(null) }}
        onConfirm={confirmarExclusao}
        loading={excluindo}
        title="Excluir campanha"
        confirmLabel="Excluir"
        message={<p>Excluir <strong>{excluir?.nome}</strong>?</p>}
      />
    </>
  )
}
