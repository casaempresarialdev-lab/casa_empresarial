'use client'

import { useId, useState } from 'react'
import { Icon } from './icon'

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

interface Props {
  label: string
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  error?: string
  /** Texto quando a pesquisa não encontra nada */
  emptyText?: string
}

// Campo de escolha por pesquisa: digita, filtra (sem diferenciar acentos) e escolhe com o mouse ou o teclado
export function SearchSelect({ label, options, value, onChange, placeholder = 'Digite para pesquisar...', error, emptyText = 'Nada encontrado.' }: Props) {
  const id = useId()
  const listaId = `${id}-lista`
  const selecionada = options.find((o) => o.value === value)
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const [ativo, setAtivo] = useState(0)

  const q = normalizar(busca.trim())
  const filtradas = q ? options.filter((o) => normalizar(o.label).includes(q)) : options

  function escolher(v: string) {
    onChange(v)
    setAberto(false)
    setBusca('')
  }

  function teclado(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!aberto) { setAberto(true); return }
      setAtivo((a) => Math.min(a + 1, filtradas.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setAtivo((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      // Não envia o formulário ao escolher
      if (aberto) {
        e.preventDefault()
        if (filtradas[ativo]) escolher(filtradas[ativo].value)
      }
    } else if (e.key === 'Escape' && aberto) {
      // Fecha só a lista, não o modal em volta
      e.stopPropagation()
      e.nativeEvent.stopImmediatePropagation()
      setAberto(false)
      setBusca('')
    }
  }

  return (
    <div className="relative flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-text-muted)' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </span>
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={aberto}
          aria-controls={listaId}
          aria-autocomplete="list"
          aria-invalid={!!error || undefined}
          autoComplete="off"
          placeholder={selecionada?.label ?? placeholder}
          value={aberto ? busca : selecionada?.label ?? ''}
          onFocus={() => { setAberto(true); setAtivo(0) }}
          onClick={() => setAberto(true)}
          onBlur={() => { setAberto(false); setBusca('') }}
          onChange={(e) => { setBusca(e.target.value); setAberto(true); setAtivo(0) }}
          onKeyDown={teclado}
          className={`h-10 w-full rounded-lg border pl-9 pr-3 text-sm transition-colors focus:outline-none focus:ring-2 placeholder:text-gray-400 ${error ? 'border-red-400 focus:ring-red-300' : 'focus:ring-[var(--color-brand)]'}`}
          style={{ borderColor: error ? undefined : 'var(--color-bg-surface)', backgroundColor: '#fff', color: 'var(--color-text-primary)' }}
        />
      </div>

      {aberto && (
        <ul
          id={listaId}
          role="listbox"
          aria-label={label}
          // Usar a barra de rolagem da lista não tira o foco do campo
          onMouseDown={(e) => e.preventDefault()}
          className="absolute left-0 right-0 top-full mt-1 z-50 max-h-56 overflow-y-auto rounded-xl border bg-white shadow-lg p-1"
          style={{ borderColor: 'var(--color-card-border)' }}
        >
          {filtradas.length === 0 && (
            <li className="px-3 py-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>{emptyText}</li>
          )}
          {filtradas.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              // mousedown: escolhe antes de o campo perder o foco
              onMouseDown={(e) => { e.preventDefault(); escolher(o.value) }}
              onMouseEnter={() => setAtivo(i)}
              className="flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-lg cursor-pointer"
              style={{ backgroundColor: i === ativo ? 'var(--color-brand-light)' : undefined, color: 'var(--color-text-primary)' }}
            >
              {o.label}
              {o.value === value && <span style={{ color: 'var(--color-brand)' }}><Icon name="check" size={14} /></span>}
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-xs" style={{ color: 'var(--color-error)' }}>{error}</p>}
    </div>
  )
}
