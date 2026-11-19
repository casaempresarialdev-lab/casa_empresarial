'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { SummaryCard } from '@/components/modules/dashboard/summary-card'
import { AddButton } from '@/components/ui/add-button'
import { StatusBadge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FilterResult, FilterSelect, SearchField } from '@/components/ui/filter-select'
import { ListEmpty, ListItem } from '@/components/ui/list-item'
import { toast } from '@/lib/toast'
import { deleteCostCenterAction } from '../actions'
import type { CostCenter } from '../queries'
import { ModalCentroCusto } from './modal-centro-custo'

interface Props {
  costCenters: CostCenter[]
  companyId: string
  /** true quando renderizado dentro de uma aba de Configurações — esconde o título/breadcrumb próprio */
  embedded?: boolean
}

const FILTRO_STATUS = [
  { value: 'todos', label: 'Todos' },
  { value: 'ativos', label: 'Ativos' },
  { value: 'inativos', label: 'Inativos' },
]

// Centros de custo da empresa: cadastro simples, usado pra classificar lançamentos no Fluxo de Caixa
export function CentroCustoClient({ costCenters, companyId, embedded }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CostCenter | null>(null)
  const [excluir, setExcluir] = useState<CostCenter | null>(null)
  const [excluindo, setExcluindo] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('todos')

  const ativos = costCenters.filter((c) => c.ativo)
  const inativos = costCenters.filter((c) => !c.ativo)

  const q = busca.trim().toLowerCase()
  const visiveis = costCenters
    .filter((c) => filtro === 'todos' || (filtro === 'ativos' ? c.ativo : !c.ativo))
    .filter((c) => !q || c.nome.toLowerCase().includes(q) || (c.codigo ?? '').toLowerCase().includes(q))

  function abrirNovo() { setEditing(null); setModalOpen(true) }
  function abrirEdicao(c: CostCenter) { setEditing(c); setModalOpen(true) }

  async function confirmarExclusao() {
    if (!excluir) return
    setExcluindo(true)
    const r = await toast.promise(deleteCostCenterAction(excluir.id), {
      loading: `Excluindo ${excluir.nome}…`,
      success: `Centro de custo ${excluir.nome} excluído.`,
      error: 'Não foi possível excluir o centro de custo.',
    })
    setExcluindo(false)
    setExcluir(null)
    if (!('error' in r)) router.refresh()
  }

  return (
    <>
      {!embedded && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>Centro de Custo</h1>
          <Breadcrumb />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <SummaryCard icon="briefcase" title="Centros de custo" value={costCenters.length} caption={costCenters.length === 1 ? 'cadastrado' : 'cadastrados'} />
        <SummaryCard icon="check" title="Ativos" value={ativos.length} caption="disponíveis nos lançamentos" delay={60} />
        <SummaryCard icon="info" title="Inativos" value={inativos.length} caption="fora dos lançamentos novos" delay={120} />
      </div>

      <div className="app-card p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {costCenters.length} {costCenters.length === 1 ? 'centro de custo' : 'centros de custo'}
          </p>
          <AddButton onClick={abrirNovo} label="Novo centro de custo" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SearchField value={busca} onChange={setBusca} placeholder="Pesquisar por nome ou código..." />
          <FilterSelect value={filtro} onChange={setFiltro} label="Filtrar por status" options={FILTRO_STATUS} />
          {(busca || filtro !== 'todos') && (
            <FilterResult total={visiveis.length} onClear={() => { setBusca(''); setFiltro('todos') }} />
          )}
        </div>

        <ul className="flex flex-col gap-3">
          {visiveis.length === 0 && (
            <ListEmpty>
              {costCenters.length === 0
                ? 'Crie o primeiro centro de custo para classificar os lançamentos do Fluxo de Caixa.'
                : 'Nenhum centro de custo encontrado.'}
            </ListEmpty>
          )}
          {visiveis.map((c) => (
            <ListItem
              key={c.id}
              icon="briefcase"
              title={c.nome}
              subtitle={c.codigo ? `Código ${c.codigo}` : undefined}
              aside={<StatusBadge status={c.ativo ? 'active' : 'inactive'} />}
              onClick={() => abrirEdicao(c)}
              actionsLabel={c.nome}
              actions={[
                { icon: 'pencil', label: 'Editar', onClick: () => abrirEdicao(c) },
                { icon: 'trash', label: 'Excluir', tone: 'danger', onClick: () => setExcluir(c) },
              ]}
            />
          ))}
        </ul>
      </div>

      <ModalCentroCusto open={modalOpen} onClose={() => setModalOpen(false)} companyId={companyId} costCenter={editing} />

      <ConfirmDialog
        open={!!excluir}
        onClose={() => { if (!excluindo) setExcluir(null) }}
        onConfirm={confirmarExclusao}
        loading={excluindo}
        title="Excluir centro de custo"
        confirmLabel="Excluir"
        message={<p>Excluir <strong>{excluir?.nome}</strong>? Lançamentos que já usam este centro de custo não são apagados, mas ele deixa de aparecer para novos lançamentos.</p>}
      />
    </>
  )
}
