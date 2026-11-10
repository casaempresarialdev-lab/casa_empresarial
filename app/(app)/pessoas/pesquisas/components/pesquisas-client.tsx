'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { SummaryCard } from '@/components/modules/dashboard/summary-card'
import { AddButton } from '@/components/ui/add-button'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FilterResult, FilterSelect, SearchField } from '@/components/ui/filter-select'
import { ListEmpty, ListItem } from '@/components/ui/list-item'
import { Modal } from '@/components/ui/modal'
import { toast } from '@/lib/toast'
import { ModalPesquisa } from './modal-pesquisa'
import { deleteSurveyAction, toggleSurveyStatusAction } from '../actions'
import type { Survey } from '../queries'

const STATUS = {
  rascunho: { label: 'Rascunho', fundo: '#F3F4F6', cor: '#6B7280' },
  ativo: { label: 'Ativa', fundo: '#DCFCE7', cor: '#15803D' },
  encerrado: { label: 'Encerrada', fundo: '#FEE2E2', cor: '#B91C1C' },
} as const

const FILTROS = [
  { value: 'todos', label: 'Todos os status' },
  { value: 'ativo', label: 'Ativas' },
  { value: 'rascunho', label: 'Rascunhos' },
  { value: 'encerrado', label: 'Encerradas' },
]

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`
const fmt = (d: string | null) => (d ? d.split('-').reverse().join('/') : null)

function periodo(s: Survey) {
  const ini = fmt(s.data_inicio)
  const fim = fmt(s.data_fim)
  if (ini && fim) return `${ini} a ${fim}`
  if (ini) return `a partir de ${ini}`
  if (fim) return `até ${fim}`
  return null
}

function Selo({ status }: { status: Survey['status'] }) {
  const s = STATUS[status]
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap" style={{ backgroundColor: s.fundo, color: s.cor }}>{s.label}</span>
}

// Link público da pesquisa, para copiar ou mandar pelo WhatsApp
function ModalLink({ survey, onClose }: { survey: Survey; onClose: () => void }) {
  const router = useRouter()
  const link = typeof window !== 'undefined' ? `${window.location.origin}/pesquisa/${survey.id}` : `/pesquisa/${survey.id}`
  const [ativando, setAtivando] = useState(false)

  async function copiar() {
    await navigator.clipboard.writeText(link)
    toast('Link copiado.')
  }

  async function ativar() {
    setAtivando(true)
    try {
      await toast.promise(toggleSurveyStatusAction(survey.id, 'ativo'), { loading: 'Ativando…', success: 'Pesquisa ativa: já pode receber respostas.', error: 'Não foi possível ativar.' })
      router.refresh()
      onClose()
    } catch {
      // A mensagem de erro já apareceu
    }
    setAtivando(false)
  }

  return (
    <Modal open onClose={onClose} title="Link da pesquisa" description={survey.titulo}>
      <div className="flex flex-col gap-4">
        {survey.status === 'rascunho' && (
          <div className="text-sm rounded-lg px-3 py-2.5 flex flex-wrap items-center justify-between gap-2" style={{ backgroundColor: '#FEF3C7', color: '#B45309' }}>
            <span>Ainda é rascunho: ative para receber respostas.</span>
            <Button type="button" size="sm" loading={ativando} onClick={ativar}>Ativar agora</Button>
          </div>
        )}
        {survey.status === 'encerrado' && (
          <p className="text-sm rounded-lg px-3 py-2.5" style={{ backgroundColor: '#FEE2E2', color: '#B91C1C' }}>Pesquisa encerrada: novas respostas não são aceitas.</p>
        )}
        <div className="flex items-center gap-2 rounded-lg border px-3 py-2" style={{ borderColor: 'var(--color-card-border)' }}>
          <span className="flex-1 min-w-0 text-sm truncate" style={{ color: 'var(--color-text-secondary)' }}>{link}</span>
          <Button type="button" size="sm" variant="secondary" onClick={copiar}>Copiar</Button>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Fechar</Button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`Responda nossa pesquisa: ${link}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center h-10 px-4 rounded-lg text-sm font-semibold text-white"
            style={{ backgroundColor: '#25D366' }}
          >
            Enviar pelo WhatsApp
          </a>
        </div>
      </div>
    </Modal>
  )
}

