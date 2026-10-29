'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { toast } from '@/lib/toast'
import { compartilharAgendaAction, removerAgendaCompartilhadaAction, deixarDeAcompanharAction } from '../actions'
import type { Agendas, Pessoa } from '../queries'
import { Avatar, corDaPessoa } from './avatar'
import { BuscaPessoas } from './busca-pessoas'

interface Props {
  open: boolean
  onClose: () => void
  agendas: Agendas
  /** Agendas acompanhadas que estão escondidas no calendário (só neste navegador) */
  ocultas: Set<string>
  onAlternar: (ownerId: string) => void
}

// Agendas: com quem compartilho a minha (a pessoa só visualiza) e quais agendas de outras pessoas acompanho
export function ModalAgendas({ open, onClose, agendas, ocultas, onAlternar }: Props) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [removendo, setRemovendo] = useState<string | null>(null)

  async function compartilhar(email: string) {
    setErro(null)
    setEnviando(true)
    const r = await compartilharAgendaAction(email)
    setEnviando(false)
    if ('error' in r && r.error) { setErro(r.error); return }
    if (!('pessoa' in r) || !r.pessoa) return
    toast(r.emailEnviado
      ? `Agenda compartilhada com ${r.pessoa.nome}. Enviamos um aviso por e-mail.`
      : `Agenda compartilhada com ${r.pessoa.nome}. O aviso por e-mail não pôde ser enviado, mas a pessoa já vê a sua agenda.`)
    router.refresh()
  }

  async function remover(p: Pessoa, acao: 'parar' | 'deixar') {
    setRemovendo(p.id)
    const r = acao === 'parar' ? await removerAgendaCompartilhadaAction(p.id) : await deixarDeAcompanharAction(p.id)
    setRemovendo(null)
    if ('error' in r && r.error) { toast.error(r.error); return }
    toast(acao === 'parar' ? `${p.nome} não vê mais a sua agenda.` : `Você deixou de acompanhar a agenda de ${p.nome}.`)
    router.refresh()
  }

  const secao = 'text-xs font-semibold uppercase tracking-wider'
  const muted = { color: 'var(--color-text-muted)' }

  return (
    <Modal open={open} onClose={onClose} title="Agendas" className="sm:max-w-lg">
      <div className="flex flex-col gap-6">
        {/* Agendas de outras pessoas */}
        <section className="flex flex-col gap-3">
          <p className={secao} style={muted}>Agendas que você acompanha</p>
          {agendas.acompanho.length === 0 ? (
            <p className="text-sm" style={muted}>Ninguém compartilhou a agenda com você ainda.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {agendas.acompanho.map((p) => {
                const visivel = !ocultas.has(p.id)
                const cor = corDaPessoa(p.id)
                return (
                  <li key={p.id} className="flex items-center gap-3">
                    <Avatar nome={p.nome} url={p.avatar_url} cor={cor} />
                    <span className="flex-1 min-w-0 text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{p.nome}</span>
                    <label className="flex items-center gap-2 text-sm cursor-pointer select-none" style={{ color: 'var(--color-text-secondary)' }}>
                      <input type="checkbox" checked={visivel} onChange={() => onAlternar(p.id)} className="h-4 w-4 cursor-pointer" style={{ accentColor: cor }} />
                      Mostrar
                    </label>
                    <button
                      type="button"
                      onClick={() => remover(p, 'deixar')}
                      disabled={removendo === p.id}
                      title="Deixar de acompanhar"
                      aria-label={`Deixar de acompanhar a agenda de ${p.nome}`}
                      className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center hover:bg-gray-100 cursor-pointer disabled:opacity-50"
                      style={muted}
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* Minha agenda */}
        <section className="flex flex-col gap-3 pt-5 border-t" style={{ borderColor: 'var(--color-bg-surface)' }}>
          <div>
            <p className={secao} style={muted}>Compartilhar a minha agenda</p>
            <p className="text-xs mt-1" style={muted}>Quem receber vê todos os seus eventos no calendário, só para visualizar.</p>
          </div>
          {/* Pesquisa pelo nome ou e-mail; ao escolher, a agenda já é compartilhada */}
          <BuscaPessoas
            excluir={agendas.compartilhadaCom.map((p) => p.id)}
            onAdicionar={(p) => compartilhar(p.email)}
            ocupado={enviando}
            erroExterno={erro}
          />
          {agendas.compartilhadaCom.length > 0 && (
            <ul className="flex flex-col gap-2">
              {agendas.compartilhadaCom.map((p) => (
                <li key={p.id} className="flex items-center gap-3">
                  <Avatar nome={p.nome} url={p.avatar_url} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{p.nome}</p>
                    <p className="text-xs truncate" style={muted}>{p.email}</p>
                  </div>
                  <Button type="button" variant="ghost" onClick={() => remover(p, 'parar')} loading={removendo === p.id}>Parar</Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Modal>
  )
}
