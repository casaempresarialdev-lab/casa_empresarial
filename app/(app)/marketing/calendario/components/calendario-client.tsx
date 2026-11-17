'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { AddButton } from '@/components/ui/add-button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FilterResult, FilterSelect } from '@/components/ui/filter-select'
import { ListEmpty, ListItem } from '@/components/ui/list-item'
import { CONTEUDO_STATUS, canalLabel, faseLabel, formatoLabel } from '@/lib/marketing/constantes'
import { toast } from '@/lib/toast'
import { deleteConteudoMarketingAction } from '../actions'
import type { ConteudoMarketing } from '../queries'
import { ModalConteudo } from './modal-conteudo'

function Selo({ texto, fundo, cor }: { texto: string; fundo: string; cor: string }) {
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap" style={{ backgroundColor: fundo, color: cor }}>{texto}</span>
}

const STATUS_SELO: Record<ConteudoMarketing['status'], { texto: string; fundo: string; cor: string }> = {
  ideia: { texto: 'Ideia', fundo: '#F3F4F6', cor: '#6B7280' },
  fazendo: { texto: 'Fazendo', fundo: '#FEF3C7', cor: '#B45309' },
  feito: { texto: 'Feito', fundo: '#DBEAFE', cor: '#1D4ED8' },
  agendado: { texto: 'Agendado', fundo: '#DCFCE7', cor: '#15803D' },
  publicado: { texto: 'Publicado', fundo: 'var(--color-primary)', cor: 'var(--color-primary-darker)' },
}

const FILTRO_STATUS = [{ value: 'todos', label: 'Todos os status' }, ...CONTEUDO_STATUS.map((s) => ({ value: s.id, label: s.label }))]

function fmtDataBr(d: string) {
  const [y, m, day] = d.slice(0, 10).split('-')
  return `${day}/${m}/${y}`
}

interface Props {
  conteudos: ConteudoMarketing[]
  companyId: string
  prefill: { titulo: string; formato: string } | null
}

// Calendário editorial: pipeline de produção (ideia→fazendo→feito→agendado→publicado) ordenado por data
export function CalendarioClient({ conteudos, companyId, prefill }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(!!prefill)
  const [editing, setEditing] = useState<ConteudoMarketing | null>(null)
  const [excluir, setExcluir] = useState<ConteudoMarketing | null>(null)
  const [excluindo, setExcluindo] = useState(false)
  const [filtroStatus, setFiltroStatus] = useState('todos')

  // Veio do Banco de ideias ("Transformar em post") — abre o modal já preenchido e limpa a URL
  useEffect(() => {
    if (prefill) router.replace('/marketing/calendario')
  }, [prefill, router])

  const visiveis = conteudos.filter((c) => filtroStatus === 'todos' || c.status === filtroStatus)

  function abrirNovo() { setEditing(null); setModalOpen(true) }
  function abrirEdicao(c: ConteudoMarketing) { setEditing(c); setModalOpen(true) }

  async function confirmarExclusao() {
    if (!excluir) return
    setExcluindo(true)
    const r = await toast.promise(deleteConteudoMarketingAction(excluir.id), {
      loading: 'Excluindo…',
      success: 'Publicação excluída.',
      error: 'Não foi possível excluir.',
    })
    setExcluindo(false)
    setExcluir(null)
    if (!('error' in r)) router.refresh()
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>Calendário Editorial</h1>
        <Breadcrumb />
      </div>

      <div className="app-card p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {conteudos.length} {conteudos.length === 1 ? 'publicação planejada' : 'publicações planejadas'}
          </p>
          <AddButton onClick={abrirNovo} label="Nova publicação" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect value={filtroStatus} onChange={setFiltroStatus} label="Filtrar por status" options={FILTRO_STATUS} />
          {filtroStatus !== 'todos' && <FilterResult total={visiveis.length} onClear={() => setFiltroStatus('todos')} />}
        </div>

        <ul className="flex flex-col gap-3">
          {visiveis.length === 0 && (
            <ListEmpty>{conteudos.length === 0 ? 'Planeje a primeira publicação.' : 'Nenhum resultado encontrado.'}</ListEmpty>
          )}
          {visiveis.map((c) => (
            <ListItem
              key={c.id}
              icon="calendar"
              title={c.titulo}
              subtitle={[
                c.data_publicacao && fmtDataBr(c.data_publicacao),
                formatoLabel(c.formato, c.formato_outro),
                c.canal && canalLabel(c.canal, c.canal_outro),
                c.fase && faseLabel(c.fase),
              ].filter(Boolean).join(' · ')}
              aside={<Selo {...STATUS_SELO[c.status]} />}
              onClick={() => abrirEdicao(c)}
              actionsLabel={c.titulo}
              actions={[
                { icon: 'pencil', label: 'Editar', onClick: () => abrirEdicao(c) },
                { icon: 'trash', label: 'Excluir', tone: 'danger', onClick: () => setExcluir(c) },
              ]}
            />
          ))}
        </ul>
      </div>

      <ModalConteudo open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null) }} companyId={companyId} conteudo={editing} prefill={editing ? null : prefill} />

      <ConfirmDialog
        open={!!excluir}
        onClose={() => { if (!excluindo) setExcluir(null) }}
        onConfirm={confirmarExclusao}
        loading={excluindo}
        title="Excluir publicação"
        confirmLabel="Excluir"
        message={<p>Excluir <strong>{excluir?.titulo}</strong>?</p>}
      />
    </>
  )
}
