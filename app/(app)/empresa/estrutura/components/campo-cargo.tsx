'use client'

import Link from 'next/link'
import { Select } from '@/components/ui/select'
import type { CargoOpcao } from '../tipos'

// Cargo escolhido do cadastro da Estrutura: Vagas, ficha da Equipe e carta proposta
export function CampoCargo({ cargos, value, onChange, label = 'Cargo', error }: {
  cargos: CargoOpcao[]
  value: string
  onChange: (cargo: CargoOpcao | null) => void
  label?: string
  error?: string
}) {
  if (cargos.length === 0) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
        <p className="h-10 flex items-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Nenhum cargo.&nbsp;<Link href="/empresa?aba=estrutura" className="font-semibold hover:underline" style={{ color: 'var(--color-brand)' }}>Cadastrar em Estrutura</Link>
        </p>
      </div>
    )
  }
  return (
    <Select
      label={label}
      placeholder="Selecionar..."
      options={cargos.map((c) => ({ value: c.id, label: `${c.nome} (${c.departamento})` }))}
      value={value}
      onChange={(e) => onChange(cargos.find((c) => c.id === e.target.value) ?? null)}
      error={error}
    />
  )
}
