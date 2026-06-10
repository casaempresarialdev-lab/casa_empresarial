'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ModalBeneficio } from './modal-beneficio'
import { deleteBenefitAction, toggleEmployeeBenefitAction } from '../actions'
import type { CompanyBenefit, EmployeeWithBenefits } from '../queries'

interface Props {
  companyId: string
  benefits: CompanyBenefit[]
  employees: EmployeeWithBenefits[]
}

function fmtCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const TAB_STYLE = (active: boolean) => ({
  padding: '0.5rem 1rem',
  fontSize: '0.875rem',
  fontWeight: 500,
  borderBottom: active ? '2px solid var(--color-primary-darker)' : '2px solid transparent',
  color: active ? 'var(--color-primary-darker)' : 'var(--color-text-muted)',
  cursor: 'pointer',
  background: 'none',
  border: 'none',
  borderBottom: active ? '2px solid var(--color-primary-darker)' : '2px solid transparent',
})

export function BeneficiosClient({ companyId, benefits, employees }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<'catalogo' | 'funcionarios'>('catalogo')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CompanyBenefit | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const activeBenefits = benefits.filter(b => b.ativo)

  async function handleDelete(b: CompanyBenefit) {
    if (!confirm(`Excluir benefício "${b.nome}"? Todos os vínculos com funcionários serão removidos.`)) return
    setDeletingId(b.id)
    const result = await deleteBenefitAction(b.id)
    setDeletingId(null)
    if ('error' in result) alert(result.error)
    else startTransition(() => router.refresh())
  }

  async function handleToggle(empId: string, benefitId: string, currentlyActive: boolean) {
    const key = `${empId}-${benefitId}`
    setTogglingId(key)
    await toggleEmployeeBenefitAction(companyId, empId, benefitId, !currentlyActive)
    setTogglingId(null)
    startTransition(() => router.refresh())
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
            Benefícios
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Catálogo de benefícios e atribuição por funcionário
          </p>
        </div>
        {tab === 'catalogo' && (
          <Button onClick={() => { setEditing(null); setModalOpen(true) }}>+ Novo benefício</Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-6" style={{ borderColor: 'var(--color-bg-surface)' }}>
        <button style={TAB_STYLE(tab === 'catalogo')} onClick={() => setTab('catalogo')}>
          Catálogo
        </button>
        <button style={TAB_STYLE(tab === 'funcionarios')} onClick={() => setTab('funcionarios')}>
          Por funcionário
        </button>
      </div>

      {/* Aba Catálogo */}
      {tab === 'catalogo' && (
        <>
          {benefits.length === 0 ? (
            <div className="rounded-xl border p-10 text-center" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
              <p className="text-sm mb-3" style={{ color: 'var(--color-text-muted)' }}>
                Nenhum benefício cadastrado.
              </p>
              <Button onClick={() => { setEditing(null); setModalOpen(true) }}>Cadastrar primeiro benefício</Button>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
              <table className="w-full text-sm">
                <thead style={{ backgroundColor: 'var(--color-bg-surface)' }}>
                  <tr>
                    <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Benefício</th>
                    <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Valor ref.</th>
                    <th className="text-center px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Cálculo</th>
                    <th className="text-center px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Desconta salário</th>
                    <th className="text-center px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {benefits.map(b => (
                    <tr key={b.id} className="border-t" style={{ borderColor: 'var(--color-bg-surface)' }}>
                      <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text-primary)' }}>{b.nome}</td>
                      <td className="px-4 py-3 text-right" style={{ color: 'var(--color-text-secondary)' }}>
                        {fmtCurrency(b.valor)}
                        {b.por_dia_trabalhado && <span className="text-xs ml-1" style={{ color: 'var(--color-text-muted)' }}>/dia</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ backgroundColor: b.por_dia_trabalhado ? '#EBF5FB' : '#EAFAF1', color: b.por_dia_trabalhado ? '#2471A3' : '#1E8449' }}>
                          {b.por_dia_trabalhado ? 'Por dia' : 'Mensal fixo'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ backgroundColor: b.desconta_salario ? '#FDEDEC' : '#F4ECF7', color: b.desconta_salario ? '#C0392B' : '#8E44AD' }}>
                          {b.desconta_salario ? 'Desconta' : 'Custo empresa'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ backgroundColor: b.ativo ? '#EAFAF1' : '#F4F6F7', color: b.ativo ? '#1E8449' : '#717D7E' }}>
                          {b.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <Button variant="ghost" size="sm" onClick={() => { setEditing(b); setModalOpen(true) }}>Editar</Button>
                          <Button variant="danger" size="sm" loading={deletingId === b.id} onClick={() => handleDelete(b)}>Excluir</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Aba Por funcionário */}
      {tab === 'funcionarios' && (
        <>
          {activeBenefits.length === 0 ? (
            <div className="rounded-xl border p-10 text-center" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Cadastre benefícios no catálogo primeiro.
              </p>
            </div>
          ) : employees.length === 0 ? (
            <div className="rounded-xl border p-10 text-center" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Nenhum funcionário ativo.</p>
            </div>
          ) : (
            <div className="rounded-xl border overflow-x-auto" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
              <table className="w-full text-sm">
                <thead style={{ backgroundColor: 'var(--color-bg-surface)' }}>
                  <tr>
                    <th className="text-left px-4 py-3 font-medium sticky left-0 z-10" style={{ color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-bg-surface)', minWidth: 180 }}>
                      Funcionário
                    </th>
                    {activeBenefits.map(b => (
                      <th key={b.id} className="text-center px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)', minWidth: 120 }}>
                        <div>{b.nome}</div>
                        <div className="text-xs font-normal mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                          {fmtCurrency(b.valor)}{b.por_dia_trabalhado ? '/dia' : '/mês'}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {employees.map(emp => {
                    const activeBenefitIds = new Set(emp.employee_benefits.map(eb => eb.benefit_id))
                    return (
                      <tr key={emp.id} className="border-t" style={{ borderColor: 'var(--color-bg-surface)' }}>
                        <td className="px-4 py-3 sticky left-0 z-10" style={{ backgroundColor: 'white' }}>
                          <div className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{emp.nome}</div>
                          {emp.cargo && <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{emp.cargo}</div>}
                        </td>
                        {activeBenefits.map(b => {
                          const isActive = activeBenefitIds.has(b.id)
                          const key = `${emp.id}-${b.id}`
                          const isToggling = togglingId === key
                          return (
                            <td key={b.id} className="px-4 py-3 text-center">
                              <button
                                onClick={() => handleToggle(emp.id, b.id, isActive)}
                                disabled={isToggling}
                                className="w-8 h-5 rounded-full transition-colors relative inline-flex"
                                style={{
                                  backgroundColor: isActive ? 'var(--color-primary-darker)' : 'var(--color-bg-surface)',
                                  opacity: isToggling ? 0.5 : 1,
                                  cursor: isToggling ? 'not-allowed' : 'pointer',
                                }}
                              >
                                <span
                                  className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
                                  style={{ transform: isActive ? 'translateX(14px)' : 'translateX(2px)' }}
                                />
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <ModalBeneficio
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        companyId={companyId}
        benefit={editing}
      />
    </>
  )
}
