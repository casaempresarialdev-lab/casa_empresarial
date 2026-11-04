'use client'

// Select das barras de filtro; destacado na cor da empresa quando há um valor escolhido (a 1ª opção é "todos")
export function FilterSelect({ value, onChange, label, options }: {
  value: string
  onChange: (v: string) => void
  label: string
  options: { value: string; label: string }[]
}) {
  const ativo = value !== options[0].value
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="h-9 px-3 rounded-lg border text-sm outline-none cursor-pointer"
      style={{
        borderColor: ativo ? 'var(--color-brand)' : 'var(--color-card-border)',
        backgroundColor: ativo ? 'var(--color-brand-light)' : 'white',
        color: ativo ? 'var(--color-brand)' : 'var(--color-text-primary)',
        fontWeight: ativo ? 600 : 400,
      }}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  )
}

// Campo de pesquisa das barras de filtro (ocupa o espaço que sobrar)
export function SearchField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="flex-1 min-w-[220px] flex items-center gap-2 h-9 px-3 rounded-lg border" style={{ borderColor: 'var(--color-card-border)' }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0" style={{ color: 'var(--color-text-muted)' }}>
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        type="text"
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 min-w-0 bg-transparent text-sm outline-none"
        style={{ color: 'var(--color-text-primary)' }}
      />
    </div>
  )
}

// "N resultados · Limpar filtros", no fim da barra, quando há filtro em uso
export function FilterResult({ total, onClear }: { total: number; onClear: () => void }) {
  return (
    <p className="text-sm shrink-0">
      <span style={{ color: 'var(--color-text-muted)' }}>{total} {total === 1 ? 'resultado' : 'resultados'}</span>
      <button type="button" onClick={onClear} className="font-medium hover:underline ml-3" style={{ color: 'var(--color-brand)' }}>
        Limpar filtros
      </button>
    </p>
  )
}
