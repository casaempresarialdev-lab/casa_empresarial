'use client'

import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Icon, type IconName } from '@/components/ui/icon'
import { ANTECEDENCIAS, descreverRepeticao, formatarDuracao } from '@/lib/validations/evento'
import type { Evento, StatusConvite } from '../queries'
import { Avatar, STATUS_CONVITE, corDaPessoa } from './avatar'

const dataLongaFormat = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const horaFormat = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })
const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

interface Props {
  evento: Evento | null
  onClose: () => void
  onConcluir: (e: Evento) => void
  onEditar: (e: Evento) => void
  onExcluir: (e: Evento) => void
  /** Convidado aceita ou recusa */
  onResponder: (e: Evento, status: Exclude<StatusConvite, 'pendente'>) => void
}

function Linha({ icon, children }: { icon: IconName; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}>
        <Icon name={icon} size={16} />
      </span>
      <div className="flex-1 min-w-0 pt-1.5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>{children}</div>
    </div>
  )
}

const Selo = ({ children, style }: { children: React.ReactNode; style: React.CSSProperties }) => (
  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={style}>{children}</span>
)

// Evento completo: data, horário e duração, local ou link, repetição, convidados e aviso.
// Ações conforme a origem: meu (concluir, editar, excluir), convite (aceitar/recusar), agenda de outra pessoa (só ver).
export function ModalDetalheEvento({ evento: e, onClose, onConcluir, onEditar, onExcluir, onResponder }: Props) {
  if (!e) return null

  const inicio = new Date(e.data_hora)
  const fim = new Date(inicio.getTime() + e.duracao_min * 60_000)
  const meu = e.origem === 'meu'
  const atrasado = meu && !e.concluido && inicio.getTime() < Date.now()
  const antecedencia = ANTECEDENCIAS.find((a) => a.value === e.antecedencia_min)?.label ?? `${e.antecedencia_min} min antes`
  const duracao = formatarDuracao(e.duracao_min)
  const repete = descreverRepeticao(e, { diaSemana: inicio.getDay(), diaMes: inicio.getDate(), mes: inicio.getMonth() })
  const outroDia = fim.toDateString() !== inicio.toDateString()

  return (
    <Modal open onClose={onClose} title={e.titulo} className="sm:max-w-lg">
      <div className="flex flex-col gap-4">
        {/* Situação e origem */}
        <div className="flex flex-wrap gap-2">
          <Selo
            style={e.concluido
              ? { backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }
              : atrasado
                ? { backgroundColor: '#FEE2E2', color: '#B91C1C' }
                : { backgroundColor: 'var(--color-brand)', color: '#fff' }}
          >
            {e.concluido ? 'Concluído' : atrasado ? 'Atrasado' : 'Agendado'}
          </Selo>
          {e.origem === 'convite' && e.meu_status && <Selo style={STATUS_CONVITE[e.meu_status].estilo}>Convite · {STATUS_CONVITE[e.meu_status].label.toLowerCase()}</Selo>}
          {e.origem === 'agenda' && e.dono && (
            <Selo style={{ backgroundColor: `${corDaPessoa(e.profile_id)}1F`, color: corDaPessoa(e.profile_id) }}>Agenda de {e.dono.nome}</Selo>
          )}
        </div>

        <Linha icon="calendar">
          <p className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{capitalizar(dataLongaFormat.format(inicio))}</p>
          <p>
            {horaFormat.format(inicio)} – {outroDia ? `${dataLongaFormat.format(fim)}, ` : ''}{horaFormat.format(fim)}
            <span style={{ color: 'var(--color-text-muted)' }}> · {duracao}</span>
          </p>
          {repete && <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{repete}</p>}
        </Linha>

        {/* Local: endereço (abre no mapa) e/ou link da reunião — os dois = híbrido */}
        {(e.local || e.link_reuniao) && (
          <Linha icon="external">
            <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
              {e.local && e.link_reuniao ? 'Híbrido (presencial e online)' : e.local ? 'Presencial' : 'Reunião online'}
            </p>
            {e.local && (
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.local)}`} target="_blank" rel="noopener noreferrer" className="hover:underline break-words" style={{ color: 'var(--color-brand)' }}>
                {e.local}
              </a>
            )}
            {e.link_reuniao && (
              <div className="flex flex-col items-start gap-2 mt-2">
                <a
                  href={e.link_reuniao}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-semibold text-white"
                  style={{ backgroundColor: 'var(--color-brand)' }}
                >
                  <Icon name="external" size={15} /> Entrar na reunião
                </a>
                <span className="text-xs break-all" style={{ color: 'var(--color-text-muted)' }}>{e.link_reuniao}</span>
              </div>
            )}
          </Linha>
        )}

        <Linha icon="info">
          {e.descricao
            ? <p className="whitespace-pre-wrap break-words">{e.descricao}</p>
            : <p style={{ color: 'var(--color-text-muted)' }}>Sem descrição.</p>}
        </Linha>

        {/* Organizador e convidados */}
        {(e.participantes.length > 0 || e.dono) && (
          <Linha icon="users">
            <ul className="flex flex-col gap-2">
              {e.dono && (
                <li className="flex items-center gap-2">
                  <Avatar nome={e.dono.nome} url={e.dono.avatar_url} size={26} />
                  <span className="flex-1 min-w-0 truncate" style={{ color: 'var(--color-text-primary)' }}>{e.dono.nome}</span>
                  <span className="text-[11px] font-semibold" style={{ color: 'var(--color-text-muted)' }}>Organizador</span>
                </li>
              )}
              {e.participantes.map((p) => (
                <li key={p.id} className="flex items-center gap-2">
                  <Avatar nome={p.nome} url={p.avatar_url} size={26} />
                  <span className="flex-1 min-w-0 truncate" style={{ color: 'var(--color-text-primary)' }}>{p.nome}</span>
                  <span className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={STATUS_CONVITE[p.status].estilo}>{STATUS_CONVITE[p.status].label}</span>
                </li>
              ))}
            </ul>
          </Linha>
        )}

        {meu && (
          <Linha icon="bell">
            {e.notificar
              ? <p>Aviso: {antecedencia.toLowerCase()}{e.notificar_email ? ', no sistema e por e-mail' : ', no sistema'}.</p>
              : <p style={{ color: 'var(--color-text-muted)' }}>Sem aviso.</p>}
          </Linha>
        )}

        {e.concluido && e.concluido_em && (
          <Linha icon="check">
            <p>Concluído em {dataLongaFormat.format(new Date(e.concluido_em))} às {horaFormat.format(new Date(e.concluido_em))}.</p>
          </Linha>
        )}

        <div className="flex flex-wrap justify-between gap-2 pt-3 border-t" style={{ borderColor: 'var(--color-bg-surface)' }}>
          {meu ? (
            <>
              <Button type="button" variant="ghost" onClick={() => onExcluir(e)}>Excluir</Button>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={() => onEditar(e)}>Editar</Button>
                <Button type="button" onClick={() => onConcluir(e)}>{e.concluido ? 'Reabrir' : 'Concluir'}</Button>
              </div>
            </>
          ) : e.origem === 'convite' ? (
            <>
              <p className="text-xs self-center" style={{ color: 'var(--color-text-muted)' }}>
                {e.recorrencia ? 'Sua resposta vale para este e os próximos eventos da série.' : 'Responda ao convite.'}
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={() => onResponder(e, 'recusado')} disabled={e.meu_status === 'recusado'}>Recusar</Button>
                <Button type="button" onClick={() => onResponder(e, 'aceito')} disabled={e.meu_status === 'aceito'}>Aceitar</Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs self-center" style={{ color: 'var(--color-text-muted)' }}>Agenda compartilhada: só visualização.</p>
              <Button type="button" variant="secondary" onClick={onClose}>Fechar</Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}
