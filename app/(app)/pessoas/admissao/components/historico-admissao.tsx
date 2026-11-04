'use client'

import { fmtDataHora } from '@/lib/validations/admissao'
import type { Anotacao, Entrevista } from '../queries'

/** Situação da entrevista para a tela: passou do horário sem ser cancelada = realizada */
export function situacaoEntrevista(e: Entrevista, agora: number) {
  if (e.status === 'cancelada') return { label: 'Cancelada', bg: '#F3F4F6', color: '#6B7280', futura: false }
  return Date.parse(e.data_hora) > agora
    ? { label: 'Marcada', bg: '#DBEAFE', color: '#1D4ED8', futura: true }
    : { label: 'Realizada', bg: '#DCFCE7', color: '#15803D', futura: false }
}

export function ListaEntrevistas({ entrevistas, acoes }: {
  entrevistas: Entrevista[]
  /** Botões de uma entrevista ainda por acontecer */
  acoes?: (e: Entrevista) => React.ReactNode
}) {
  const agora = Date.now()
  if (!entrevistas.length) return <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Nenhuma entrevista marcada.</p>
  return (
    <ul className="flex flex-col gap-2">
      {entrevistas.map((e) => {
        const s = situacaoEntrevista(e, agora)
        return (
          <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-3.5 py-2.5" style={{ borderColor: 'var(--color-card-border)' }}>
            <div className="flex-1 min-w-[200px]">
              <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{fmtDataHora(e.data_hora)}</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {e.entrevistador_nome}
                {e.link_reuniao && (
                  <> · <a href={e.link_reuniao} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'var(--color-brand)' }}>Abrir link</a></>
                )}
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full" style={{ backgroundColor: s.bg, color: s.color }}>{s.label}</span>
            {s.futura && acoes?.(e)}
          </li>
        )
      })}
    </ul>
  )
}

export function ListaAnotacoes({ anotacoes }: { anotacoes: Anotacao[] }) {
  if (!anotacoes.length) return <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Nenhuma anotação ainda.</p>
  return (
    <ul className="flex flex-col gap-3">
      {anotacoes.map((a) => (
        <li key={a.id} className="border-l-2 pl-3" style={{ borderColor: 'var(--color-brand-light)' }}>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{a.autor_nome} · {fmtDataHora(a.created_at)}</p>
          <p className="text-sm whitespace-pre-wrap break-words" style={{ color: 'var(--color-text-secondary)' }}>{a.texto}</p>
        </li>
      ))}
    </ul>
  )
}
