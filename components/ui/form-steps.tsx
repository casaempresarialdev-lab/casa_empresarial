'use client'

// Indicador de etapas dos cadastros: número (ou ✓ quando concluída) + nome, ligados por uma linha.
// onSelect (opcional): permite voltar para uma etapa já concluída clicando nela.
export function Stepper({ labels, step, onSelect }: { labels: string[]; step: number; onSelect?: (i: number) => void }) {
  const last = labels.length - 1
  return (
    <ol className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
      {labels.map((label, i) => {
        const done = i < step
        const current = i === step
        const clicavel = !!onSelect && done
        const conteudo = (
          <>
            <span
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors"
              style={done || current
                ? { backgroundColor: 'var(--color-brand)', color: '#fff' }
                : { backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-muted)' }}
            >
              {done ? '✓' : i + 1}
            </span>
            <span
              className="text-sm whitespace-nowrap"
              style={{ color: current ? 'var(--color-text-primary)' : 'var(--color-text-muted)', fontWeight: current ? 600 : 400 }}
            >
              {label}
            </span>
          </>
        )
        return (
          <li key={label} className="flex items-center gap-2 flex-1 last:flex-none">
            {clicavel ? (
              <button type="button" onClick={() => onSelect(i)} className="flex items-center gap-2 cursor-pointer hover:underline">
                {conteudo}
              </button>
            ) : conteudo}
            {i < last && (
              <span className="flex-1 h-px min-w-4" style={{ backgroundColor: done ? 'var(--color-brand)' : 'var(--color-card-border)' }} />
            )}
          </li>
        )
      })}
    </ol>
  )
}

// Abas da edição/visualização (não precisa passar por todas para salvar)
export function Tabs({ labels, step, onSelect }: { labels: string[]; step: number; onSelect: (i: number) => void }) {
  return (
    <div className="flex flex-wrap gap-2 mb-6" role="tablist">
      {labels.map((label, i) => {
        const active = i === step
        return (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(i)}
            className={`h-9 px-4 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${active ? '' : 'hover:bg-gray-50'}`}
            style={{
              fontFamily: 'Manrope',
              ...(active ? { backgroundColor: 'var(--color-brand)', color: '#fff' } : { color: 'var(--color-sidebar-text)' }),
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
