'use client'

import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { ANTECEDENCIAS } from '@/lib/validations/evento'
import type { Evento } from '../queries'

const dataLongaFormat = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const horaFormat = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })
const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

interface Props {
  evento: Evento | null
  onClose: () => void
  onConcluir: (e: Evento) => void
  onEditar: (e: Evento) => void
  onExcluir: (e: Evento) => void
}

function Linha({ icon, children }: { icon: 'calendar' | 'bell' | 'check' | 'info'; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}>
        <Icon name={icon} size={16} />
      </span>
      <div className="flex-1 min-w-0 pt-1.5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>{children}</div>
    </div>
  )
}

// Evento completo: data e hora, descrição inteira, situação e aviso; ações de concluir, editar e excluir
export function ModalDetalheEvento({ evento: e, onClose, onConcluir, onEditar, onExcluir }: Props) {
  if (!e) return null

  const data = new Date(e.data_hora)
  const atrasado = !e.concluido && data.getTime() < Date.now()
  const antecedencia = ANTECEDENCIAS.find((a) => a.value === e.antecedencia_min)?.label ?? `${e.antecedencia_min} min antes`

  return (
    <Modal open onClose={onClose} title={e.titulo} className="sm:max-w-lg">
      <div className="flex flex-col gap-4">
        {/* Situação */}
        <div>
          <span
            className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
            style={e.concluido
              ? { backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }
              : atrasado
                ? { backgroundColor: '#FEE2E2', color: '#B91C1C' }
                : { backgroundColor: 'var(--color-brand)', color: '#fff' }}
          >
            {e.concluido ? 'Concluído' : atrasado ? 'Atrasado' : 'Agendado'}
          </span>
        </div>

        <Linha icon="calendar">
          <p className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{capitalizar(dataLongaFormat.format(data))}</p>
          <p>às {horaFormat.format(data)}</p>
        </Linha>

        <Linha icon="info">
          {e.descricao
            ? <p className="whitespace-pre-wrap break-words">{e.descricao}</p>
            : <p style={{ color: 'var(--color-text-muted)' }}>Sem descrição.</p>}
        </Linha>

        <Linha icon="bell">
          {e.notificar
            ? <p>Aviso: {antecedencia.toLowerCase()}{e.notificar_email ? ', no sistema e por e-mail' : ', no sistema'}.</p>
            : <p style={{ color: 'var(--color-text-muted)' }}>Sem aviso.</p>}
        </Linha>

        {e.concluido && e.concluido_em && (
          <Linha icon="check">
            <p>Concluído em {dataLongaFormat.format(new Date(e.concluido_em))} às {horaFormat.format(new Date(e.concluido_em))}.</p>
          </Linha>
        )}

        <div className="flex flex-wrap justify-between gap-2 pt-3 border-t" style={{ borderColor: 'var(--color-bg-surface)' }}>
          <Button type="button" variant="ghost" onClick={() => onExcluir(e)}>Excluir</Button>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => onEditar(e)}>Editar</Button>
            <Button type="button" onClick={() => onConcluir(e)}>{e.concluido ? 'Reabrir' : 'Concluir'}</Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
