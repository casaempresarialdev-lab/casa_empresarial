'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateBenefitsAction } from '../actions'
import type { EmployeeBenefit } from '../queries'

interface Props {
  employees: EmployeeBenefit[]
}

function fmtCurrency(v: number | null) {
  if (!v) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

type BenefitKey = 'vale_transporte' | 'vale_refeicao' | 'plano_saude'

export function BeneficiosClient({ employees: initial }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [employees, setEmployees] = useState(initial)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const filtered = employees.filter(e =>
    !search || e.nome.toLowerCase().includes(search.toLowerCase())
  )

  async function toggleBenefit(emp: EmployeeBenefit, key: BenefitKey) {
    const updated = { ...emp, [key]: !emp[key] }
    setEmployees(prev => prev.map(e => e.id === emp.id ? updated : e))

    setSavingId(emp.id)
    const result = await updateBenefitsAction(emp.id, {
      vale_transporte: updated.vale_transporte,
      vale_refeicao: updated.vale_refeicao,
      plano_saude: updated.plano_saude,
    })
    setSavingId(null)
    if ('error' in result) {
      setEmployees(prev => prev.map(e => e.id === emp.id ? emp : e))
      alert(result.error)
    } else {
      startTransition(() => router.refresh())
    }
  }

  const totals = {
    vt: employees.filter(e => e.vale_transporte).length,
    vr: employees.filter(e => e.vale_refeicao).length,
    ps: employees.filter(e => e.plano_saude).length,
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
            Benefícios
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Gestão de benefícios dos funcionários ativos
          </p>
        </div>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Vale-transporte', count: totals.vt, icon: '🚌' },
          { label: 'Vale-refeição', count: totals.vr, icon: '🍽️' },
          { label: 'Plano de saúde', count: totals.ps, icon: '🏥' },
        ].map(item => (
          <div key={item.label} className="p-4 rounded-xl border" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
            <div className="flex items-center gap-2 mb-1">
              <span>{item.icon}</span>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{item.label}</p>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
              {item.count} <span className="text-sm font-normal" style={{ color: 'var(--color-text-muted)' }}>/ {employees.length}</span>
            </p>
          </div>
        ))}
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar funcionário..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-4 py-2 rounded-lg border text-sm"
          style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white', color: 'var(--color-text-primary)' }}
        />
      </div>

      <div className="rounded-xl border overflow-x-auto" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
        <table className="w-full min-w-[600px] text-sm">
          <thead style={{ backgroundColor: 'var(--color-bg-surface)' }}>
            <tr>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Funcionário</th>
              <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Salário</th>
              <th className="text-center px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>🚌 VT</th>
              <th className="text-center px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>🍽️ VR</th>
              <th className="text-center px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>🏥 Plano</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-10" style={{ color: 'var(--color-text-muted)' }}>
                  {search ? 'Nenhum resultado.' : 'Nenhum funcionário ativo.'}
                </td>
              </tr>
            )}
            {filtered.map(emp => {
              const isSaving = savingId === emp.id
              return (
                <tr key={emp.id} className="border-t" style={{ borderColor: 'var(--color-bg-surface)', opacity: isSaving ? 0.6 : 1 }}>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-primary)' }}>
                    <div className="font-medium">{emp.nome}</div>
                    {emp.cargo && <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{emp.cargo}</div>}
                  </td>
                  <td className="px-4 py-3 text-right" style={{ color: 'var(--color-text-secondary)' }}>
                    {fmtCurrency(emp.salario)}
                  </td>
                  {(['vale_transporte', 'vale_refeicao', 'plano_saude'] as BenefitKey[]).map(key => (
                    <td key={key} className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleBenefit(emp, key)}
                        disabled={isSaving}
                        className="w-8 h-5 rounded-full transition-colors relative inline-flex"
                        style={{
                          backgroundColor: emp[key] ? 'var(--color-primary-darker)' : 'var(--color-bg-surface)',
                          cursor: isSaving ? 'not-allowed' : 'pointer',
                        }}
                        aria-label={emp[key] ? 'Remover benefício' : 'Adicionar benefício'}
                      >
                        <span
                          className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow"
                          style={{ transform: emp[key] ? 'translateX(14px)' : 'translateX(2px)' }}
                        />
                      </button>
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
