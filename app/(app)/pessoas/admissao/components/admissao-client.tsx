'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ModalFuncionario } from '../../funcionarios/components/modal-funcionario'
import { updateEmployeeStatusAction } from '../actions'
import type { Employee } from '../../funcionarios/queries'
import type { CompanyBenefit } from '../../beneficios/queries'

interface Props {
  employees: Employee[]
  companyId: string
  companyBenefits: CompanyBenefit[]
}

const STATUS_CONFIG = {
  admissao:   { label: 'Em admissão',   bg: '#FEF9E7', text: '#D4AC0D' },
  experiencia:{ label: 'Experiência',   bg: '#EBF5FB', text: '#2471A3' },
}

const CHECKLIST = [
  'Contrato de trabalho assinado',
  'CTPS registrada',
  'Exame admissional (ASO)',
  'Ficha de registro preenchida',
  'Declaração de dependentes (IRRF)',
  'Declaração de VT',
  'Dados bancários',
  'Foto 3x4',
  'Comprovante de residência',
  'Cópia do CPF e RG',
]

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
}

export function AdmissaoClient({ employees, companyId, companyBenefits }: Props) {
  const router = useRouter()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [checked, setChecked] = useState<Record<string, Record<number, boolean>>>({})
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  function toggleChecked(empId: string, idx: number) {
    setChecked(prev => ({
      ...prev,
      [empId]: { ...prev[empId], [idx]: !prev[empId]?.[idx] },
    }))
  }

  function getCheckCount(empId: string) {
    const map = checked[empId] ?? {}
    return Object.values(map).filter(Boolean).length
  }

  async function handleAdvance(emp: Employee) {
    const nextStatus = emp.status === 'admissao' ? 'experiencia' : 'ativo'
    const label = nextStatus === 'experiencia' ? 'período de experiência' : 'ativo'
    if (!confirm(`Avançar ${emp.nome} para status "${label}"?`)) return
    setUpdatingId(emp.id)
    const result = await updateEmployeeStatusAction(emp.id, nextStatus)
    setUpdatingId(null)
    if ('error' in result) alert(result.error)
    else router.refresh()
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
            Admissão
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Funcionários em processo de admissão ou período de experiência
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>Adicionar</Button>
      </div>

      {employees.length === 0 && (
        <div className="rounded-xl border p-10 text-center" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Nenhum funcionário em admissão ou período de experiência.
          </p>
          <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
            Clique em "Novo funcionário" para iniciar uma admissão.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {employees.map(emp => {
          const cfg = STATUS_CONFIG[emp.status as keyof typeof STATUS_CONFIG]
          const checkCount = getCheckCount(emp.id)
          const isExpanded = expandedId === emp.id
          const nextLabel = emp.status === 'admissao' ? 'Iniciar experiência' : 'Efetuar contratação'

          return (
            <div key={emp.id} className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
              {/* Header do card */}
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-darker)' }}>
                    {emp.nome.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>{emp.nome}</div>
                    <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {emp.cargo ?? 'Sem cargo'} {emp.data_admissao ? `· Admitido em ${formatDate(emp.data_admissao)}` : ''}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {checkCount}/{CHECKLIST.length} docs
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ backgroundColor: cfg.bg, color: cfg.text }}>
                    {cfg.label}
                  </span>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : emp.id)}
                    className="text-xs px-3 py-1.5 rounded-lg border transition-colors hover:bg-gray-50"
                    style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-secondary)' }}
                  >
                    {isExpanded ? 'Recolher' : 'Checklist'}
                  </button>
                  <Button
                    size="sm"
                    loading={updatingId === emp.id}
                    onClick={() => handleAdvance(emp)}
                  >
                    {nextLabel}
                  </Button>
                </div>
              </div>

              {/* Checklist expandido */}
              {isExpanded && (
                <div className="border-t px-5 py-4" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'var(--color-bg-surface)' }}>
                  <p className="text-xs font-semibold mb-3" style={{ color: 'var(--color-text-secondary)' }}>
                    DOCUMENTOS E ETAPAS DE ADMISSÃO
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {CHECKLIST.map((item, idx) => {
                      const done = checked[emp.id]?.[idx] ?? false
                      return (
                        <label key={idx} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={done}
                            onChange={() => toggleChecked(emp.id, idx)}
                            className="rounded"
                          />
                          <span className="text-xs" style={{
                            color: done ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
                            textDecoration: done ? 'line-through' : 'none',
                          }}>
                            {item}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                  {emp.data_experiencia_fim && (
                    <p className="text-xs mt-3" style={{ color: 'var(--color-text-muted)' }}>
                      Fim do período de experiência: {formatDate(emp.data_experiencia_fim)}
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <ModalFuncionario
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        companyId={companyId}
        employee={null}
        companyBenefits={companyBenefits}
      />
    </>
  )
}
