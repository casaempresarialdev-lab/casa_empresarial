'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { ListItem, ListEmpty } from '@/components/ui/list-item'
import { toast } from '@/lib/toast'
import { concluirEventoAction, marcarAvisosVistosAction } from '../../calendario/actions'
import type { Evento } from '../../calendario/queries'
import type { AvisoCompartilhamento } from '../../cofre-de-senhas/queries'

const quandoFormat = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
const quando = (iso: string) => { const t = quandoFormat.format(new Date(iso)); return t.charAt(0).toUpperCase() + t.slice(1) }

// Eventos ficam no calendário da página inicial
const LINK_CALENDARIO = '/dashboard'
// Abre o próprio evento no calendário (modal de detalhes)
const linkEvento = (id: string) => `${LINK_CALENDARIO}?evento=${id}`
const LINK_COMPARTILHADAS = '/cofre-de-senhas?aba=compartilhadas'

const Nova = () => (
  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: 'var(--color-brand)', fontFamily: 'Inter' }}>Nova</span>
)

// Página de notificações: avisos de eventos do calendário e credenciais do cofre compartilhadas com o usuário.
// Cada item é um link: evento → calendário da página inicial; compartilhamento → Cofre de senhas (Compartilhadas comigo).
export function NotificacoesClient({ notificacoes, compartilhamentos }: { notificacoes: Evento[]; compartilhamentos: AvisoCompartilhamento[] }) {
  const router = useRouter()

  // Abrir a página conta como "visto": zera o contador do sino
  useEffect(() => {
    if (notificacoes.some((n) => !n.aviso_visto_em) || compartilhamentos.some((c) => !c.aviso_visto_em)) marcarAvisosVistosAction()
  }, [notificacoes, compartilhamentos])

  const pendentes = notificacoes.filter((n) => !n.concluido)
  const concluidas = notificacoes.filter((n) => n.concluido)

  async function concluir(n: Evento) {
    const r = await concluirEventoAction(n.id, true)
    if ('error' in r) { toast.error(r.error ?? 'Não foi possível concluir.'); return }
    toast(`"${n.titulo}" concluído.`)
    router.refresh()
  }

  const item = (n: Evento) => (
    <ListItem
      key={n.id}
      icon={n.concluido ? 'check' : 'bell'}
      title={
        <Link href={linkEvento(n.id)} className="flex items-center gap-2 hover:underline">
          <span className={n.concluido ? 'line-through opacity-60' : ''}>{n.titulo}</span>
          {!n.aviso_visto_em && !n.concluido && <Nova />}
        </Link>
      }
      subtitle={<span>Evento · {quando(n.data_hora)}</span>}
      actionsLabel={n.titulo}
      actions={[
        ...(!n.concluido ? [{ icon: 'check' as const, label: 'Concluir', onClick: () => concluir(n) }] : []),
        { icon: 'calendar', label: 'Abrir evento', onClick: () => router.push(linkEvento(n.id)) },
      ]}
    />
  )

  const itemCompartilhamento = (c: AvisoCompartilhamento) => (
    <ListItem
      key={c.id}
      icon="lock"
      title={
        <Link href={LINK_COMPARTILHADAS} className="flex items-center gap-2 hover:underline">
          <span>{c.sistema}</span>
          {!c.aviso_visto_em && <Nova />}
        </Link>
      }
      subtitle={<span>{c.dono_nome} compartilhou uma senha com você · {quando(c.created_at)}</span>}
      actionsLabel={c.sistema}
      actions={[{ icon: 'lock', label: 'Abrir cofre de senhas', onClick: () => router.push(LINK_COMPARTILHADAS) }]}
    />
  )

  return (
    <>
      <div className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>
            Notificações
          </h1>
          <Breadcrumb />
        </div>
        <p className="text-sm mt-1 animate-enter" style={{ color: 'var(--color-text-muted)', animationDelay: '60ms' }}>
          Avisos dos seus eventos do calendário e senhas compartilhadas com você
        </p>
      </div>

      <div className="app-card p-5 flex flex-col gap-5">
        {notificacoes.length + compartilhamentos.length === 0 && (
          <ListEmpty>
            Nenhuma notificação por enquanto. Os avisos dos seus <Link href={LINK_CALENDARIO} className="font-medium hover:underline" style={{ color: 'var(--color-brand)' }}>eventos do calendário</Link> e as senhas compartilhadas com você aparecem aqui.
          </ListEmpty>
        )}

        {pendentes.length > 0 && (
          <section className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Pendentes ({pendentes.length})</p>
            <ul className="flex flex-col gap-3">{pendentes.map(item)}</ul>
          </section>
        )}

        {compartilhamentos.length > 0 && (
          <section className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Senhas compartilhadas com você ({compartilhamentos.length})</p>
            <ul className="flex flex-col gap-3">{compartilhamentos.map(itemCompartilhamento)}</ul>
          </section>
        )}

        {concluidas.length > 0 && (
          <section className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Concluídas ({concluidas.length})</p>
            <ul className="flex flex-col gap-3">{concluidas.map(item)}</ul>
          </section>
        )}
      </div>
    </>
  )
}
