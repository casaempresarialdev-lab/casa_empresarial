'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/ui/icon'
import { ListItem } from '@/components/ui/list-item'
import { AddButton } from '@/components/ui/add-button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { concluirEventoAction, excluirEventoAction } from '../actions'
import type { Evento } from '../queries'
import { ModalEvento } from './modal-evento'
import { ModalDetalheEvento } from './modal-detalhe-evento'

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MAX_NO_DIA = 3 // eventos visíveis por dia no calendário (o resto vira "+N")

const horaFormat = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })
const diaLongoFormat = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
const diaCurtoFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })

const pad = (n: number) => String(n).padStart(2, '0')
/** Chave do dia no fuso do usuário (YYYY-MM-DD) */
const chaveDia = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// Calendário da página inicial: eventos do dia escolhido e atrasados (esquerda) + mês completo (direita)
export function CalendarioHome({ eventos, eventoAbertoId }: {
  eventos: Evento[]
  /** Vindo de uma notificação (?evento=<id>): abre o evento direto no modal de detalhes */
  eventoAbertoId?: string
}) {
  const router = useRouter()
  const hoje = new Date()
  const [selecionado, setSelecionado] = useState(() => new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()))
  const [mesRef, setMesRef] = useState(() => new Date(hoje.getFullYear(), hoje.getMonth(), 1))
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<Evento | null>(null)
  const [excluirTarget, setExcluirTarget] = useState<Evento | null>(null)
  const [excluindo, setExcluindo] = useState(false)
  // Evento aberto no modal de detalhes
  const [detalhe, setDetalhe] = useState<Evento | null>(null)

  // Eventos agrupados por dia (no fuso do usuário)
  const porDia = useMemo(() => {
    const m = new Map<string, Evento[]>()
    for (const e of eventos) {
      const k = chaveDia(new Date(e.data_hora))
      m.set(k, [...(m.get(k) ?? []), e])
    }
    return m
  }, [eventos])

  const agora = hoje.getTime()
  // Atrasados: horário já passou (inclusive hoje) e ainda não concluídos — mais antigos primeiro
  const ehAtrasado = (e: Evento) => !e.concluido && new Date(e.data_hora).getTime() < agora
  const atrasados = eventos.filter(ehAtrasado)
  const doDia = porDia.get(chaveDia(selecionado)) ?? []
  const ehHojeSelecionado = chaveDia(selecionado) === chaveDia(hoje)

  // Grade do mês: começa no domingo da primeira semana, sempre 6 semanas
  const ano = mesRef.getFullYear()
  const mes = mesRef.getMonth()
  const inicioGrade = new Date(ano, mes, 1 - new Date(ano, mes, 1).getDay())
  const dias = Array.from({ length: 42 }, (_, i) => new Date(inicioGrade.getFullYear(), inicioGrade.getMonth(), inicioGrade.getDate() + i))

  function irPara(d: Date) {
    setSelecionado(new Date(d.getFullYear(), d.getMonth(), d.getDate()))
    setMesRef(new Date(d.getFullYear(), d.getMonth(), 1))
  }

  // Notificação clicada: seleciona o dia do evento e abre o detalhe
  useEffect(() => {
    if (!eventoAbertoId) return
    const e = eventos.find((x) => x.id === eventoAbertoId)
    if (!e) { toast.error('Este evento não existe mais.'); router.replace('/dashboard', { scroll: false }); return }
    const d = new Date(e.data_hora)
    setSelecionado(new Date(d.getFullYear(), d.getMonth(), d.getDate()))
    setMesRef(new Date(d.getFullYear(), d.getMonth(), 1))
    setDetalhe(e)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só ao chegar com um novo evento no link
  }, [eventoAbertoId])

  // Fecha o detalhe e tira o ?evento= do endereço (senão reabriria ao atualizar a tela)
  function fecharDetalhe() {
    setDetalhe(null)
    if (eventoAbertoId) router.replace('/dashboard', { scroll: false })
  }

  function novoEvento() { setEditando(null); setModalOpen(true) }

  async function alternarConcluido(e: Evento) {
    const r = await concluirEventoAction(e.id, !e.concluido)
    if ('error' in r) { toast.error(r.error ?? 'Não foi possível atualizar.'); return }
    toast(e.concluido ? `"${e.titulo}" reaberto.` : `"${e.titulo}" concluído.`)
    router.refresh()
  }

  async function confirmarExclusao() {
    const e = excluirTarget
    if (!e) return
    setExcluindo(true)
    const r = await toast.promise(excluirEventoAction(e.id), {
      loading: 'Excluindo evento…',
      success: `"${e.titulo}" excluído.`,
      error: 'Não foi possível excluir o evento.',
    })
    setExcluindo(false)
    setExcluirTarget(null)
    if (!('error' in r)) router.refresh()
  }

  const itemEvento = (e: Evento, mostrarDia?: boolean) => (
    <ListItem
      key={e.id}
      onClick={() => setDetalhe(e)}
      icon={e.concluido ? 'check' : e.notificar ? 'bell' : 'calendar'}
      title={<span className={e.concluido ? 'line-through opacity-60' : ''}>{e.titulo}</span>}
      subtitle={
        <span>
          {mostrarDia && `${diaCurtoFormat.format(new Date(e.data_hora))} · `}
          {horaFormat.format(new Date(e.data_hora))}
          {e.descricao && <span className="opacity-80"> · {e.descricao}</span>}
        </span>
      }
      actionsLabel={e.titulo}
      actions={[
        { icon: 'check', label: e.concluido ? 'Reabrir' : 'Concluir', onClick: () => alternarConcluido(e) },
        { icon: 'pencil', label: 'Editar', onClick: () => { setEditando(e); setModalOpen(true) } },
        { icon: 'trash', label: 'Excluir', tone: 'danger', onClick: () => setExcluirTarget(e) },
      ]}
    />
  )

  return (
    // Coluna dos eventos um pouco mais larga; o calendário ocupa o restante
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,420px)_1fr] xl:grid-cols-[minmax(0,460px)_1fr] gap-4 items-start">
      {/* Esquerda: eventos do dia escolhido + atrasados */}
      <div className="flex flex-col gap-4">
        <div className="app-card p-5 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                {ehHojeSelecionado ? 'Hoje' : 'Dia selecionado'}
              </p>
              <p className="font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
                {capitalizar(diaLongoFormat.format(selecionado))}
              </p>
            </div>
            <AddButton onClick={novoEvento} />
          </div>
          {doDia.length === 0
            ? <p className="text-sm py-4 text-center" style={{ color: 'var(--color-text-muted)' }}>Nenhum evento neste dia.</p>
            : <ul className="flex flex-col gap-2">{doDia.map((e) => itemEvento(e))}</ul>}
        </div>

        {/* Atrasados não concluídos */}
        <div className="app-card p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Atrasados</p>
            <span className="min-w-6 h-6 px-2 rounded-full text-xs font-bold flex items-center justify-center" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}>
              {atrasados.length}
            </span>
          </div>
          {atrasados.length === 0
            ? <p className="text-sm py-2 text-center" style={{ color: 'var(--color-text-muted)' }}>Nenhum evento atrasado. Tudo em dia!</p>
            : <ul className="flex flex-col gap-2">{atrasados.map((e) => itemEvento(e, true))}</ul>}
        </div>
      </div>

      {/* Direita: calendário do mês */}
      <div className="app-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setMesRef(new Date(ano, mes - 1, 1))} aria-label="Mês anterior" className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 cursor-pointer" style={{ color: 'var(--color-text-secondary)' }}>
              <Icon name="chevron-left" size={18} />
            </button>
            <h3 className="text-lg font-bold min-w-44 text-center" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
              {MESES[mes]} {ano}
            </h3>
            <button type="button" onClick={() => setMesRef(new Date(ano, mes + 1, 1))} aria-label="Próximo mês" className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 cursor-pointer" style={{ color: 'var(--color-text-secondary)' }}>
              <Icon name="chevron-right" size={18} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => irPara(hoje)}
            className="h-8 px-3 rounded-lg text-sm font-semibold border cursor-pointer hover:bg-[var(--color-brand-light)]"
            style={{ borderColor: 'var(--color-brand)', color: 'var(--color-brand)' }}
          >
            Hoje
          </button>
        </div>

        <div className="grid grid-cols-7 gap-px rounded-xl overflow-hidden border" style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-bg-surface)' }}>
          {SEMANA.map((s) => (
            <div key={s} className="bg-white py-2 text-center text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>{s}</div>
          ))}
          {dias.map((d) => {
            const k = chaveDia(d)
            const lista = porDia.get(k) ?? []
            const foraDoMes = d.getMonth() !== mes
            const ehHoje = k === chaveDia(hoje)
            const ehSelecionado = k === chaveDia(selecionado)
            return (
              <div
                key={k}
                role="button"
                tabIndex={0}
                onClick={() => irPara(d)}
                onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); irPara(d) } }}
                onDoubleClick={() => { irPara(d); novoEvento() }}
                title="Clique para ver os eventos · duplo clique para criar"
                className={cn(
                  'bg-white min-h-20 sm:min-h-24 p-1.5 flex flex-col items-stretch gap-1 text-left cursor-pointer transition-colors hover:bg-gray-50',
                  ehSelecionado && 'ring-2 ring-inset ring-[var(--color-brand)]',
                )}
              >
                <span
                  className={cn('self-end w-6 h-6 rounded-full flex items-center justify-center text-xs', ehHoje && 'font-bold')}
                  style={ehHoje
                    ? { backgroundColor: 'var(--color-brand)', color: '#fff' }
                    : { color: foraDoMes ? '#C4C4C4' : 'var(--color-text-primary)' }}
                >
                  {d.getDate()}
                </span>
                {lista.slice(0, MAX_NO_DIA).map((e) => {
                  const atrasado = ehAtrasado(e)
                  return (
                    // Clique no evento abre o detalhe (sem selecionar o dia por trás)
                    <button
                      key={e.id}
                      type="button"
                      onClick={(ev) => { ev.stopPropagation(); setDetalhe(e) }}
                      onDoubleClick={(ev) => ev.stopPropagation()}
                      title={e.titulo}
                      className={cn('hidden sm:block w-full text-left truncate rounded px-1.5 py-0.5 text-[11px] font-medium cursor-pointer hover:brightness-95', e.concluido && 'line-through opacity-50')}
                      style={atrasado
                        ? { backgroundColor: '#FEE2E2', color: '#B91C1C' }
                        : { backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}
                    >
                      {horaFormat.format(new Date(e.data_hora))} {e.titulo}
                    </button>
                  )
                })}
                {lista.length > MAX_NO_DIA && (
                  <span className="hidden sm:block text-[11px] font-semibold px-1" style={{ color: 'var(--color-text-muted)' }}>
                    +{lista.length - MAX_NO_DIA}
                  </span>
                )}
                {/* Celular: só um ponto indicando que há eventos */}
                {lista.length > 0 && <span className="sm:hidden self-center w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-brand)' }} />}
              </div>
            )
          })}
        </div>
      </div>

      <ModalDetalheEvento
        evento={detalhe}
        onClose={fecharDetalhe}
        onConcluir={(e) => { fecharDetalhe(); alternarConcluido(e) }}
        onEditar={(e) => { fecharDetalhe(); setEditando(e); setModalOpen(true) }}
        onExcluir={(e) => { fecharDetalhe(); setExcluirTarget(e) }}
      />

      <ModalEvento open={modalOpen} onClose={() => setModalOpen(false)} evento={editando} dataInicial={selecionado} />

      <ConfirmDialog
        open={!!excluirTarget}
        onClose={() => { if (!excluindo) setExcluirTarget(null) }}
        onConfirm={confirmarExclusao}
        loading={excluindo}
        title="Excluir evento"
        message={<p>Excluir o evento <strong>{excluirTarget?.titulo}</strong>?</p>}
      />
    </div>
  )
}
