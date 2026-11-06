'use client'

import { useId } from 'react'
import { Icon, type IconName } from './icon'

interface Props {
  titulo: string
  /** Ícone de identificação: com ele, o título fica na cor primária */
  icone?: IconName
  /** Resumo ao lado do título, útil com a seção fechada */
  resumo?: React.ReactNode
  /** Selo à direita do título (ex.: "Etapa atual") */
  selo?: React.ReactNode
  aberto: boolean
  onAlternar: () => void
  children: React.ReactNode
}

// Sanfona: o conteúdo fechado continua montado (só escondido), para não perder o que foi digitado
export function Accordion({ titulo, icone, resumo, selo, aberto, onAlternar, children }: Props) {
  const id = useId()
  return (
    <section className="app-card overflow-hidden">
      <button
        type="button"
        onClick={onAlternar}
        aria-expanded={aberto}
        aria-controls={id}
        className="w-full flex items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-gray-50/70"
      >
        {icone && (
          <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}>
            <Icon name={icone} size={18} />
          </span>
        )}
        <span className="flex-1 min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold" style={{ fontFamily: 'Manrope', color: icone ? 'var(--color-brand)' : 'var(--color-text-primary)' }}>{titulo}</span>
            {selo}
          </span>
          {resumo && <span className="block text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{resumo}</span>}
        </span>
        <span className="shrink-0 transition-transform duration-200" style={{ color: 'var(--color-text-muted)', transform: aberto ? 'rotate(90deg)' : undefined }}>
          <Icon name="chevron-right" size={18} />
        </span>
      </button>
      <div id={id} className={aberto ? 'px-5 pb-5 pt-1' : 'hidden'}>{children}</div>
    </section>
  )
}