// Pesquisas de clima: criar, compartilhar o link, acompanhar respostas e encerrar
export function PesquisasClient({ surveys, companyId }: { surveys: Survey[]; companyId: string }) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<Survey | null>(null)
  const [link, setLink] = useState<Survey | null>(null)
  const [excluir, setExcluir] = useState<Survey | null>(null)
  const [excluindo, setExcluindo] = useState(false)
  const [filtro, setFiltro] = useState('todos')
  const [busca, setBusca] = useState('')

  const q = busca.trim().toLowerCase()
  const visiveis = surveys
    .filter((s) => filtro === 'todos' || s.status === filtro)
    .filter((s) => !q || s.titulo.toLowerCase().includes(q) || (s.descricao ?? '').toLowerCase().includes(q))

  const contar = (st: Survey['status']) => surveys.filter((s) => s.status === st).length
  const respostas = surveys.reduce((t, s) => t + (s.response_count ?? 0), 0)
  const respostasAtivas = surveys.filter((s) => s.status === 'ativo').reduce((t, s) => t + (s.response_count ?? 0), 0)

  function abrirNova() { setEditando(null); setModalOpen(true) }
  function abrirEdicao(s: Survey) { setEditando(s); setModalOpen(true) }
  const resultados = (s: Survey) => router.push(`/pessoas/pesquisas/${s.id}/resultados`)

  async function mudarStatus(s: Survey, status: Survey['status']) {
    try {
      await toast.promise(toggleSurveyStatusAction(s.id, status), {
        loading: 'Salvando…',
        success: status === 'ativo' ? `"${s.titulo}" ativa.` : status === 'encerrado' ? `"${s.titulo}" encerrada.` : `"${s.titulo}" voltou para rascunho.`,
        error: 'Não foi possível mudar o status.',
      })
      router.refresh()
    } catch {
      // A mensagem de erro já apareceu
    }
  }

  async function confirmarExclusao() {
    if (!excluir) return
    setExcluindo(true)
    try {
      await toast.promise(deleteSurveyAction(excluir.id), { loading: 'Excluindo…', success: 'Pesquisa excluída.', error: 'Não foi possível excluir.' })
      router.refresh()
    } catch {
      // A mensagem de erro já apareceu
    }
    setExcluindo(false)
    setExcluir(null)
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>Pesquisas de Clima</h1>
        <Breadcrumb />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <SummaryCard icon="megaphone" title="Pesquisas ativas" value={contar('ativo')} caption={respostasAtivas ? `${plural(respostasAtivas, 'resposta', 'respostas')} nelas` : 'recebendo respostas'} />
        <SummaryCard icon="users" title="Respostas recebidas" value={respostas} caption="em todas as pesquisas" delay={60} />
        <SummaryCard icon="pencil" title="Rascunhos" value={contar('rascunho')} caption="ainda não publicados" accent={contar('rascunho') ? 'yellow' : undefined} delay={120} />
        <SummaryCard icon="check" title="Encerradas" value={contar('encerrado')} caption="com resultado final" delay={180} />
      </div>

      <div className="app-card p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold" style={{ color: 'var(--color-sidebar-text)' }}>
            {surveys.length === 0 ? 'Nenhuma pesquisa criada' : plural(surveys.length, 'pesquisa', 'pesquisas')}
          </p>
          <AddButton onClick={abrirNova} label="Nova pesquisa" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect value={filtro} onChange={setFiltro} label="Filtrar por status" options={FILTROS} />
          <SearchField value={busca} onChange={setBusca} placeholder="Pesquisar por título..." />
          {(filtro !== 'todos' || busca) && <FilterResult total={visiveis.length} onClear={() => { setFiltro('todos'); setBusca('') }} />}
        </div>

        <ul className="flex flex-col gap-3">
          {visiveis.length === 0 && (
            <ListEmpty>{surveys.length === 0 ? 'Crie a primeira pesquisa e mande o link para a equipe responder.' : 'Nenhuma pesquisa encontrada.'}</ListEmpty>
          )}
          {visiveis.map((s) => (
            <ListItem
              key={s.id}
              icon="megaphone"
              title={s.titulo}
              subtitle={[plural(s.perguntas.length, 'pergunta', 'perguntas'), plural(s.response_count ?? 0, 'resposta', 'respostas'), periodo(s)].filter(Boolean).join(' · ')}
              aside={<Selo status={s.status} />}
              onClick={() => resultados(s)}
              actionsLabel={s.titulo}
              actions={[
                { icon: 'eye', label: 'Ver resultados', onClick: () => resultados(s) },
                { icon: 'share', label: 'Link e compartilhamento', onClick: () => setLink(s) },
                { icon: 'pencil', label: 'Editar', onClick: () => abrirEdicao(s) },
                ...(s.status !== 'ativo' ? [{ icon: 'check' as const, label: s.status === 'encerrado' ? 'Reabrir' : 'Ativar', onClick: () => mudarStatus(s, 'ativo') }] : []),
                ...(s.status === 'ativo' ? [{ icon: 'lock' as const, label: 'Encerrar', onClick: () => mudarStatus(s, 'encerrado') }] : []),
                { icon: 'trash', label: 'Excluir', tone: 'danger' as const, onClick: () => setExcluir(s) },
              ]}
            />
          ))}
        </ul>
      </div>

      <ModalPesquisa open={modalOpen} onClose={() => setModalOpen(false)} companyId={companyId} survey={editando} />
      {link && <ModalLink survey={link} onClose={() => setLink(null)} />}

      <ConfirmDialog
        open={!!excluir}
        onClose={() => { if (!excluindo) setExcluir(null) }}
        onConfirm={confirmarExclusao}
        loading={excluindo}
        title="Excluir pesquisa"
        message={<p>Excluir <strong>{excluir?.titulo}</strong>? As respostas recebidas também são apagadas.</p>}
      />
    </>
  )
}
