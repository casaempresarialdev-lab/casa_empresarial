'use client'

import { useEffect, useRef, useState } from 'react'

export type MultiSelectOption = { value: string; label: string; count?: number; group?: string }

interface Props {
  /** Nome do filtro (leitores de tela) */
  label: string
  options: MultiSelectOption[]
  value: string[]
  onChange: (value: string[]) => void
  /** Texto do botão (ex.: "Ativos", "3 status") */
  summary: string
  /** Destaca na cor da empresa (filtro fora do padrão) */
  highlighted?: boolean
}

// Filtro de múltipla escolha no visual dos selects das barras de filtro:
// botão com resumo + painel de caixas de seleção, agrupadas (o título do grupo marca/desmarca o grupo todo)
export function MultiSelectFilter({ label, options, value, onChange, summary, highlighted }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const selected = new Set(value)
  const toggle = (v: string) => onChange(selected.has(v) ? value.filter((x) => x !== v) : [...value, v])
  const toggleGroup = (vals: string[]) => {
    const all = vals.every((v) => selected.has(v))
    onChange(all ? value.filter((v) => !vals.includes(v)) : [...new Set([...value, ...vals])])
  }

  const soltas = options.filter((o) => !o.group)
  const grupos = [...new Set(options.filter((o) => o.group).map((o) => o.group!))]

  const renderOption = (o: MultiSelectOption) => (
    <label key={o.value} className="flex items-center gap-2.5 px-3 py-1.5 text-sm cursor-pointer hover:bg-gray-50 rounded-md">
      <input
        type="checkbox"
        checked={selected.has(o.value)}
        onChange={() => toggle(o.value)}
        className="w-4 h-4 cursor-pointer"
        style={{ accentColor: 'var(--color-brand)' }}
      />
      <span className="flex-1" style={{ color: 'var(--color-text-primary)' }}>{o.label}</span>
      {o.count !== undefined && <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{o.count}</span>}
    </label>
  )

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={open}
        className="h-9 pl-3 pr-2.5 rounded-lg border text-sm outline-none cursor-pointer inline-flex items-center gap-2 whitespace-nowrap"
        style={{
          borderColor: highlighted ? 'var(--color-brand)' : 'var(--color-card-border)',
          backgroundColor: highlighted ? 'var(--color-brand-light)' : 'white',
          color: highlighted ? 'var(--color-brand)' : 'var(--color-text-primary)',
          fontWeight: highlighted ? 600 : 400,
        }}
      >
        {summary}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 150ms' }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          role="group"
          aria-label={label}
          className="absolute left-0 top-full mt-1 z-50 min-w-[230px] rounded-xl border bg-white shadow-lg p-1.5"
          style={{ borderColor: 'var(--color-card-border)' }}
        >
          {soltas.map(renderOption)}
          {grupos.map((g) => {
            const itens = options.filter((o) => o.group === g)
            const vals = itens.map((o) => o.value)
            const marcados = vals.filter((v) => selected.has(v)).length
            return (
              <div key={g} className="pt-1">
                <label className="flex items-center gap-2.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide cursor-pointer hover:bg-gray-50 rounded-md" style={{ color: 'var(--color-text-muted)' }}>
                  <input
                    type="checkbox"
                    checked={marcados === vals.length}
                    ref={(el) => { if (el) el.indeterminate = marcados > 0 && marcados < vals.length }}
                    onChange={() => toggleGroup(vals)}
                    className="w-4 h-4 cursor-pointer"
                    style={{ accentColor: 'var(--color-brand)' }}
                  />
                  {g}
                </label>
                <div className="pl-4">{itens.map(renderOption)}</div>
              </div>
            )
          })}
          {value.length > 0 && (
            <div className="border-t mt-1.5 pt-1.5 px-1" style={{ borderColor: 'var(--color-card-border)' }}>
              <button
                type="button"
                onClick={() => onChange([])}
                className="w-full text-left px-2 py-1.5 text-sm font-medium rounded-md hover:bg-gray-50"
                style={{ color: 'var(--color-brand)' }}
              >
                Desmarcar todos
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
