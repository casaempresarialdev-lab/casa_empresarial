'use client'

import { Icon } from '@/components/ui/icon'
import { Input } from '@/components/ui/input'
import { rotuloBatida } from '@/lib/ponto'

/** Lista livre de horários do dia: entrada à esquerda, saída à direita, quantas linhas forem necessárias */
export function CamposBatidas({ valor, onChange }: { valor: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-3">
        {valor.map((h, i) => (
          <div key={i} className="relative">
            <Input id={`batida-${i}`} label={rotuloBatida(i)} type="time" value={h} onChange={(e) => onChange(valor.map((v, j) => (j === i ? e.target.value : v)))} />
            <button
              type="button"
              onClick={() => onChange(valor.filter((_, j) => j !== i))}
              aria-label={`Remover ${rotuloBatida(i).toLowerCase()}`}
              className="absolute right-0 top-0 w-5 h-5 flex items-center justify-center cursor-pointer hover:text-red-600"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <Icon name="trash" size={14} />
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => onChange([...valor, ''])} className="self-start inline-flex items-center gap-1 text-sm font-semibold cursor-pointer hover:underline" style={{ color: 'var(--color-brand)' }}>
        <Icon name="plus" size={15} /> Adicionar registro
      </button>
    </div>
  )
}
