'use client'

import { useState } from 'react'
import { SearchField } from '@/components/ui/filter-select'
import { Icon } from '@/components/ui/icon'
import { tipoLabel } from '../../../funcionarios/components/ficha/ficha-config'
import type { Vaga } from '../../../vagas/queries'

function Opcao({ titulo, texto, selo, tracejado, onClick }: { titulo: string; texto: string; selo?: string; tracejado?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-4 rounded-xl border bg-white px-4 py-3.5 text-left transition-colors hover:bg-gray-50/70 cursor-pointer ${tracejado ? 'border-dashed' : ''}`}
      style={{ borderColor: 'var(--color-card-border)' }}
    >
      <span className="shrink-0" style={{ color: 'var(--color-brand)' }}><Icon name={tracejado ? 'user' : 'briefcase'} size={18} /></span>
      <span className="flex-1 min-w-0">
        <span className="block font-bold truncate" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>{titulo}</span>
        <span className="block text-sm truncate" style={{ color: 'var(--color-text-muted)' }}>{texto}</span>
      </span>
      {selo && <span className="hidden sm:inline text-xs font-medium shrink-0" style={{ color: '#B45309' }}>{selo}</span>}
      <span className="shrink-0" style={{ color: 'var(--color-text-muted)' }}><Icon name="chevron-right" size={18} /></span>
    </button>
  )
}

// Primeiro passo da nova admissão: de qual vaga é, ou nenhuma
export function EscolherVaga({ vagas, onEscolher }: { vagas: Vaga[]; onEscolher: (vaga: Vaga | null) => void }) {
  const [busca, setBusca] = useState('')
  const q = busca.toLowerCase()
  const visiveis = vagas.filter((v) => !q || [v.titulo, v.cargo, v.departamento].some((t) => (t ?? '').toLowerCase().includes(q)))

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>De qual vaga é esta admissão?</h2>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Os dados da vaga já vêm preenchidos no cadastro.</p>
      </div>
      {vagas.length > 5 && <SearchField value={busca} onChange={setBusca} placeholder="Pesquisar vaga..." />}
      <div className="flex flex-col gap-3">
        {visiveis.map((v) => (
          <Opcao
            key={v.id}
            titulo={v.titulo}
            texto={[v.cargo, v.departamento, tipoLabel(v.tipo_contrato)].filter(Boolean).join(' · ')}
            selo={v.status === 'pausada' ? 'Pausada' : undefined}
            onClick={() => onEscolher(v)}
          />
        ))}
        <Opcao tracejado titulo="Admissão sem vaga" texto="Contratação direta: preencha os dados manualmente." onClick={() => onEscolher(null)} />
      </div>
    </div>
  )
}
