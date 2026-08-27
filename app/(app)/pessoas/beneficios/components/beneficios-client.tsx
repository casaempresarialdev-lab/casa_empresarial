'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ModalBeneficio } from './modal-beneficio'
import { deleteBenefitAction } from '../actions'
import type { CompanyBenefit, EmployeeWithBenefits } from '../queries'

interface Props {
  companyId: string
  benefits: CompanyBenefit[]
  employees: EmployeeWithBenefits[]
}

function fmtCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const DIAS_UTEIS = 22

function calcTotalBeneficios(emp: EmployeeWithBenefits, benefits: CompanyBenefit[]): number {
  return emp.employee_benefits.reduce((sum, eb) => {
    const benefit = benefits.find(b => b.id === eb.benefit_id)
    if (!benefit) return sum
    const valor = eb.valor_override ?? benefit.valor
    return sum + (benefit.por_dia_trabalhado ? valor * DIAS_UTEIS : valor)
  }, 0)
}

function ThreeDotMenu({ onEdit, onDelete, loading }: {
  onEdit: () => void
  onDelete: () => void
  loading: boolean
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const menuRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function handleOpen() {
    const rect = btnRef.current?.getBoundingClientRect()
    if (rect) {
      const openUp = rect.bottom + 92 > window.innerHeight - 8
      setPos(openUp
        ? { top: rect.top - 88, right: window.innerWidth - rect.right }
        : { top: rect.bottom + 4, right: window.innerWidth - rect.right }
      )
    }
    setOpen((v) => !v)
  }

  return (
    <div>
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-lg hover:bg-gray-100 transition-colors"
        style={{ color: 'var(--color-text-muted)' }}
        aria-label="Opções"
      >
        ···
      </button>
      {open && (
        <div
          ref={menuRef}
          className="fixed w-36 rounded-xl border shadow-lg py-1 z-50"
          style={{ backgroundColor: 'white', borderColor: 'var(--color-bg-surface)', top: pos.top, right: pos.right }}
        >
          <button
            type="button"
            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
            onClick={() => { setOpen(false); onEdit() }}
          >
            Editar
          </button>
          <button
            type="button"
            className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 transition-colors"
            style={{ color: 'var(--color-error)' }}
            onClick={() => { setOpen(false); onDelete() }}
            disabled={loading}
          >
            {loading ? 'Excluindo…' : 'Excluir'}
          </button>
        </div>
      )}
    </div>
  )
}

const TAB_STYLE = (active: boolean) => ({
  padding: '0.5rem 1rem',
  fontSize: '0.875rem',
  fontWeight: 500,
  color: active ? 'var(--color-primary-darker)' : 'var(--color-text-muted)',
  cursor: 'pointer',
  background: 'none',
  border: 'none',
  borderBottom: active ? '2px solid var(--color-primary-darker)' : '2px solid transparent',
})

export function BeneficiosClient({ companyId, benefits, employees }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<'catalogo' | 'funcionarios'>('funcionarios')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CompanyBenefit | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
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
          <Button onClick={() => { setEditing(null); setModalOpen(true) }}>Adicionar</Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-6" style={{ borderColor: 'var(--color-bg-surface)' }}>
        <button style={TAB_STYLE(tab === 'funcionarios')} onClick={() => setTab('funcionarios')}>
          Por funcionário
        </button>
        <button style={TAB_STYLE(tab === 'catalogo')} onClick={() => setTab('catalogo')}>
          Catálogo
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
                    <th className="px-4 py-3 w-10" />
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
                      <td className="px-3 py-2.5">
                        <div className="flex justify-end">
                          <ThreeDotMenu
                            onEdit={() => { setEditing(b); setModalOpen(true) }}
                            onDelete={() => handleDelete(b)}
                            loading={deletingId === b.id}
                          />
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
                    <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                      Funcionário
                    </th>
                    <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                      Total de Benefício
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map(emp => (
                    <tr key={emp.id} className="border-t" style={{ borderColor: 'var(--color-bg-surface)' }}>
                      <td className="px-4 py-3">
                        <div className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{emp.nome}</div>
                        {emp.cargo && <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{emp.cargo}</div>}
                      </td>
                      <td className="px-4 py-3 text-right font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {fmtCurrency(calcTotalBeneficios(emp, activeBenefits))}
                      </td>
                    </tr>
                  ))}
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
