'use client'

import { useState } from 'react'
import type { EmployeeEncargo } from '../queries'

interface Props {
  employees: EmployeeEncargo[]
}

// Alíquotas de encargos patronais CLT (referência)
const FGTS = 0.08          // 8%
const INSS_PATRONAL = 0.20 // 20%
const RAT = 0.02           // 2% (médio — varia por atividade)
const SISTEMA_S = 0.058    // 5,8% (Sesc, Senai, Sesi, Sebrae, etc.)
const DIAS_UTEIS_MES = 22  // estimativa para benefícios por dia

function calcEncargos(salario: number) {
  const fgts = salario * FGTS
  const inss = salario * INSS_PATRONAL
  const rat = salario * RAT
  const sistemaS = salario * SISTEMA_S
  const ferias = salario / 12 + salario / 12 / 3
  const decimo = salario / 12
  const total = fgts + inss + rat + sistemaS + ferias + decimo
  return { fgts, inss, rat, sistemaS, ferias, decimo, total }
}

function calcBeneficios(emp: EmployeeEncargo): number {
  return emp.employee_benefits
    .filter(eb => !eb.benefit.desconta_salario) // só custo puro da empresa
    .reduce((sum, eb) => {
      const valor = eb.valor_override ?? eb.benefit.valor
      return sum + (eb.benefit.por_dia_trabalhado ? valor * DIAS_UTEIS_MES : valor)
    }, 0)
}

function fmtCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtPct(v: number) {
  return `${(v * 100).toFixed(1)}%`
}

export function EncargosClient({ employees }: Props) {
  const [search, setSearch] = useState('')

  const filtered = employees.filter(e =>
    !search || e.nome.toLowerCase().includes(search.toLowerCase())
  )

  const totalFolha = employees.reduce((s, e) => s + (e.salario ?? 0), 0)
  const totalEncargos = employees.reduce((s, e) => s + calcEncargos(e.salario ?? 0).total, 0)
  const totalBeneficios = employees.reduce((s, e) => s + calcBeneficios(e), 0)

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
            Encargos Trabalhistas
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Estimativa de encargos patronais por funcionário CLT
          </p>
        </div>
      </div>

      {/* Resumo geral */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Total salários</p>
          <p className="text-xl font-bold mt-1" style={{ color: 'var(--color-text-primary)' }}>{fmtCurrency(totalFolha)}</p>
        </div>
        <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Total encargos</p>
          <p className="text-xl font-bold mt-1" style={{ color: '#C0392B' }}>{fmtCurrency(totalEncargos)}</p>
        </div>
        <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Total benefícios</p>
          <p className="text-xl font-bold mt-1" style={{ color: '#8E44AD' }}>{fmtCurrency(totalBeneficios)}</p>
        </div>
        <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Custo total empresa</p>
          <p className="text-xl font-bold mt-1" style={{ color: 'var(--color-text-primary)' }}>{fmtCurrency(totalFolha + totalEncargos + totalBeneficios)}</p>
        </div>
      </div>

      {/* Legenda das alíquotas */}
      <div className="p-4 rounded-xl border mb-4 flex flex-wrap gap-4" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
        <p className="text-xs font-semibold w-full mb-1" style={{ color: 'var(--color-text-secondary)' }}>
          ALÍQUOTAS UTILIZADAS (referência CLT)
        </p>
        {[
          { label: 'FGTS', value: FGTS },
          { label: 'INSS Patronal', value: INSS_PATRONAL },
          { label: 'RAT/FAP', value: RAT },
          { label: 'Sistema S', value: SISTEMA_S },
          { label: '13º salário', value: 1/12 },
          { label: 'Férias + 1/3', value: (1/12 + 1/12/3) },
        ].map(item => (
          <span key={item.label} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
            style={{ backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-secondary)' }}>
            {item.label}: <strong>{fmtPct(item.value)}</strong>
          </span>
        ))}
        <p className="text-xs w-full mt-1" style={{ color: 'var(--color-text-muted)' }}>
          * Estimativa. Valores reais variam conforme RAT/FAP, atividade e regime tributário.
        </p>
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

      {employees.length === 0 ? (
        <div className="rounded-xl border p-10 text-center" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Nenhum funcionário ativo com salário cadastrado.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-x-auto" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
          <table className="w-full min-w-[800px] text-sm">
            <thead style={{ backgroundColor: 'var(--color-bg-surface)' }}>
              <tr>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Funcionário</th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Salário</th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>FGTS</th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>INSS</th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>RAT+S</th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>13º/Fér.</th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Total enc.</th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Benefícios</th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Custo total</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(emp => {
                const sal = emp.salario ?? 0
                const enc = calcEncargos(sal)
                return (
                  <tr key={emp.id} className="border-t" style={{ borderColor: 'var(--color-bg-surface)' }}>
                    <td className="px-4 py-3" style={{ color: 'var(--color-text-primary)' }}>
                      <div className="font-medium">{emp.nome}</div>
                      {emp.cargo && <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{emp.cargo}</div>}
                    </td>
                    <td className="px-4 py-3 text-right" style={{ color: 'var(--color-text-primary)' }}>{fmtCurrency(sal)}</td>
                    <td className="px-4 py-3 text-right text-xs" style={{ color: 'var(--color-text-secondary)' }}>{fmtCurrency(enc.fgts)}</td>
                    <td className="px-4 py-3 text-right text-xs" style={{ color: 'var(--color-text-secondary)' }}>{fmtCurrency(enc.inss)}</td>
                    <td className="px-4 py-3 text-right text-xs" style={{ color: 'var(--color-text-secondary)' }}>{fmtCurrency(enc.rat + enc.sistemaS)}</td>
                    <td className="px-4 py-3 text-right text-xs" style={{ color: 'var(--color-text-secondary)' }}>{fmtCurrency(enc.ferias + enc.decimo)}</td>
                    <td className="px-4 py-3 text-right font-semibold" style={{ color: '#C0392B' }}>{fmtCurrency(enc.total)}</td>
                    <td className="px-4 py-3 text-right font-semibold" style={{ color: '#8E44AD' }}>
                      {fmtCurrency(calcBeneficios(emp))}
                    </td>
                    <td className="px-4 py-3 text-right font-bold" style={{ color: 'var(--color-text-primary)' }}>{fmtCurrency(sal + enc.total + calcBeneficios(emp))}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot style={{ backgroundColor: 'var(--color-bg-surface)' }}>
              <tr>
                <td colSpan={6} className="px-4 py-3 text-right font-semibold text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  TOTAIS
                </td>
                <td className="px-4 py-3 text-right font-bold text-xs" style={{ color: '#C0392B' }}>{fmtCurrency(totalEncargos)}</td>
                <td className="px-4 py-3 text-right font-bold text-xs" style={{ color: '#8E44AD' }}>{fmtCurrency(totalBeneficios)}</td>
                <td className="px-4 py-3 text-right font-bold text-xs" style={{ color: 'var(--color-text-primary)' }}>{fmtCurrency(totalFolha + totalEncargos + totalBeneficios)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  )
}
